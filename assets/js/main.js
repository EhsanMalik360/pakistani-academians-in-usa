import { $, $$, esc, fmt, store, reducedMotion, shortSchool, STATE_NAMES } from "./utils.js";
import { people, META, CONFIG, totals, readUrl, update, only, byId, openProfessor } from "./store.js";
import { initSky, initLegend, initStats, initBridge, initMap, goToDirectory } from "./viz.js";
import { initDirectory, currentList } from "./directory.js";
import { initPanel } from "./panel.js";
import { initForms } from "./forms.js";

function initTheme() {
  const btn = $("#theme-toggle");
  const isDark = () => {
    const t = document.documentElement.dataset.theme;
    return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  };
  const label = () => btn.setAttribute("aria-label", isDark() ? "Switch to light theme" : "Switch to dark theme");
  btn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store("rabta.theme", next);
    label();
  });
  label();
}

function initNav() {
  const nav = $("#nav");
  const hero = $("#hero");
  new IntersectionObserver(([e]) => { nav.dataset.over = e.isIntersecting ? "hero" : "page"; }, { rootMargin: `-${64}px 0px 0px 0px` }).observe(hero);

  const links = $$(".nav-links a");
  const sections = links.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + e.target.id)));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => spy.observe(s));
}

function initReveal() {
  const els = $$(".reveal");
  if (reducedMotion() || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  els.forEach((el) => io.observe(el));
}

function initHeroSearch() {
  const form = $("#hero-search");
  const input = $("#hero-q");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    $("#q").value = q;
    update({ q });
    goToDirectory();
  });

  const topSchools = totals("schools").slice(0, 3).map(([s]) => s);
  const topState = totals("states")[0]?.[0];
  const suggestions = [
    ...topSchools.map((s) => ({ label: shortSchool(s), run: () => only("schools", s) })),
    { label: "Machine learning", run: () => { $("#q").value = "machine learning"; only("fields", "Computer science"); update({ q: "machine learning" }); } },
    { label: "Cardiology", run: () => { $("#q").value = "cardio"; update({ q: "cardio" }); } },
    topState && { label: "Teaching in " + (STATE_NAMES[topState] || topState), run: () => only("states", topState) },
  ].filter(Boolean);
  const root = $("#hero-suggest");
  root.innerHTML = `<span>Popular</span>` + suggestions.map((s, i) => `<button type="button" class="chip-dark" data-i="${i}">${esc(s.label)}</button>`).join("");
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    suggestions[+b.dataset.i].run();
    goToDirectory();
  });
}

function initCompare() {
  const tabs = $$('#compare [role="tab"]');
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $("#" + t.getAttribute("aria-controls")).hidden = !on;
    });
  };
  tabs.forEach((t) => {
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const next = tabs[(tabs.indexOf(t) + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      select(next);
    });
  });
  select(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0]);
}

function initFooter() {
  const btn = (type, text) => `<button type="button" class="link-btn" data-form="${type}">${esc(text)}</button>`;
  $("#correction-line").innerHTML =
    "Are you listed here? You can ask for any change, or to be removed, and we’ll update it promptly. " + btn("correct", "Request a correction or removal") + ".";
  $("#suggest-line").innerHTML =
    "Know someone who should be here? " + btn("suggest", "Suggest a professor") +
    ". Listed and want a change? " + btn("correct", "Request a correction or removal") + ".";
  $("#updated").textContent = META.updated || window.DIRECTORY_UPDATED
    ? `Information last checked ${META.updated || window.DIRECTORY_UPDATED}. Titles change, so confirm details on the faculty profile.`
    : "";
  const checked = META.universitiesChecked;
  $("#about-note").textContent =
    (checked ? `To build this list, ${fmt(checked)} US universities were checked department by department. ` : "") +
    (META.excludedInstitutional ? `${fmt(META.excludedInstitutional)} people whose only link was working at a Pakistani institution are not listed, because the directory covers people born, raised or educated in Pakistan. ` : "") +
    "Emeritus, adjunct and visiting faculty are marked, since they rarely take new students.";
}

function boot() {
  if (!people.length) {
    $("#grid").innerHTML = `<div class="empty-state"><h3>The directory couldn’t load</h3><p>Please refresh the page. If it keeps happening, the data file may be missing.</p></div>`;
    return;
  }
  const openId = readUrl();
  initTheme();
  initNav();
  initReveal();
  initStats();
  const sky = initSky();
  initLegend(sky);
  initBridge();
  initMap();
  initDirectory();
  initPanel();
  initForms();
  initHeroSearch();
  initCompare();
  initFooter();
  if (openId && byId.has(openId)) openProfessor(openId, currentList());

  window.addEventListener("popstate", () => {
    readUrl();
    update({});
  });
}

boot();
