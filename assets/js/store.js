import { STATE_NAMES, store } from "./utils.js";

export const META = window.DIRECTORY_META || {};
export const CONFIG = window.RABTA_CONFIG || {};

export const FIELDS = [
  "Medicine and public health",
  "Computer science",
  "Engineering",
  "Natural sciences and mathematics",
  "Economics and finance",
  "Business and management",
  "Humanities and social sciences",
  "Education",
  "Law",
];
export const FIELD_SHORT = {
  "Medicine and public health": "Medicine & health",
  "Computer science": "Computer science",
  Engineering: "Engineering",
  "Natural sciences and mathematics": "Sciences & maths",
  "Economics and finance": "Economics & finance",
  "Business and management": "Business",
  "Humanities and social sciences": "Humanities & social sci.",
  Education: "Education",
  Law: "Law",
};
export const LINKS = {
  born: "Born in Pakistan",
  origin: "Pakistani heritage",
  educated: "Studied in Pakistan",
  multiple: "Several ties",
};
export const STATUS = { active: "Active faculty", emeritus: "Emeritus", adjunct: "Adjunct", visiting: "Visiting" };

const lastName = (n) => n.replace(/\(.*?\)/g, "").trim().split(/\s+/).pop().toLowerCase();

export const people = (window.PROFESSORS || []).map((p, i) => {
  let fi = FIELDS.indexOf(p.c);
  if (fi === -1) {
    FIELDS.push(p.c);
    fi = FIELDS.length - 1;
  }
  const a = p.a || [];
  return {
    ...p,
    a,
    i,
    fi: fi % 9,
    st: p.st || "",
    l: p.l || "educated",
    last: lastName(p.n),
    hay: [p.n, p.u, p.d, p.t, p.r, p.f, p.k, a.join(" "), STATE_NAMES[p.st] || ""].join(" ").toLowerCase(),
  };
});
people.sort((x, y) => x.last.localeCompare(y.last) || x.n.localeCompare(y.n));
export const byId = new Map(people.map((p) => [p.id, p]));

export const fieldColor = (p) => `var(--f${p.fi})`;

/* ------------------------------------------------------------------ state */

export const state = {
  q: "",
  fields: new Set(),
  schools: new Set(),
  states: new Set(),
  links: new Set(),
  active: false,
  email: false,
  sort: "relevance",
  view: "cards",
};
export const FACETS = ["fields", "schools", "states", "links"];

export const bus = new EventTarget();
const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export const on = (type, fn) => bus.addEventListener(type, (e) => fn(e.detail));

export function update(patch, { silent = false } = {}) {
  Object.assign(state, patch);
  if (!silent) changed();
}

export function toggle(facet, value, force) {
  const set = state[facet];
  const want = force ?? !set.has(value);
  if (want) set.add(value);
  else set.delete(value);
  changed();
}

export function only(facet, value) {
  FACETS.forEach((f) => state[f].clear());
  state.q = "";
  state.active = false;
  state.email = false;
  state[facet].add(value);
  changed();
}

export function reset() {
  FACETS.forEach((f) => state[f].clear());
  Object.assign(state, { q: "", active: false, email: false });
  changed();
}

function changed() {
  writeUrl();
  emit("filters");
}

export const filterCount = () =>
  FACETS.reduce((n, f) => n + state[f].size, 0) + (state.active ? 1 : 0) + (state.email ? 1 : 0);
export const hasFilters = () => filterCount() > 0 || Boolean(state.q);
export const words = () => state.q.toLowerCase().split(/\s+/).filter(Boolean);

function matches(p, skip, ws) {
  if (skip !== "fields" && state.fields.size && !state.fields.has(p.c)) return false;
  if (skip !== "schools" && state.schools.size && !p.a.some((s) => state.schools.has(s))) return false;
  if (skip !== "states" && state.states.size && !state.states.has(p.st)) return false;
  if (skip !== "links" && state.links.size && !state.links.has(p.l)) return false;
  if (state.active && p.s !== "active") return false;
  if (state.email && !p.m) return false;
  if (ws.length && !ws.every((w) => p.hay.includes(w))) return false;
  return true;
}

