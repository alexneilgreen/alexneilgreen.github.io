/* ═══════════════════════════════════════════════════════════════
   script.js  —  alexneilgreen.github.io
   Structure:
     1. Config
     2. Shared Utilities
     3. Router (page loading)
     4. Shared Init (header, footer, nav)
     5. ── Page: Home
     6. ── Page: About  (static — no JS needed)
     7. ── Page: Projects
     8. ── Page: Contact
     9. README Modal
    10. Bootstrap
   ═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────
   1. Config
───────────────────────────────────────── */
const CONFIG = {
	username: "alexneilgreen",
	// Repos to always exclude (e.g. the portfolio repo itself)
	excludeRepos: ["alexneilgreen.github.io"],
};

const GH_API = `https://api.github.com/users/${CONFIG.username}`;

/* ─────────────────────────────────────────
   2. Shared Utilities
───────────────────────────────────────── */

/**
 * Fetch JSON from a URL with optional GitHub Accept header.
 */
async function ghFetch(url) {
	const res = await fetch(url, {
		headers: { Accept: "application/vnd.github+json" },
	});
	if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${url}`);
	return res.json();
}

/**
 * Decode a Base64 string to UTF-8 text (handles GitHub's base64 README).
 */
function decodeBase64(str) {
	// Remove whitespace that GitHub adds between lines
	const clean = str.replace(/\s/g, "");
	return decodeURIComponent(
		Array.from(atob(clean))
			.map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
			.join(""),
	);
}

/**
 * Format a date string as "MMM YYYY".
 */
function formatDate(iso) {
	return new Date(iso).toLocaleDateString("en-US", {
		month: "short",
		year: "numeric",
	});
}

/**
 * Naive debounce.
 */
function debounce(fn, ms = 300) {
	let t;
	return (...args) => {
		clearTimeout(t);
		t = setTimeout(() => fn(...args), ms);
	};
}

/* ─────────────────────────────────────────
   3. Router
───────────────────────────────────────── */
const PAGES = ["home", "about", "projects", "contact"];
let currentPage = null;

async function loadPage(page) {
	if (!PAGES.includes(page)) page = "home";
	if (page === currentPage) return;

	const container = document.getElementById("page-container");
	container.style.opacity = "0";
	container.style.transform = "translateY(8px)";

	try {
		const res = await fetch(`pages/${page}.html`);
		if (!res.ok) throw new Error("Page not found");
		const html = await res.text();
		container.innerHTML = html;
	} catch (e) {
		container.innerHTML = `<p style="color:var(--text-secondary);padding:40px 0;">Page not found.</p>`;
	}

	// Animate in
	requestAnimationFrame(() => {
		container.style.transition = "opacity .25s ease, transform .25s ease";
		container.style.opacity = "1";
		container.style.transform = "translateY(0)";
	});

	// Update nav active state
	document.querySelectorAll(".nav-link").forEach((a) => {
		a.classList.toggle("active", a.dataset.page === page);
	});

	// Update URL hash (no page reload)
	history.pushState({ page }, "", `#${page}`);
	currentPage = page;

	// Run page-specific init
	const inits = {
		home: initHome,
		about: null,
		projects: initProjects,
		contact: null,
	};
	if (inits[page]) inits[page]();
}

// Handle nav clicks (delegated to document so it catches dynamically loaded buttons too)
document.addEventListener("click", (e) => {
	const target = e.target.closest("[data-page]");
	if (!target) return;
	e.preventDefault();
	loadPage(target.dataset.page);
	// Close mobile menu if open
	document.getElementById("main-nav").classList.remove("open");
});

// Handle browser back/forward
window.addEventListener("popstate", (e) => {
	const page = e.state?.page || "home";
	loadPage(page);
});

