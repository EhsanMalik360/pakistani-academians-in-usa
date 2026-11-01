import { $, $$, esc, fmt, plural, initials, shortSchool, toast, copyText, store, ICONS, STATE_NAMES } from "./utils.js";
import {
  people, byId, saved, FIELD_SHORT, LINKS, STATUS, on, only, toggle, toggleSaved, clearSaved,
  writeUrl, absoluteUrl, fieldColor,
} from "./store.js";
import { goToDirectory } from "./viz.js";

const panel = () => $("#panel");
const backdrop = () => $("#panel-backdrop");
let mode = null;
let current = null;
let list = people;
let lastFocus = null;

/* ----------------------------------------------------------------- shell */

function show() {
  const p = panel();
  if (!p.hidden) return;
  lastFocus = document.activeElement;
  p.hidden = false;
  backdrop().hidden = false;
  p.classList.remove("closing");
  backdrop().classList.remove("closing");
  document.body.classList.add("locked");
  requestAnimationFrame(() => p.focus());
}

export function close() {
  const p = panel();
  if (p.hidden) return;
  p.classList.add("closing");
  backdrop().classList.add("closing");
  const done = () => {
    p.hidden = true;
    backdrop().hidden = true;
    p.classList.remove("closing");
    backdrop().classList.remove("closing");
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) done();
  else setTimeout(done, 280);
  document.body.classList.remove("locked");
  mode = null;
  current = null;
  writeUrl(null);
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}

/* ------------------------------------------------------------ professor */

const properLast = (name) => {
  const parts = name.replace(/\(.*?\)/g, "").replace(/,.*$/, "").trim().split(/\s+/);
  return parts[parts.length - 1];
};
const topic = (p) => {
  const first = (p.r || p.f || "").split(/[;,]| and /)[0].trim();
  return first ? first.charAt(0).toLowerCase() + first.slice(1) : "your research";
};

function similar(p) {
  const rw = new Set((p.r || "").toLowerCase().match(/[a-z]{5,}/g) || []);
  return people
    .filter((x) => x.id !== p.id)
    .map((x) => {
      let s = 0;
      if (x.a.some((a) => p.a.includes(a))) s += 3;
      if (x.c === p.c) s += 2;
      if (x.st && x.st === p.st) s += 1;
      const xw = (x.r || "").toLowerCase().match(/[a-z]{5,}/g) || [];
      s += Math.min(3, xw.filter((w) => rw.has(w)).length);
      return [x, s];
    })
    .filter(([, s]) => s >= 4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([x]) => x);
}

