import { $, $$, esc, fmt, plural, debounce, highlight, initials, shortSchool, toast, copyText, ICONS, STATE_NAMES } from "./utils.js";
import {
  people, state, FIELDS, FIELD_SHORT, LINKS, STATUS, FACETS, saved,
  on, update, toggle, reset, results, facetCounts, totals, words, filterCount, hasFilters,
  toggleSaved, openProfessor, absoluteUrl, fieldColor,
} from "./store.js";

const BATCH = 24;
const AUTO_LIMIT = 96;

let list = [];
let shown = 0;

export const currentList = () => list;

/* ------------------------------------------------------------------ cards */

export function card(p, i = 0, ws = words()) {
  const isSaved = saved.has(p.id);
  const ties = p.a.length
    ? p.a.slice(0, 3).map((s) => `<li><button type="button" class="tie" data-school="${esc(s)}" title="Show everyone who studied at ${esc(s)}">${esc(shortSchool(s))}</button></li>`).join("")
    : `<li><span class="tie plain">${esc(LINKS[p.l] || "Connection to Pakistan")}</span></li>`;
  const badge = p.s !== "active" ? `<span class="badge">${esc(STATUS[p.s] || p.s)}</span>` : p.m ? `<span class="badge badge-mail" title="Their faculty profile publishes an email address">Email on profile</span>` : "";
  return `<article class="card" style="--fc:${fieldColor(p)};--i:${i % BATCH}" data-id="${esc(p.id)}">
    <button type="button" class="card-hit" aria-label="Open details for ${esc(p.n)}"></button>
    <div class="card-top">
      <span class="avatar" aria-hidden="true">${esc(initials(p.n))}</span>
      <div><h3>${highlight(p.n, ws)}</h3><p class="ptitle">${esc(p.t)}</p></div>
      <button type="button" class="save" data-save="${esc(p.id)}" aria-pressed="${isSaved}" aria-label="${isSaved ? "Remove from saved" : "Save"} ${esc(p.n)}">${ICONS.bookmark}</button>
    </div>
    <p class="where"><span>${highlight(p.u, ws)}</span>${p.st ? `<span class="st" title="${esc(STATE_NAMES[p.st] || "")}">${p.st}</span>` : ""}</p>
    <p class="research">${highlight(p.r, ws)}</p>
    <ul class="ties" aria-label="Studied in Pakistan at">${ties}</ul>
    <div class="card-foot">
      <span class="ftag">${esc(FIELD_SHORT[p.c] || p.c)}</span>
      <span class="card-links">${badge}<a href="${esc(p.p)}" target="_blank" rel="noopener">Profile ${ICONS.external}</a></span>
    </div>
  </article>`;
}

/* ---------------------------------------------------------------- facets */

const FACET_DEFS = [
  { key: "fields", title: "Field", limit: 9, label: (v) => FIELD_SHORT[v] || v, swatch: (v) => `var(--f${FIELDS.indexOf(v) % 9})` },
  { key: "schools", title: "Studied in Pakistan at", limit: 7, searchable: "Find a university", label: shortSchool, full: (v) => v },
  { key: "states", title: "Teaching in", limit: 6, searchable: "Find a state", label: (v) => STATE_NAMES[v] || v },
  { key: "links", title: "Connection to Pakistan", limit: 4, label: (v) => LINKS[v] || v },
];
const facetUi = {};

function buildFilters() {
  const body = $("#filters-body");
  body.innerHTML =
    FACET_DEFS.map((d) => `<section class="facet" data-facet="${d.key}">
      <h4><span>${esc(d.title)}</span></h4>
      ${d.searchable ? `<input type="search" class="facet-search" placeholder="${esc(d.searchable)}" aria-label="${esc(d.searchable)}">` : ""}
      <ul></ul>
      <button type="button" class="link-btn more" hidden></button>
    </section>`).join("") +
    `<section class="facet">
      <h4><span>Availability</span></h4>
      <label class="switch"><span>Active faculty only<small>Hide emeritus, adjunct and visiting</small></span><input type="checkbox" id="f-active"><span class="track"></span></label>
      <label class="switch"><span>Email on their profile<small>The faculty page lists an address</small></span><input type="checkbox" id="f-email"><span class="track"></span></label>
    </section>`;

  const all = {
    fields: FIELDS.filter((f) => people.some((p) => p.c === f)),
    schools: totals("schools").map(([s]) => s),
    states: totals("states").map(([s]) => s),
    links: Object.keys(LINKS),
  };

  for (const d of FACET_DEFS) {
    const el = $(`[data-facet="${d.key}"]`, body);
    facetUi[d.key] = { el, values: all[d.key], expanded: false, query: "" };
    const search = $(".facet-search", el);
    if (search) search.addEventListener("input", () => { facetUi[d.key].query = search.value.toLowerCase(); renderFacet(d); });
    $(".more", el).addEventListener("click", () => { facetUi[d.key].expanded = !facetUi[d.key].expanded; renderFacet(d); });
    $("ul", el).addEventListener("click", (e) => {
      const b = e.target.closest(".opt");
      if (b) toggle(d.key, b.dataset.v);
    });
  }
  $("#f-active").addEventListener("change", (e) => update({ active: e.target.checked }));
  $("#f-email").addEventListener("change", (e) => update({ email: e.target.checked }));
}