/* ─────────────────────────────────────────
   4. Shared Init
───────────────────────────────────────── */
function initShared() {
	// Initialize Theme Toggle
	initThemeToggle();

	// Footer year
	const yearEl = document.getElementById("footer-year");
	if (yearEl) yearEl.textContent = new Date().getFullYear();

	// Hamburger menu
	const hamburger = document.getElementById("hamburger");
	const nav = document.getElementById("main-nav");
	if (hamburger && nav) {
		hamburger.addEventListener("click", () => nav.classList.toggle("open"));
	}
}

function initThemeToggle() {
	const toggleBtn = document.getElementById("theme-toggle");
	const themeIcon = document.getElementById("theme-icon");
	const themeLabel = document.getElementById("theme-label");
	const body = document.body;

	function updateUI(isLight) {
		if (isLight) {
			body.classList.add("light-mode");
			themeIcon.className = "fa fa-sun-o"; // Change to sun icon
			themeLabel.textContent = "Light Mode";
		} else {
			body.classList.remove("light-mode");
			themeIcon.className = "fa fa-moon-o"; // Change back to moon icon
			themeLabel.textContent = "Dark Mode";
		}
	}

	// Check for saved preference
	const isLight = localStorage.getItem("theme") === "light";
	updateUI(isLight);

	if (toggleBtn) {
		toggleBtn.addEventListener("click", () => {
			const nowLight = !body.classList.contains("light-mode");
			updateUI(nowLight);
			localStorage.setItem("theme", nowLight ? "light" : "dark");
		});
	}
}

/* ─────────────────────────────────────────
   5. PAGE: Home
───────────────────────────────────────── */

// Cache so we don't refetch on re-visit
let _ghUser = null;
let _ghRepos = null;
let _ghResolvedRepos = null; // populated by initProjects; used by home stat

async function initHome() {
	try {
		const [user, repos] = await Promise.all([
			_ghUser || ghFetch(GH_API),
			_ghRepos || ghFetch(`${GH_API}/repos?per_page=100&type=public`),
		]);
		_ghUser = user;
		_ghRepos = repos;

		// Avatar
		const avatar = document.getElementById("hero-avatar");
		if (avatar) avatar.src = user.avatar_url;

		// Tagline from GitHub bio
		const tagline = document.getElementById("hero-tagline");
		if (tagline)
			tagline.textContent =
				user.bio ||
				"Computer Engineer with a focus in Intelligent Systems & Machine Learning.";

		// Stats from repo list (no README fetch needed)
		const visibleRepos = repos.filter(
			(r) => !CONFIG.excludeRepos.includes(r.name),
		);
		const totalStars = visibleRepos.reduce(
			(sum, r) => sum + r.stargazers_count,
			0,
		);
		const totalForks = visibleRepos.reduce((sum, r) => sum + r.forks_count, 0);

		setStatIfExists("stat-repos", visibleRepos.length);
		setStatIfExists("stat-stars", totalStars);
		setStatIfExists("stat-forks", totalForks);

		// Language count: use badge-parsed data if already cached from Projects,
		// otherwise fall back to GitHub primary language count
		updateLangStat();
	} catch (err) {
		console.error("Home init error:", err);
	}
}

/**
 * Update the language stat on the home page.
 * Uses badge-parsed all_languages from resolved repos if available,
 * otherwise falls back to GitHub primary language from _ghRepos.
 */
function updateLangStat() {
	let langSet;
	if (_ghResolvedRepos && _ghResolvedRepos.length > 0) {
		langSet = new Set(_ghResolvedRepos.flatMap((r) => r.all_languages || []));
	} else if (_ghRepos) {
		const visible = _ghRepos.filter(
			(r) => !CONFIG.excludeRepos.includes(r.name),
		);
		langSet = new Set(visible.map((r) => r.language).filter(Boolean));
	} else {
		return;
	}
	setStatIfExists("stat-langs", langSet.size);
}

function setStatIfExists(id, value) {
	const el = document.getElementById(id);
	if (el) el.textContent = value;
}

/* ─────────────────────────────────────────
   7. PAGE: Projects
───────────────────────────────────────── */