function professorHtml(p) {
  const isSaved = saved.has(p.id);
  const badges = [
    `<span class="badge">${esc(STATUS[p.s] || p.s)}</span>`,
    `<span class="badge">${esc(LINKS[p.l] || "Connection to Pakistan")}</span>`,
    p.m ? `<span class="badge mail">Email on profile</span>` : "",
  ].join("");
  const ties = p.a.length
    ? `<ul class="ties" style="margin-top:0.9rem">${p.a.map((s) => `<li><button type="button" class="tie" data-school="${esc(s)}">${esc(s)} · see all alumni</button></li>`).join("")}</ul>`
    : "";
  const sourceUrl = p.e || p.p;
  const quote = p.q
    ? `<blockquote class="p-quote">${esc(p.q)}<cite>From <a href="${esc(sourceUrl)}" target="_blank" rel="noopener">the public source</a></cite></blockquote>`
    : p.e ? `<p style="margin-top:0.75rem"><a href="${esc(p.e)}" target="_blank" rel="noopener">See the public source ${ICONS.external.replace("<svg", '<svg style="display:inline;width:14px;height:14px;vertical-align:-2px"')}</a></p>` : "";
  const sims = similar(p);
  return `
    <div class="p-head" style="--fc:${fieldColor(p)}">
      <span class="avatar" aria-hidden="true">${esc(initials(p.n))}</span>
      <div>
        <p class="eyebrow" style="color:${fieldColor(p)}">${esc(FIELD_SHORT[p.c] || p.c)}</p>
        <h2 id="panel-title">${esc(p.n)}</h2>
      </div>
    </div>
    <div>
      <p class="p-title">${esc(p.t)}</p>
      <p class="p-where">${esc(p.d)}<br><strong>${esc(p.u)}</strong>${p.st ? ` · ${esc(STATE_NAMES[p.st] || p.st)}` : ""}</p>
      <div class="p-badges">${badges}</div>
      <div class="p-actions">
        <a class="btn primary" href="${esc(p.p)}" target="_blank" rel="noopener">Open faculty profile ${ICONS.external}</a>
        <button type="button" class="btn" data-act="save" aria-pressed="${isSaved}">${ICONS.bookmark}<span>${isSaved ? "Saved" : "Save"}</span></button>
        <button type="button" class="btn ghost" data-act="link">${ICONS.link} Copy link</button>
      </div>
    </div>
    <section class="p-section"><h3>Research</h3><p>${esc(p.r)}</p></section>
    <section class="p-section">
      <h3>Connection to Pakistan</h3>
      <p class="p-connection">${esc(p.k)}</p>
      ${ties}
      ${quote}
    </section>
    <section class="p-section">
      <h3>At a glance</h3>
      <dl class="p-dl">
        <dt>University</dt><dd>${esc(p.u)}</dd>
        <dt>Department</dt><dd>${esc(p.d)}</dd>
        ${p.f ? `<dt>Field as listed</dt><dd>${esc(p.f)}</dd>` : ""}
        ${p.st ? `<dt>State</dt><dd>${esc(STATE_NAMES[p.st] || p.st)}</dd>` : ""}
        <dt>Status</dt><dd>${esc(STATUS[p.s] || p.s)}${p.s !== "active" ? " — less likely to take new students" : ""}</dd>
        <dt>Contact</dt><dd>${p.m ? "Their faculty profile publishes an email address." : "Use the contact details on their faculty profile."} We don’t copy emails here.</dd>
      </dl>
    </section>
    <section class="p-section">
      <h3>Draft a first email</h3>
      ${composerHtml(p)}
    </section>
    ${sims.length ? `<section class="p-section"><h3>You might also look at</h3><div class="similar">${sims.map((x) => `
      <button type="button" data-open="${esc(x.id)}" style="--fc:${fieldColor(x)}"><span class="avatar" aria-hidden="true">${esc(initials(x.n))}</span>
      <span><strong>${esc(x.n)}</strong><span>${esc(x.u)}${x.a[0] ? " · " + esc(shortSchool(x.a[0])) : ""}</span></span></button>`).join("")}</div></section>` : ""}
  `;
}

/* ------------------------------------------------------------- composer */

const GOALS = {
  phd: { label: "PhD openings in their group", line: (y) => `I’m planning to apply for PhD programs for fall ${y}.`, ask: (y) => `Are you expecting to take new PhD students for fall ${y}?` },
  ms: { label: "A master’s or research assistant role", line: () => "I’m looking for a master’s or research assistant position in this area.", ask: () => "Might your group have a place for someone at that stage?" },
  advice: { label: "Advice on preparing for research", line: () => "I’m trying to work out how best to prepare for research in this area.", ask: () => "Is there one paper or skill you’d suggest I focus on first?" },
  fit: { label: "Whether my background fits", line: () => "I’m preparing graduate applications in this area.", ask: () => "From your experience, would a background like mine be a reasonable fit for programs like yours?" },
};

function composerHtml(p) {
  const prefs = store("rabta.composer") || {};
  const goal = GOALS[prefs.goal] ? prefs.goal : "phd";
  return `<div class="composer" data-composer>
    <div class="composer-form">
      <label>Your name<input name="name" value="${esc(prefs.name || "")}" placeholder="Ayesha Khan" autocomplete="name"></label>
      <label>You’re studying<input name="program" value="${esc(prefs.program || "")}" placeholder="BS Electrical Engineering, UET Lahore"></label>
      <label class="wide">You’re asking about<select name="goal">${Object.entries(GOALS).map(([k, g]) => `<option value="${k}"${k === goal ? " selected" : ""}>${esc(g.label)}</option>`).join("")}</select></label>
      <label class="wide">Which of their work did you read?<input name="read" placeholder="e.g. their 2024 paper on ${esc(topic(p))}"></label>
      <label class="wide">How does it connect to you? <span style="font-weight:400;color:var(--muted)">(one line)</span><input name="hook" placeholder="e.g. my final-year project uses a similar method"></label>
    </div>
    <div class="composer-preview" data-preview aria-live="polite"></div>
    <div class="composer-bar">
      <span class="meter" data-meter><span class="meter-track"><i></i></span><span data-words></span></span>
      <span style="display:flex;gap:0.5rem;flex-wrap:wrap">
        <button type="button" class="btn small" data-act="copy-email">${ICONS.copy} Copy email</button>
        <a class="btn small primary" href="${esc(p.p)}" target="_blank" rel="noopener">${ICONS.mail} Find their address</a>
      </span>
    </div>
  </div>`;
}

