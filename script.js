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
		contact: initContact,
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

/* ─────────────────────────────────────────
   5. PAGE: Home
───────────────────────────────────────── */

// Cache so we don't refetch on re-visit
let _ghUser = null;
let _ghRepos = null;

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
				user.bio || "Embedded systems engineer & developer.";

		// Stats
		const visibleRepos = repos.filter(
			(r) => !CONFIG.excludeRepos.includes(r.name),
		);
		const totalStars = visibleRepos.reduce(
			(sum, r) => sum + r.stargazers_count,
			0,
		);
		const langs = new Set(visibleRepos.map((r) => r.language).filter(Boolean));

		setStatIfExists("stat-repos", visibleRepos.length);
		setStatIfExists("stat-stars", totalStars);
		setStatIfExists("stat-langs", langs.size);
	} catch (err) {
		console.error("Home init error:", err);
	}
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
	sort: "updated",
};

async function initProjects() {
	// Wire up controls
	document.querySelectorAll(".filter-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			document
				.querySelectorAll(".filter-btn")
				.forEach((b) => b.classList.remove("active"));
			btn.classList.add("active");
			projectsState.filter = btn.dataset.filter;
			renderProjects();
		});
	});

	const searchInput = document.getElementById("project-search");
	if (searchInput) {
		searchInput.addEventListener(
			"input",
			debounce((e) => {
				projectsState.search = e.target.value.toLowerCase().trim();
				renderProjects();
			}, 250),
		);
	}

	const langFilter = document.getElementById("lang-filter");
	if (langFilter) {
		langFilter.addEventListener("change", (e) => {
			projectsState.lang = e.target.value;
			renderProjects();
		});
	}

	const sortSelect = document.getElementById("sort-select");
	if (sortSelect) {
		sortSelect.addEventListener("change", (e) => {
			projectsState.sort = e.target.value;
			renderProjects();
		});
	}

	// Fetch repos if not cached
	if (!_ghRepos) {
		try {
			_ghRepos = await ghFetch(`${GH_API}/repos?per_page=100&type=public`);
		} catch (err) {
			document.getElementById("projects-grid").innerHTML =
				`<p class="no-results">Failed to load repositories. Please try again later.</p>`;
			return;
		}
	}

	// Filter out excluded repos
	const repos = _ghRepos.filter((r) => !CONFIG.excludeRepos.includes(r.name));

	// Fetch README for each repo to check SHOWCASE flag (in parallel, capped)
	const withShowcase = await resolveShowcaseFlags(repos);
	projectsState.repos = withShowcase;

	// Populate language filter dropdown
	populateLangFilter(withShowcase);

	renderProjects();
}

/**
 * Fetch READMEs in parallel (batched) and resolve the SHOWCASE flag.
 * Returns array of { ...repo, isShowcase: bool, readmeContent: string|null }
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
					const isShowcase = /<!--\s*SHOWCASE:\s*true\s*-->/i.test(text);
					return { ...repo, isShowcase, readmeContent: text };
				} catch {
					// No README or API error — not a showcase repo
					return { ...repo, isShowcase: false, readmeContent: null };
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
	const langSelect = document.getElementById("lang-filter");
	if (!langSelect) return;
	const langs = [
		...new Set(repos.map((r) => r.language).filter(Boolean)),
	].sort();
	langs.forEach((lang) => {
		const opt = document.createElement("option");
		opt.value = lang;
		opt.textContent = lang;
		langSelect.appendChild(opt);
	});
}

function renderProjects() {
	const grid = document.getElementById("projects-grid");
	if (!grid) return;

	let repos = [...projectsState.repos];

	// Apply showcase filter
	if (projectsState.filter === "showcase") {
		repos = repos.filter((r) => r.isShowcase);
	}

	// Apply search
	if (projectsState.search) {
		repos = repos.filter(
			(r) =>
				r.name.toLowerCase().includes(projectsState.search) ||
				(r.description || "").toLowerCase().includes(projectsState.search),
		);
	}

	// Apply language filter
	if (projectsState.lang) {
		repos = repos.filter((r) => r.language === projectsState.lang);
	}

	// Apply sort
	if (projectsState.sort === "updated") {
		repos.sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
	} else if (projectsState.sort === "stars") {
		repos.sort((a, b) => b.stargazers_count - a.stargazers_count);
	} else if (projectsState.sort === "name") {
		repos.sort((a, b) => a.name.localeCompare(b.name));
	}

	if (repos.length === 0) {
		grid.innerHTML = `<p class="no-results">No projects match the current filters.</p>`;
		return;
	}

	grid.innerHTML = repos.map((repo) => buildProjectCard(repo)).join("");

	// Attach click handlers for modal
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
	const badge = repo.isShowcase
		? `<span class="showcase-badge">Showcase</span>`
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
        ${badge}
      </div>
      <p class="project-card-desc">${desc}</p>
      <div class="project-card-meta">
        ${lang}${stars}${forks}${updated}
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
function initContact() {
	const submitBtn = document.getElementById("cf-submit");
	const statusEl = document.getElementById("cf-status");

	if (!submitBtn) return;

	submitBtn.addEventListener("click", async () => {
		const name = document.getElementById("cf-name")?.value.trim();
		const email = document.getElementById("cf-email")?.value.trim();
		const message = document.getElementById("cf-message")?.value.trim();

		if (!name || !email || !message) {
			statusEl.textContent = "Please fill in all fields.";
			statusEl.className = "cf-status error";
			return;
		}

		// Replace the action URL below with your Formspree endpoint
		// e.g. https://formspree.io/f/YOUR_FORM_ID
		const FORMSPREE_URL = "https://formspree.io/f/YOUR_FORM_ID";

		submitBtn.disabled = true;
		submitBtn.textContent = "Sending…";
		statusEl.textContent = "";
		statusEl.className = "cf-status";

		try {
			const res = await fetch(FORMSPREE_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({ name, email, message }),
			});

			if (res.ok) {
				statusEl.textContent = "Message sent! I'll get back to you soon.";
				statusEl.className = "cf-status success";
				document.getElementById("cf-name").value = "";
				document.getElementById("cf-email").value = "";
				document.getElementById("cf-message").value = "";
			} else {
				throw new Error("Server error");
			}
		} catch {
			statusEl.textContent = "Something went wrong. Try emailing me directly.";
			statusEl.className = "cf-status error";
		} finally {
			submitBtn.disabled = false;
			submitBtn.textContent = "Send Message";
		}
	});
}

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