// State for projects page
const projectsState = {
	repos: [], // all fetched repos (with showcase flag resolved)
	filter: "showcase", // 'showcase' | 'all'
	search: "",
	lang: "",
	status: "", // 'Completed' | 'Archived' | 'In Progress' | ''
	sort: "updated",
};

function setupProjectListeners() {
	const searchInput = document.getElementById("project-search");
	const langFilter = document.getElementById("lang-filter");
	const sortSelect = document.getElementById("sort-select");
	const filterBtns = document.querySelectorAll(".filter-btn");

	if (searchInput) {
		searchInput.addEventListener(
			"input",
			debounce(() => {
				projectsState.search = searchInput.value.toLowerCase().trim();
				renderProjects();
			}, 250),
		);
	}

	if (langFilter) {
		langFilter.addEventListener("change", () => {
			projectsState.lang = langFilter.value;
			renderProjects();
		});
	}

	const statusFilter = document.getElementById("status-filter");
	if (statusFilter) {
		statusFilter.addEventListener("change", () => {
			projectsState.status = statusFilter.value;
			renderProjects();
		});
	}

	if (sortSelect) {
		sortSelect.addEventListener("change", () => {
			projectsState.sort = sortSelect.value;
			renderProjects();
		});
	}

	filterBtns.forEach((btn) => {
		btn.addEventListener("click", () => {
			filterBtns.forEach((b) => b.classList.remove("active"));
			btn.classList.add("active");
			projectsState.filter = btn.dataset.filter;
			renderProjects();
		});
	});
}

async function initProjects() {
	const grid = document.getElementById("projects-grid");
	if (!grid) return;

	try {
		// Use cached repos if available
		if (!_ghRepos) {
			_ghRepos = await ghFetch(`${GH_API}/repos?per_page=100&sort=updated`);
		}

		// Filter out excluded repos
		const filteredRepos = _ghRepos.filter(
			(repo) => !CONFIG.excludeRepos.includes(repo.name),
		);

		// Fetch READMEs to resolve SHOWCASE flags and LANGUAGES tags (batched)
		const withShowcase = await resolveShowcaseFlags(filteredRepos);

		// Store in shared state so renderProjects() can read it
		projectsState.repos = withShowcase;
		projectsState.filter = "showcase";

		// Cache resolved repos globally so home page lang stat can use them
		_ghResolvedRepos = withShowcase;
		updateLangStat();

		// Populate language dropdown
		populateLangFilter(withShowcase);

		// Wire up filter/search/sort listeners
		setupProjectListeners();

		// Initial render
		renderProjects();
	} catch (err) {
		console.error(err);
		grid.innerHTML = `<p class="error">Error loading projects: ${err.message}</p>`;
	}
}

/**
 * Fetch READMEs in parallel (batched) and resolve the SHOWCASE flag
 * and LANGUAGES tag.
 * Returns array of { ...repo, isShowcase: bool, all_languages: string[], readmeContent: string|null }
 */
async function resolveShowcaseFlags(repos) {
	const BATCH = 10; // max concurrent requests
	const results = [];

	for (let i = 0; i < repos.length; i += BATCH) {
		const batch = repos.slice(i, i + BATCH);
		const settled = await Promise.allSettled(
			batch.map(async (repo) => {
				try {
					const data = await ghFetch(
						`https://api.github.com/repos/${CONFIG.username}/${repo.name}/readme`,
					);
					const text = decodeBase64(data.content);

					// Parse <!-- SHOWCASE: true -->
					const isShowcase = /<!--\s*SHOWCASE:\s*true\s*-->/i.test(text);

					// Parse language badge: ![Language](https://img.shields.io/badge/language-Python%20%7C%20C%2B%2B-blue)
					// Falls back to GitHub primary language if badge is absent
					const badgeMatch = text.match(
						/shields\.io\/badge\/language-(.+?)-blue/i,
					);
					const all_languages = badgeMatch
						? decodeURIComponent(badgeMatch[1])
								.split("|")
								.map((l) => l.trim())
								.filter(Boolean)
						: repo.language
							? [repo.language]
							: [];

					// Parse status badge: ![Status](https://img.shields.io/badge/status-complete-brightgreen)
					const statusMatch = text.match(
						/shields\.io\/badge\/status-([^-]+(?:-[^-]+)*?)-(brightgreen|lightgrey|yellow|red|blue)/i,
					);
					const rawStatus = statusMatch
						? decodeURIComponent(statusMatch[1]).toLowerCase()
						: "";
					const status =
						rawStatus === "complete"
							? "Completed"
							: rawStatus === "archived"
								? "Archived"
								: rawStatus.includes("progress")
									? "In Progress"
									: "";

					return {
						...repo,
						isShowcase,
						all_languages,
						status,
						readmeContent: text,
					};
				} catch {
					// No README or API error
					return {
						...repo,
						isShowcase: false,
						all_languages: repo.language ? [repo.language] : [],
						status: "",
						readmeContent: null,
					};
				}
			}),
		);
		settled.forEach((s) => {
			if (s.status === "fulfilled") results.push(s.value);
		});
	}

	return results;
}