function score(p, ws) {
  let s = 0;
  const name = p.n.toLowerCase();
  const research = (p.r + " " + p.f).toLowerCase();
  for (const w of ws) {
    if (name.includes(w)) s += name.startsWith(w) || name.includes(" " + w) ? 12 : 6;
    if (research.includes(w)) s += 5;
    if (p.u.toLowerCase().includes(w)) s += 3;
    if (p.a.join(" ").toLowerCase().includes(w)) s += 3;
  }
  return s;
}

export function results() {
  const ws = words();
  const list = people.filter((p) => matches(p, null, ws));
  const by = state.sort;
  if (by === "relevance" && ws.length) {
    const scores = new Map(list.map((p) => [p, score(p, ws)]));
    list.sort((a, b) => scores.get(b) - scores.get(a) || a.last.localeCompare(b.last));
  } else if (by === "university") {
    list.sort((a, b) => a.u.localeCompare(b.u) || a.last.localeCompare(b.last));
  } else if (by === "field") {
    list.sort((a, b) => a.fi - b.fi || a.last.localeCompare(b.last));
  }
  return list;
}

/** Counts for each value of a facet, given every other active filter. */
export function facetCounts(facet) {
  const ws = words();
  const counts = new Map();
  for (const p of people) {
    if (!matches(p, facet, ws)) continue;
    const values = facet === "fields" ? [p.c] : facet === "schools" ? p.a : facet === "states" ? [p.st] : [p.l];
    for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return counts;
}

/** Totals across the whole directory, for the visualisations. */
export function totals(key) {
  const counts = new Map();
  for (const p of people) {
    const values = key === "schools" ? p.a : key === "states" ? [p.st] : key === "fields" ? [p.c] : [p[key]];
    for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/* -------------------------------------------------------------------- url */

const PARAMS = { q: "q", fields: "field", schools: "school", states: "state", links: "link" };

export function readUrl() {
  const u = new URLSearchParams(location.search);
  state.q = u.get("q") || "";
  for (const f of FACETS) {
    state[f] = new Set(u.getAll(PARAMS[f]).filter(Boolean));
  }
  state.active = u.get("active") === "1";
  state.email = u.get("email") === "1";
  state.sort = ["relevance", "name", "university", "field"].includes(u.get("sort")) ? u.get("sort") : "relevance";
  state.view = u.get("view") === "list" ? "list" : "cards";
  return u.get("p");
}

export function urlFor({ open } = {}) {
  const u = new URLSearchParams();
  if (state.q) u.set("q", state.q);
  for (const f of FACETS) for (const v of state[f]) u.append(PARAMS[f], v);
  if (state.active) u.set("active", "1");
  if (state.email) u.set("email", "1");
  if (state.sort !== "relevance") u.set("sort", state.sort);
  if (state.view !== "cards") u.set("view", state.view);
  if (open) u.set("p", open);
  const qs = u.toString();
  return location.pathname + (qs ? "?" + qs : "") + location.hash;
}

let openId = null;
export function writeUrl(open = openId) {
  openId = open;
  history.replaceState(null, "", urlFor({ open }));
}
export const absoluteUrl = (open) => new URL(urlFor({ open }), location.href).href;

/* ------------------------------------------------------------------ saved */

export const saved = new Set((store("rabta.saved") || []).filter((id) => byId.has(id)));

export function toggleSaved(id) {
  if (saved.has(id)) saved.delete(id);
  else saved.add(id);
  store("rabta.saved", [...saved]);
  emit("saved", { id, on: saved.has(id) });
  return saved.has(id);
}

export function clearSaved() {
  saved.clear();
  store("rabta.saved", []);
  emit("saved", {});
}

/* -------------------------------------------------------------- selection */

export const openProfessor = (id, list) => emit("open", { id, list });
export const openSaved = () => emit("open-saved");