function renderFacet(d) {
  const ui = facetUi[d.key];
  const counts = facetCounts(d.key);
  const selected = state[d.key];
  let values = ui.values;
  if (ui.query) values = values.filter((v) => (d.full ? d.full(v) : d.label(v)).toLowerCase().includes(ui.query) || v.toLowerCase().includes(ui.query));
  if (d.key === "schools" || d.key === "states") {
    values = [...values].sort((a, b) => (selected.has(b) - selected.has(a)) || (counts.get(b) || 0) - (counts.get(a) || 0));
  }
  const limit = ui.expanded || ui.query ? 60 : d.limit;
  const visible = values.slice(0, Math.max(limit, [...selected].length));
  $("ul", ui.el).innerHTML = visible.length
    ? visible.map((v) => {
        const n = counts.get(v) || 0;
        const on = selected.has(v);
        return `<li><button type="button" class="opt${n || on ? "" : " zero"}" data-v="${esc(v)}" aria-pressed="${on}" title="${esc(d.full ? d.full(v) : d.label(v))}">
          <span class="box">${ICONS.check}</span>
          <span class="label">${d.swatch ? `<i class="swatch" style="--c:${d.swatch(v)}"></i>` : ""}<span>${esc(d.label(v))}</span></span>
          <span class="n">${fmt(n)}</span></button></li>`;
      }).join("")
    : `<li class="opt zero">No match</li>`;
  const more = $(".more", ui.el);
  const hiddenCount = values.length - visible.length;
  more.hidden = ui.query ? true : !(hiddenCount > 0 || ui.expanded);
  more.textContent = ui.expanded ? "Show fewer" : `Show ${hiddenCount} more`;
}

/* ---------------------------------------------------------------- render */

function renderActive() {
  const tags = [];
  if (state.q) tags.push({ label: `“${state.q}”`, kind: "Search", clear: () => { $("#q").value = ""; update({ q: "" }); } });
  for (const d of FACET_DEFS) for (const v of state[d.key]) tags.push({ label: d.label(v), kind: d.title.split(" ")[0], clear: () => toggle(d.key, v, false) });
  if (state.active) tags.push({ label: "Active faculty only", clear: () => update({ active: false }) });
  if (state.email) tags.push({ label: "Email on profile", clear: () => update({ email: false }) });
  const root = $("#active-filters");
  root.innerHTML = tags.map((t, i) => `<button type="button" class="tag" data-i="${i}" aria-label="Remove filter ${esc(t.label)}">${t.kind ? `<em>${esc(t.kind)}</em>` : ""}${esc(t.label)}${ICONS.x}</button>`).join("") +
    (tags.length > 1 ? `<button type="button" class="link-btn" data-reset>Clear all</button>` : "");
  root.onclick = (e) => {
    const b = e.target.closest(".tag");
    if (b) tags[+b.dataset.i].clear();
    if (e.target.closest("[data-reset]")) { $("#q").value = ""; reset(); }
  };
  const n = filterCount();
  const badge = $("#filters-count");
  badge.hidden = !n;
  badge.textContent = n;
}

function renderCount() {
  const total = people.length;
  $("#results-count").innerHTML = list.length === total
    ? `<b>${fmt(total)}</b> professors`
    : `<b>${fmt(list.length)}</b> ${list.length === 1 ? "professor" : "professors"} <small>of ${fmt(total)}</small>`;
}

function emptyState() {
  return `<div class="empty-state">
    <h3>No one matches all of that — yet</h3>
    <p>Try a broader word, remove a filter, or search for the city instead of the university’s full name.</p>
    <div class="btns">
      ${state.q ? `<button type="button" class="btn" data-empty="q">Clear the search</button>` : ""}
      ${filterCount() ? `<button type="button" class="btn" data-empty="filters">Remove filters</button>` : ""}
      <button type="button" class="btn primary" data-empty="all">Start over</button>
    </div>
    <p style="margin:1.25rem 0 0">Think someone is missing? <button type="button" class="link-btn" data-form="suggest">Suggest a professor</button></p>
  </div>`;
}