function populateLangFilter(repos) {
	const filter = document.getElementById("lang-filter");
	if (!filter) return;

	// Collect every unique language from every repository
	const langSet = new Set();
	repos.forEach((repo) => {
		if (repo.all_languages) {
			repo.all_languages.forEach((lang) => langSet.add(lang));
		}
	});

	const sortedLangs = Array.from(langSet).sort();

	// Clear existing options except the first one
	filter.innerHTML = '<option value="">All Languages</option>';

	sortedLangs.forEach((lang) => {
		const opt = document.createElement("option");
		opt.value = lang;
		opt.textContent = lang;
		filter.appendChild(opt);
	});
}

function renderProjects() {
	const grid = document.getElementById("projects-grid");
	if (!grid) return;

	let repos = [...projectsState.repos];

	// 1. Showcase Filter
	if (projectsState.filter === "showcase") {
		repos = repos.filter((r) => r.isShowcase);
	}

	// 2. Apply status filter
	if (projectsState.status) {
		repos = repos.filter((r) => r.status === projectsState.status);
	}

	// 3. Apply search
	if (projectsState.search) {
		const term = projectsState.search.toLowerCase();
		repos = repos.filter(
			(r) =>
				r.name.toLowerCase().includes(term) ||
				(r.description || "").toLowerCase().includes(term),
		);
	}

	// 4. Apply language filter
	if (projectsState.lang) {
		repos = repos.filter(
			(r) => r.all_languages && r.all_languages.includes(projectsState.lang),
		);
	}

	// 5. Apply sort
	if (projectsState.sort === "updated") {
		repos.sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
	} else if (projectsState.sort === "stars") {
		repos.sort((a, b) => b.stargazers_count - a.stargazers_count);
	} else if (projectsState.sort === "name") {
		repos.sort((a, b) => a.name.localeCompare(b.name));
	}

	// 6. Render Results
	if (repos.length === 0) {
		grid.innerHTML = `<p class="no-results">No projects match the current filters.</p>`;
		return;
	}

	grid.innerHTML = repos.map((repo) => buildProjectCard(repo)).join("");

	// Re-attach modal handlers
	grid.querySelectorAll(".project-card").forEach((card) => {
		card.addEventListener("click", () => {
			const name = card.dataset.repoName;
			const url = card.dataset.repoUrl;
			const content = card.dataset.readmeContent;
			openReadmeModal(name, url, content || null);
		});
	});
}

