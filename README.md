# alexneilgreen.github.io

> Personal portfolio and resume site hosted via GitHub Pages, showcasing projects, skills, and experience with live README rendering from public repositories.

![Status](https://img.shields.io/badge/status-Active-brightgreen)
![Language](https://img.shields.io/badge/language-HTML%20%7C%20CSS%20%7C%20JavaScript-blue)
![Timeline](https://img.shields.io/badge/timeline-Spring%202026-orange)

**Live Site:** [alexneilgreen.github.io](https://alexneilgreen.github.io)

---

## Features

### General

- Single-page application with client-side routing via URL hash
- Smooth page transition animations on navigation
- Persistent dark/light mode toggle with `localStorage`
- Responsive layout with mobile hamburger navigation
- Sticky header with active nav state tracking

### Home Page

- GitHub avatar fetched live from the GitHub API
- Bio tagline pulled from GitHub profile bio
- Live stats: total repositories, stars earned, total forks, and unique languages

### About Page

- Personal bio and skills organized into four categories: General, Coding Languages, Software, and Hardware
- Software and Hardware skill cards open a centered overlay modal on click, showing detailed subcategory breakdowns
- Experience and Education section links out to LinkedIn

### Projects Page

- Project cards fetched live from the GitHub REST API (no authentication required)
- READMEs fetched in batches to parse metadata without hitting rate limits
- Default filter shows only Showcase repos (`<!-- SHOWCASE: true -->` tag in README)
- Filter by status (Completed, In Progress, Archived), parsed from shields.io status badge
- Filter by language, parsed from shields.io language badge
- Filter by All Repos or Showcase only
- Sort by Recently Updated, Most Stars, Name A-Z, or Chronological
- Chronological sort uses semester/timeline badges, ordering newest first with Showcase repos first within each period
- Search bar filters by repo name and description
- Each card displays: language badge, stars, forks, last updated date, status badge, semester/timeline badge, and Showcase badge
- Clicking a card opens a README modal with full Markdown rendering and syntax-highlighted code blocks

### Contact Page

- Links to LinkedIn and GitHub profiles

---

## File Structure

```
alexneilgreen.github.io/
├── index.html          # Outer shell: header, footer, README modal
├── styles.css          # All styles, sectioned by page
├── script.js           # All JavaScript, sectioned by page
└── pages/
    ├── home.html
    ├── about.html
    ├── projects.html
    └── contact.html
```

---

## README Metadata Tags

Each repository README uses the following shields.io badges and HTML comment tags that this site scrapes at runtime:

| Tag                                                                     | Purpose                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `<!-- SHOWCASE: true -->`                                               | Marks a repo as a featured project                            |
| `![Status](https://img.shields.io/badge/status-complete-brightgreen)`   | Sets project status (complete, archived, in--progress)        |
| `![Language](https://img.shields.io/badge/language-Python-blue)`        | Sets language(s) shown in filter, pipe-separated for multiple |
| `![Semester](https://img.shields.io/badge/semester-Fall%202024-orange)` | Sets academic semester for chronological sort                 |
| `![Timeline](https://img.shields.io/badge/timeline-Fall%202024-orange)` | Sets timeline period for non-school projects                  |

---

## Running Locally

The site uses `fetch()` to load page fragments and call the GitHub API, so it must be served over HTTP rather than opened directly as a `file://` URL.

### Python

```bash
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

### Node.js

```bash
npx serve .
```

Then open the URL shown in the terminal (typically [http://localhost:3000](http://localhost:3000)).

---

## Dependencies

All loaded via CDN, no build step required.

| Library                                                 | Version      | Purpose                             |
| ------------------------------------------------------- | ------------ | ----------------------------------- |
| [Marked.js](https://marked.js.org/)                     | 9.1.6        | Markdown rendering in README modal  |
| [Highlight.js](https://highlightjs.org/)                | 11.9.0       | Syntax highlighting in README modal |
| [Font Awesome](https://fontawesome.com/)                | 4.7.0        | Theme toggle icons                  |
| [DM Serif Display / DM Mono](https://fonts.google.com/) | Google Fonts | Typography                          |