function renderResults() {
  list = results();
  shown = 0;
  const grid = $("#grid");
  grid.dataset.view = state.view;
  grid.innerHTML = list.length ? "" : emptyState();
  more();
  renderCount();
}

function more() {
  if (shown >= list.length) return updateMore();
  const ws = words();
  const next = list.slice(shown, shown + BATCH);
  $("#grid").insertAdjacentHTML("beforeend", next.map((p, i) => card(p, i, ws)).join(""));
  shown += next.length;
  updateMore();
}

function updateMore() {
  const btn = $("#load-more");
  const left = list.length - shown;
  btn.hidden = left <= 0 || shown < AUTO_LIMIT;
  btn.textContent = `Show ${Math.min(BATCH, left)} more · ${fmt(left)} to go`;
}

function renderAll() {
  FACET_DEFS.forEach(renderFacet);
  $("#f-active").checked = state.active;
  $("#f-email").checked = state.email;
  $("#sort").value = state.sort;
  $$(".seg [data-view]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.view)));
  if ($("#q") !== document.activeElement) $("#q").value = state.q;
  renderActive();
  renderResults();
}

/* ---------------------------------------------------------------- events */

function bindEvents() {
  const q = $("#q");
  q.addEventListener("input", debounce(() => update({ q: q.value.trim() }), 160));
  q.addEventListener("keydown", (e) => { if (e.key === "Escape" && q.value) { q.value = ""; update({ q: "" }); } });

  $("#sort").addEventListener("change", (e) => update({ sort: e.target.value }));
  $$(".seg [data-view]").forEach((b) => b.addEventListener("click", () => update({ view: b.dataset.view })));
  $("#filters-reset").addEventListener("click", () => { $("#q").value = ""; reset(); });
  $("#share-search").addEventListener("click", async () => {
    const ok = await copyText(absoluteUrl());
    toast(ok ? (hasFilters() ? "Link to this search copied" : "Link to the directory copied") : "Couldn’t copy the link");
  });

  $("#grid").addEventListener("click", (e) => {
    const save = e.target.closest("[data-save]");
    if (save) {
      const on = toggleSaved(save.dataset.save);
      toast(on ? "Saved to your list" : "Removed from your list");
      return;
    }
    const tie = e.target.closest("[data-school]");
    if (tie) {
      toggle("schools", tie.dataset.school, true);
      $("#directory").scrollIntoView({ block: "start" });
      return;
    }
    const empty = e.target.closest("[data-empty]");
    if (empty) {
      const what = empty.dataset.empty;
      if (what === "q" || what === "all") $("#q").value = "";
      if (what === "q") update({ q: "" });
      else if (what === "filters") { FACETS.forEach((f) => state[f].clear()); update({ active: false, email: false }); }
      else reset();
      return;
    }
    if (e.target.closest("a")) return;
    const c = e.target.closest(".card");
    if (c) openProfessor(c.dataset.id, list);
  });

  $("#load-more").addEventListener("click", more);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && shown < list.length && shown < AUTO_LIMIT) more();
    }, { rootMargin: "600px 0px" }).observe($("#sentinel"));
  }

  // Mobile filter sheet
  const filters = $("#filters");
  let backdrop;
  const openSheet = (on) => {
    filters.classList.toggle("open", on);
    document.body.classList.toggle("locked", on);
    if (on) {
      backdrop = document.createElement("div");
      backdrop.className = "panel-backdrop";
      backdrop.style.zIndex = 61;
      backdrop.addEventListener("click", () => openSheet(false));
      document.body.appendChild(backdrop);
      $("#filters-close").focus();
    } else if (backdrop) {
      backdrop.remove();
      backdrop = null;
      $("#filters-open").focus();
    }
  };
  $("#filters-open").addEventListener("click", () => openSheet(true));
  $("#filters-close").addEventListener("click", () => openSheet(false));
  $("#filters-apply").addEventListener("click", () => openSheet(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && filters.classList.contains("open")) openSheet(false);
  });

  // "/" focuses search
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t.closest("input, textarea, select, [contenteditable]")) return;
    e.preventDefault();
    $("#directory").scrollIntoView({ block: "start" });
    q.focus({ preventScroll: true });
  });

  on("filters", renderAll);
  on("saved", ({ id }) => {
    $$(`[data-save="${CSS.escape(id || "")}"]`).forEach((b) => {
      const isOn = saved.has(id);
      b.setAttribute("aria-pressed", String(isOn));
      b.classList.remove("pulse");
      void b.offsetWidth;
      b.classList.add("pulse");
    });
    if (!id) $$("[data-save]").forEach((b) => b.setAttribute("aria-pressed", String(saved.has(b.dataset.save))));
  });
}

export function initDirectory() {
  buildFilters();
  bindEvents();
  renderAll();
}