function composeEmail(p, f) {
  const year = new Date().getFullYear() + 1;
  const goal = GOALS[f.goal] || GOALS.phd;
  const programLower = (f.program || "").toLowerCase();
  const shared = p.a.find((s) => {
    const key = shortSchool(s).toLowerCase().replace(/university|college|of|the|,/g, " ").trim().split(/\s+/).filter((w) => w.length > 2);
    return key.length && key.every((w) => programLower.includes(w));
  });
  const gap = (t) => ({ gap: t });
  const name = f.name || gap("[your name]");
  const program = f.program || gap("[your degree and university]");
  const read = f.read || gap(`[a specific paper of theirs on ${topic(p)}]`);
  const hook = f.hook || gap("[one line on why it interests you]");
  const subject = `${shared ? shortSchool(shared) + " student" : "Prospective student"} — a question about your work on ${f.read ? f.read : topic(p)}`;
  const parts = [
    `Dear Professor ${properLast(p.n)},`,
    "\n\n",
    "I’m ", name, ", ", program, ".",
    shared ? ` Like you, I studied at ${shortSchool(shared)}.` : "",
    " I read ", read, ", and it connects with ", hook, ".",
    "\n\n",
    goal.line(year), " ", goal.ask(year),
    "\n\n",
    "Thank you for your time,\n", name,
  ];
  const text = parts.map((x) => (typeof x === "string" ? x : x.gap)).join("");
  const html = parts.map((x) => (typeof x === "string" ? esc(x) : `<span class="gap">${esc(x.gap)}</span>`)).join("");
  const body = text.replace(/^Dear[^\n]*\n\n/, "");
  const count = body.split(/\s+/).filter(Boolean).length;
  return { subject, text, html, count, missing: parts.some((x) => typeof x !== "string") };
}

function bindComposer(p) {
  const root = $("[data-composer]", panel());
  if (!root) return;
  const read = () => Object.fromEntries($$("input, select", root).map((el) => [el.name, el.value.trim()]));
  const render = () => {
    const f = read();
    store("rabta.composer", { name: f.name, program: f.program, goal: f.goal });
    const mail = composeEmail(p, f);
    $("[data-preview]", root).innerHTML = `<span class="subj">Subject: ${esc(mail.subject)}</span>${mail.html}`;
    const pct = Math.min(100, (mail.count / 150) * 100);
    $("[data-meter] i", root).style.width = pct + "%";
    $("[data-meter]", root).classList.toggle("over", mail.count > 150);
    $("[data-words]", root).textContent = `${mail.count} / 150 words`;
    root._mail = mail;
  };
  root.addEventListener("input", render);
  render();
}

/* ------------------------------------------------------------- saved list */

function savedHtml() {
  const items = [...saved].map((id) => byId.get(id)).filter(Boolean);
  if (!items.length) {
    return `<div class="saved-head"><h2 id="panel-title">Your saved list</h2></div>
      <div class="saved-empty">${ICONS.bookmark}<p>Nothing saved yet. Use the bookmark on any professor to build a shortlist you can export or share.</p></div>`;
  }
  return `<div class="saved-head">
      <h2 id="panel-title">Your saved list</h2>
      <p>${plural(items.length, "professor")} · stored only in this browser</p>
      <div class="p-actions">
        <button type="button" class="btn primary" data-act="csv">${ICONS.download} Download CSV</button>
        <button type="button" class="btn" data-act="copy-list">${ICONS.copy} Copy as text</button>
        <button type="button" class="btn ghost" data-act="clear">Clear list</button>
      </div>
    </div>
    <ul class="saved-list">${items.map((p, i) => `
      <li style="--fc:${fieldColor(p)};animation-delay:${i * 30}ms">
        <span class="avatar" aria-hidden="true">${esc(initials(p.n))}</span>
        <button type="button" class="who" data-open="${esc(p.id)}"><strong>${esc(p.n)}</strong><span>${esc(p.u)}${p.a[0] ? " · " + esc(shortSchool(p.a[0])) : ""}</span></button>
        <button type="button" class="icon-btn" data-remove="${esc(p.id)}" aria-label="Remove ${esc(p.n)}">${ICONS.x}</button>
      </li>`).join("")}
    </ul>`;
}

function csv(items) {
  const cols = [["Name", "n"], ["Title", "t"], ["University", "u"], ["Department", "d"], ["State", "st"], ["Field", "c"], ["Research", "r"], ["Studied in Pakistan at", "a"], ["Connection to Pakistan", "k"], ["Faculty profile", "p"]];
  const cell = (v) => `"${String(Array.isArray(v) ? v.join("; ") : v ?? "").replace(/"/g, '""')}"`;
  return [cols.map(([h]) => cell(h)).join(","), ...items.map((p) => cols.map(([, k]) => cell(p[k])).join(","))].join("\r\n");
}