function buildProjectCard(repo) {
	const desc = repo.description
		? escapeHtml(repo.description)
		: "<em>No description provided.</em>";
	const lang = repo.language
		? `<span class="lang-badge">${escapeHtml(repo.language)}</span>`
		: "";
	const stars =
		repo.stargazers_count > 0
			? `<span class="project-meta-item">★ ${repo.stargazers_count}</span>`
			: "";
	const forks =
		repo.forks_count > 0
			? `<span class="project-meta-item">⑂ ${repo.forks_count}</span>`
			: "";
	const updated = `<span class="project-meta-item">↻ ${formatDate(repo.pushed_at)}</span>`;

	const showcaseBadge = repo.isShowcase
		? `<span class="showcase-badge">★ Showcase</span>`
		: "";

	const statusClass =
		repo.status === "Completed"
			? "status-badge--complete"
			: repo.status === "Archived"
				? "status-badge--archived"
				: repo.status === "In Progress"
					? "status-badge--progress"
					: "";
	const statusBadge = repo.status
		? `<span class="status-badge ${statusClass}">${escapeHtml(repo.status)}</span>`
		: "";

	// Escape readme content for safe storage in data attribute
	const readmeAttr = repo.readmeContent
		? `data-readme-content="${escapeAttr(repo.readmeContent)}"`
		: "";

	return `
    <div class="project-card"
         data-repo-name="${escapeAttr(repo.name)}"
         data-repo-url="${escapeAttr(repo.html_url)}"
         ${readmeAttr}>
      <div class="project-card-top">
        <span class="project-card-name">${escapeHtml(repo.name)}</span>
      </div>
      <p class="project-card-desc">${desc}</p>
      <div class="project-card-meta">
        <div class="project-meta-left">${lang}${stars}${forks}${updated}</div>
        <div class="project-meta-right">${statusBadge}${showcaseBadge}</div>
      </div>
    </div>`;
}

function escapeHtml(str) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function escapeAttr(str) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/* ─────────────────────────────────────────
   8. PAGE: Contact
───────────────────────────────────────── */
// Contact page is static links only — no JS needed.

/* ─────────────────────────────────────────
   9. README Modal
───────────────────────────────────────── */
const modal = document.getElementById("readme-modal");
const modalBody = document.getElementById("modal-body");
const modalTitle = document.getElementById("modal-repo-name");
const modalLink = document.getElementById("modal-repo-link");
const modalClose = document.getElementById("modal-close");

function openReadmeModal(repoName, repoUrl, readmeContent) {
	modalTitle.textContent = repoName;
	modalLink.href = repoUrl;

	// Show loading state
	modalBody.innerHTML =
		'<div class="modal-loading"><span class="loading-spinner"></span>Loading README…</div>';
	modal.classList.add("open");
	modal.setAttribute("aria-hidden", "false");
	document.body.style.overflow = "hidden";

	if (readmeContent) {
		renderReadme(readmeContent);
	} else {
		// Fetch fresh if not cached
		ghFetch(
			`https://api.github.com/repos/${CONFIG.username}/${repoName}/readme`,
		)
			.then((data) => renderReadme(decodeBase64(data.content)))
			.catch(() => {
				modalBody.innerHTML =
					'<p style="color:var(--text-secondary);padding:20px 0;">No README found for this repository.</p>';
			});
	}
}

function renderReadme(markdown) {
	// Strip the SHOWCASE comment line before rendering
	const cleaned = markdown.replace(
		/<!--\s*SHOWCASE:\s*(true|false)\s*-->\s*\n?/gi,
		"",
	);

	// Configure marked
	marked.setOptions({
		gfm: true,
		breaks: false,
	});

	const html = marked.parse(cleaned);
	modalBody.innerHTML = html;

	// Syntax highlight code blocks
	modalBody.querySelectorAll("pre code").forEach((block) => {
		hljs.highlightElement(block);
	});
}

function closeModal() {
	modal.classList.remove("open");
	modal.setAttribute("aria-hidden", "true");
	document.body.style.overflow = "";
}

if (modalClose) modalClose.addEventListener("click", closeModal);

// Close on overlay click
modal.addEventListener("click", (e) => {
	if (e.target === modal) closeModal();
});

// Close on Escape key
document.addEventListener("keydown", (e) => {
	if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
});

/* ─────────────────────────────────────────
   10. Bootstrap
───────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
	initShared();

	// Determine initial page from URL hash
	const hash = window.location.hash.replace("#", "") || "home";
	loadPage(PAGES.includes(hash) ? hash : "home");
});