/* ------------------------------------------------------------ open views */

export function openProfessor(id, fromList) {
  const p = byId.get(id);
  if (!p) return;
  if (fromList && fromList.length) list = fromList.some((x) => x.id === id) ? fromList : people;
  mode = "prof";
  current = p;
  show();
  $("#panel-nav").hidden = false;
  const body = $("#panel-body");
  body.innerHTML = professorHtml(p);
  body.scrollTop = 0;
  bindComposer(p);
  const idx = list.findIndex((x) => x.id === id);
  $("#panel-prev").disabled = idx <= 0;
  $("#panel-next").disabled = idx < 0 || idx >= list.length - 1;
  $("#panel-pos").textContent = idx >= 0 ? `${fmt(idx + 1)} of ${fmt(list.length)}` : "";
  panel().setAttribute("aria-label", p.n);
  writeUrl(p.id);
}

export function openSavedList() {
  mode = "saved";
  current = null;
  show();
  $("#panel-nav").hidden = true;
  $("#panel-body").innerHTML = savedHtml();
  panel().setAttribute("aria-label", "Saved professors");
  writeUrl(null);
}

function step(dir) {
  if (mode !== "prof" || !current) return;
  const idx = list.findIndex((x) => x.id === current.id);
  const next = list[idx + dir];
  if (next) openProfessor(next.id, list);
}

/* ---------------------------------------------------------------- events */

export function initPanel() {
  $("#panel-close").addEventListener("click", close);
  $("#panel-backdrop").addEventListener("click", close);
  $("#panel-prev").addEventListener("click", () => step(-1));
  $("#panel-next").addEventListener("click", () => step(1));
  $("#open-saved").addEventListener("click", openSavedList);

  panel().addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    const typing = e.target.closest("input, textarea, select");
    if (!typing && e.key === "ArrowRight") step(1);
    if (!typing && e.key === "ArrowLeft") step(-1);
    if (e.key === "Tab") {
      const f = $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', panel()).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel())) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  $("#panel-body").addEventListener("click", async (e) => {
    const t = e.target.closest("[data-act], [data-open], [data-school], [data-remove]");
    if (!t) return;
    if (t.dataset.open) return openProfessor(t.dataset.open, mode === "saved" ? [...saved].map((id) => byId.get(id)).filter(Boolean) : list);
    if (t.dataset.school) {
      only("schools", t.dataset.school);
      close();
      goToDirectory();
      return;
    }
    if (t.dataset.remove) {
      toggleSaved(t.dataset.remove);
      $("#panel-body").innerHTML = savedHtml();
      return;
    }
    const act = t.dataset.act;
    if (act === "save" && current) {
      const isOn = toggleSaved(current.id);
      t.setAttribute("aria-pressed", String(isOn));
      $("span", t).textContent = isOn ? "Saved" : "Save";
      toast(isOn ? "Saved to your list" : "Removed from your list");
    } else if (act === "link" && current) {
      toast((await copyText(absoluteUrl(current.id))) ? "Link to this professor copied" : "Couldn’t copy the link");
    } else if (act === "copy-email") {
      const mail = $("[data-composer]", panel())._mail;
      if (!mail) return;
      const ok = await copyText(`Subject: ${mail.subject}\n\n${mail.text}`);
      toast(!ok ? "Couldn’t copy the email" : mail.missing ? "Copied — fill in the highlighted parts first" : "Email copied. Paste it into your mail app");
    } else if (act === "csv") {
      const items = [...saved].map((id) => byId.get(id)).filter(Boolean);
      const blob = new Blob(["\ufeff" + csv(items)], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "rabta-saved-professors.csv";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } else if (act === "copy-list") {
      const items = [...saved].map((id) => byId.get(id)).filter(Boolean);
      const text = items.map((p) => `${p.n} — ${p.t}, ${p.u}\n${p.p}`).join("\n\n");
      toast((await copyText(text)) ? "List copied" : "Couldn’t copy the list");
    } else if (act === "clear") {
      if (confirm("Remove everyone from your saved list?")) {
        clearSaved();
        $("#panel-body").innerHTML = savedHtml();
      }
    }
  });

  on("open", ({ id, list: l }) => openProfessor(id, l));
  on("saved", () => {
    const n = saved.size;
    const el = $("#saved-count");
    el.textContent = n;
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  });
  $("#saved-count").textContent = saved.size;
}
