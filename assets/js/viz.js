import { $, $$, esc, fmt, plural, cssVar, onVisible, animateNumber, reducedMotion, shortSchool, STATE_NAMES } from "./utils.js";
import { people, FIELDS, FIELD_SHORT, META, totals, only, openProfessor } from "./store.js";

export function goToDirectory() {
  $("#directory").scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
}

/* ==========================================================================
   Night sky: one point of light per professor, clustered by field
   ========================================================================== */
export function initSky() {
  const canvas = $("#sky-canvas");
  const tip = $("#sky-tip");
  const wrap = $("#sky");
  const ctx = canvas.getContext("2d");
  const motion = !reducedMotion();
  const glow = FIELDS.map((_, i) => cssVar(`--g${i % 9}`) || "#9fd");
  const muted = cssVar("--night-muted") || "#93A89C";

  let W = 0, H = 0, dpr = 1;
  let dots = [];
  let clusters = [];
  let hover = null;
  let focusField = null;
  let started = 0;
  let running = false;
  let visible = true;

  const byField = FIELDS.map((f) => people.filter((p) => p.c === f)).filter((g) => g.length);

  function layout() {
    const rect = wrap.getBoundingClientRect();
    W = Math.max(280, rect.width);
    H = Math.max(260, rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const spacing = Math.max(5.2, Math.min(8.5, Math.sqrt((W * H * 0.34) / people.length)));
    clusters = byField.map((group, gi) => {
      const r = spacing * Math.sqrt(group.length) * 0.56 + 8;
      const angle = gi * 2.399963;
      const d = gi === 0 ? 0 : Math.min(W, H) * 0.18 * Math.sqrt(gi);
      return { group, r, x: W * 0.5 + Math.cos(angle) * d, y: H * 0.47 + Math.sin(angle) * d * 0.8, field: group[0].c, fi: group[0].fi };
    });
    // Relax overlapping clusters and keep them inside the canvas.
    for (let k = 0; k < 400; k++) {
      for (let a = 0; a < clusters.length; a++) {
        const A = clusters[a];
        for (let b = a + 1; b < clusters.length; b++) {
          const B = clusters[b];
          const dx = B.x - A.x, dy = B.y - A.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          const min = A.r + B.r + 26;
          if (dist < min) {
            const push = (min - dist) / 2;
            const ux = dx / dist, uy = dy / dist;
            const wa = B.r / (A.r + B.r), wb = A.r / (A.r + B.r);
            A.x -= ux * push * wa * 2; A.y -= uy * push * wa * 2;
            B.x += ux * push * wb * 2; B.y += uy * push * wb * 2;
          }
        }
        A.x += (W * 0.5 - A.x) * 0.004;
        A.y += (H * 0.48 - A.y) * 0.004;
        A.x = Math.min(W - A.r - 8, Math.max(A.r + 8, A.x));
        A.y = Math.min(H - A.r - 28, Math.max(A.r + 22, A.y));
      }
    }

    const prev = new Map(dots.map((d) => [d.p.id, d]));
    dots = [];
    clusters.forEach((c) => {
      const n = c.group.length;
      c.group.forEach((p, j) => {
        const rr = c.r * Math.sqrt((j + 0.5) / n) * 0.94;
        const th = j * 2.399963 + c.fi;
        const old = prev.get(p.id);
        const tx = c.x + Math.cos(th) * rr;
        const ty = c.y + Math.sin(th) * rr;
        dots.push({
          p, tx, ty,
          sx: old ? old.x : W * 0.5 + (Math.random() - 0.5) * W * 1.1,
          sy: old ? old.y : H * 0.5 + (Math.random() - 0.5) * H * 1.1,
          x: tx, y: ty,
          r: p.s === "active" ? 1.9 : 1.4,
          phase: Math.random() * Math.PI * 2,
          speed: 0.6 + Math.random() * 1.4,
          delay: old ? 0 : Math.random() * 600 + (j / n) * 500,
          color: glow[p.fi],
        });
      });
    });
    started = performance.now();
    draw(started);
  }

  function draw(now) {
    const t = now - started;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    for (const d of dots) {
      const k = motion ? Math.min(1, Math.max(0, (t - d.delay) / 1400)) : 1;
      const e = 1 - Math.pow(1 - k, 3);
      const drift = motion ? Math.sin(now / 1800 + d.phase) * 0.8 : 0;
      d.x = d.sx + (d.tx - d.sx) * e + drift;
      d.y = d.sy + (d.ty - d.sy) * e + (motion ? Math.cos(now / 2100 + d.phase) * 0.8 : 0);
      const tw = motion ? 0.62 + 0.38 * Math.sin(now / 1000 * d.speed + d.phase) : 0.9;
      const dim = focusField && d.p.c !== focusField ? 0.14 : 1;
      ctx.globalAlpha = tw * dim * (0.25 + 0.75 * e);
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
      if (dim === 1 && d.p.s === "active") {
        ctx.globalAlpha *= 0.18;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";

    // Cluster labels
    const labelAlpha = motion ? Math.min(1, Math.max(0, (t - 900) / 700)) : 1;
    ctx.font = '500 10.5px "IBM Plex Mono", monospace';
    ctx.textAlign = "center";
    for (const c of clusters) {
      const dim = focusField && c.field !== focusField ? 0.25 : 1;
      ctx.globalAlpha = labelAlpha * dim;
      ctx.fillStyle = muted;
      const label = (FIELD_SHORT[c.field] || c.field).toUpperCase();
      ctx.fillText(label, c.x, c.y - c.r - 9);
    }
    ctx.globalAlpha = 1;

    if (hover) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(hover.x, hover.y, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(hover.x, hover.y, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function loop(now) {
    if (!visible) { running = false; return; }
    draw(now);
    if (motion) requestAnimationFrame(loop);
    else running = false;
  }
  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
  }

  function nearest(mx, my) {
    let best = null, bd = 196;
    for (const d of dots) {
      if (focusField && d.p.c !== focusField) continue;
      const dd = (d.x - mx) ** 2 + (d.y - my) ** 2;
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  function showTip(d) {
    if (!d) { tip.hidden = true; return; }
    const p = d.p;
    tip.innerHTML =
      `<strong>${esc(p.n)}</strong><span>${esc(p.u)}</span>` +
      (p.a.length ? `<span>Studied at ${esc(p.a.map(shortSchool).join(", "))}</span>` : "") +
      `<em style="color:${d.color}">${esc(FIELD_SHORT[p.c] || p.c)}</em>`;
    tip.hidden = false;
    const x = Math.min(Math.max(d.x, 110), W - 110);
    tip.style.left = x + "px";
    tip.style.top = d.y + "px";
    if (d.y < 120) tip.style.transform = "translate(-50%, 18px)";
    else tip.style.transform = "";
  }

  let lastTouch = null;
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const r = canvas.getBoundingClientRect();
    hover = nearest(e.clientX - r.left, e.clientY - r.top);
    canvas.style.cursor = hover ? "pointer" : "crosshair";
    showTip(hover);
    if (!motion) draw(performance.now());
  });
  canvas.addEventListener("pointerleave", () => {
    hover = null;
    showTip(null);
    if (!motion) draw(performance.now());
  });
  canvas.addEventListener("click", (e) => {
    const r = canvas.getBoundingClientRect();
    const d = nearest(e.clientX - r.left, e.clientY - r.top);
    if (!d) return;
    if (e.pointerType === "touch" || lastTouch === "touch") {
      if (hover !== d) {
        hover = d;
        showTip(d);
        return;
      }
    }
    openProfessor(d.p.id, people);
  });
  canvas.addEventListener("pointerdown", (e) => { lastTouch = e.pointerType; });

  const ro = new ResizeObserver(() => layout());
  ro.observe(wrap);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    }).observe(wrap);
  }
  layout();
  start();

  return {
    focus(field) {
      focusField = field;
      if (!motion) draw(performance.now());
    },
  };
}

export function initLegend(sky) {
  const ul = $("#sky-legend");
  const counts = new Map(totals("fields"));
  ul.innerHTML = FIELDS.filter((f) => counts.get(f))
    .map((f, i) => `<li><button type="button" data-field="${esc(f)}" style="color:var(--g${FIELDS.indexOf(f) % 9})"><i></i><span style="color:var(--night-ink)">${esc(FIELD_SHORT[f] || f)}</span><small>${fmt(counts.get(f))}</small></button></li>`)
    .join("");
  ul.addEventListener("mouseover", (e) => {
    const b = e.target.closest("button");
    if (b) sky.focus(b.dataset.field);
  });
  ul.addEventListener("mouseleave", () => sky.focus(null));
  ul.addEventListener("focusin", (e) => {
    const b = e.target.closest("button");
    if (b) sky.focus(b.dataset.field);
  });
  ul.addEventListener("focusout", () => sky.focus(null));
  ul.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    only("fields", b.dataset.field);
    goToDirectory();
  });
}

/* ==========================================================================
   Numbers
   ========================================================================== */
export function initStats() {
  const unis = new Set(people.map((p) => p.u)).size;
  const states = new Set(people.map((p) => p.st).filter(Boolean)).size;
  const schools = new Set(people.flatMap((p) => p.a)).size;
  const items = [
    [people.length, "professors listed, each with a public source"],
    [unis, "US universities and medical schools"],
    [states, "states plus Washington, DC"],
    [schools, "Pakistani institutions they studied at"],
    [META.universitiesChecked || 0, "US universities checked, department by department"],
  ].filter(([n]) => n > 0);
  const root = $("#stats");
  root.innerHTML = items.map(([n, label]) => `<div class="stat"><div class="stat-num" data-to="${n}">0</div><p class="stat-label">${esc(label)}</p></div>`).join("");
  onVisible(root, () => $$(".stat-num", root).forEach((el, i) => setTimeout(() => animateNumber(el, +el.dataset.to), i * 90)));
  $("#hero-lede").textContent = `${fmt(people.length)} faculty at US universities who were born, raised or educated in Pakistan — searchable by the Pakistani university they attended, their field, and where they teach now.`;
}

/* ==========================================================================
   Bridge: Pakistani institutions -> US states
   ========================================================================== */
export function initBridge() {
  const root = $("#bridge-chart");
  const schoolTotals = totals("schools");
  const TOP = 10;
  const leftKeys = schoolTotals.slice(0, TOP).map(([s]) => s);

  const flows = new Map();
  const stateSum = new Map();
  for (const p of people) {
    for (const s of p.a) {
      if (!leftKeys.includes(s) || !p.st) continue;
      const key = s + "|" + p.st;
      flows.set(key, (flows.get(key) || 0) + 1);
      stateSum.set(p.st, (stateSum.get(p.st) || 0) + 1);
    }
  }
  const rightKeys = [...stateSum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 9).map(([s]) => s);
  const OTHER = "__other";
  const rightOf = (st) => (rightKeys.includes(st) ? st : OTHER);
  const links = new Map();
  for (const [key, n] of flows) {
    const [s, st] = key.split("|");
    const k = s + "|" + rightOf(st);
    links.set(k, (links.get(k) || 0) + n);
  }
  const rights = [...rightKeys, OTHER];

  function svg() {
    const W = 1000, H = 640, padT = 44, padB = 12, gap = 12;
    const total = [...links.values()].reduce((a, b) => a + b, 0);
    const scaleL = (H - padT - padB - gap * (leftKeys.length - 1)) / total;
    const scaleR = (H - padT - padB - gap * (rights.length - 1)) / total;
    const scale = Math.min(scaleL, scaleR);
    const lx = 300, rx = 700, nw = 10;

    const sumBy = (side, key) => [...links.entries()].filter(([k]) => k.split("|")[side] === key).reduce((a, [, n]) => a + n, 0);
    const stack = (keys, side) => {
      const sizes = keys.map((k) => sumBy(side, k) * scale);
      const used = sizes.reduce((a, b) => a + b, 0) + gap * (keys.length - 1);
      let y = padT + (H - padT - padB - used) / 2;
      return keys.map((k, i) => {
        const node = { key: k, y, h: sizes[i], n: sumBy(side, k), off: 0 };
        y += sizes[i] + gap;
        return node;
      });
    };
    const L = stack(leftKeys, 0);
    const R = stack(rights, 1);
    const Lm = new Map(L.map((n) => [n.key, n]));
    const Rm = new Map(R.map((n) => [n.key, n]));

    const ordered = [...links.entries()]
      .map(([k, n]) => ({ s: k.split("|")[0], t: k.split("|")[1], n }))
      .sort((a, b) => leftKeys.indexOf(a.s) - leftKeys.indexOf(b.s) || rights.indexOf(a.t) - rights.indexOf(b.t));
    const byTarget = [...ordered].sort((a, b) => rights.indexOf(a.t) - rights.indexOf(b.t) || leftKeys.indexOf(a.s) - leftKeys.indexOf(b.s));
    byTarget.forEach((l) => {
      const t = Rm.get(l.t);
      l.ty = t.y + t.off;
      t.off += l.n * scale;
    });
    let bands = "";
    ordered.forEach((l, i) => {
      const s = Lm.get(l.s);
      const h = l.n * scale;
      const y0 = s.y + s.off;
      s.off += h;
      const y1 = l.ty;
      const x0 = lx + nw, x1 = rx, mx = (x0 + x1) / 2;
      bands += `<path class="band" data-s="${esc(l.s)}" data-t="${esc(l.t)}" style="animation-delay:${i * 12}ms" d="M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1} L${x1},${y1 + h} C${mx},${y1 + h} ${mx},${y0 + h} ${x0},${y0 + h} Z"><title>${esc(shortSchool(l.s))} → ${esc(l.t === OTHER ? "other states" : STATE_NAMES[l.t])}: ${l.n}</title></path>`;
    });
    const nodeL = L.map((n) => `<g class="node left" tabindex="0" role="button" data-s="${esc(n.key)}" aria-label="${esc(n.key)}: ${n.n} professors. Show them">
        <rect x="${lx}" y="${n.y}" width="${nw}" height="${Math.max(2, n.h)}" rx="2"/>
        <text x="${lx - 14}" y="${n.y + n.h / 2}" text-anchor="end" dominant-baseline="middle">${esc(shortSchool(n.key))}<tspan class="count" dx="8">${n.n}</tspan></text>
      </g>`).join("");
    const nodeR = R.map((n) => {
      const label = n.key === OTHER ? "Other states" : STATE_NAMES[n.key];
      return `<g class="node right" tabindex="0" role="button" data-t="${esc(n.key)}" aria-label="${esc(label)}: ${n.n} links. Show professors">
        <rect x="${rx}" y="${n.y}" width="${nw}" height="${Math.max(2, n.h)}" rx="2"/>
        <text x="${rx + nw + 14}" y="${n.y + n.h / 2}" dominant-baseline="middle">${esc(label)}<tspan class="count" dx="8">${n.n}</tspan></text>
      </g>`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Flow from the ten largest Pakistani institutions to the US states where their graduates teach">
      <text class="col-title" x="${lx + nw}" y="14" text-anchor="end">Studied in Pakistan at</text>
      <text class="col-title" x="${rx}" y="14">Teaching today in</text>
      <g class="bands">${bands}</g>${nodeL}${nodeR}</svg>`;
  }

  function bars() {
    const max = schoolTotals[0]?.[1] || 1;
    return `<ul class="bars">${schoolTotals.slice(0, 12).map(([s, n]) => {
      const st = totalsFor(s);
      return `<li><button type="button" data-s="${esc(s)}"><span class="bar-name">${esc(shortSchool(s))}</span><span class="bar-count">${n}</span>
        <span class="bar-track"><i style="width:${(n / max) * 100}%"></i></span>
        <span class="bar-where">Mostly in ${esc(st.join(" · "))}</span></button></li>`;
    }).join("")}</ul>`;
  }
  function totalsFor(school) {
    const m = new Map();
    people.forEach((p) => { if (p.a.includes(school) && p.st) m.set(p.st, (m.get(p.st) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => STATE_NAMES[s] || s);
  }

  let mode = "";
  let shown = false;
  function render() {
    const want = root.clientWidth < 700 ? "bars" : "svg";
    if (want === mode) return;
    mode = want;
    root.innerHTML = want === "svg" ? svg() : bars();
    if (shown) $$(".band", root).forEach((b) => b.classList.add("draw"));
  }
  render();
  new ResizeObserver(() => render()).observe(root);
  onVisible(root, () => {
    shown = true;
    $$(".band", root).forEach((b) => b.classList.add("draw"));
  }, { threshold: 0.25 });

  const focus = (g) => {
    if (!g || mode !== "svg") return;
    root.dataset.focus = "1";
    const s = g.dataset.s, t = g.dataset.t;
    const hotS = new Set(), hotT = new Set();
    $$(".band", root).forEach((b) => {
      const hot = Boolean((s && b.dataset.s === s) || (t && b.dataset.t === t));
      b.classList.toggle("hot", hot);
      if (hot) { hotS.add(b.dataset.s); hotT.add(b.dataset.t); }
    });
    $$(".node", root).forEach((n) => n.classList.toggle("hot", Boolean(hotS.has(n.dataset.s) || hotT.has(n.dataset.t))));
  };
  const blur = () => {
    delete root.dataset.focus;
    $$(".hot", root).forEach((n) => n.classList.remove("hot"));
  };
  root.addEventListener("mouseover", (e) => focus(e.target.closest(".node")));
  root.addEventListener("mouseleave", blur);
  root.addEventListener("focusin", (e) => focus(e.target.closest(".node")));
  root.addEventListener("focusout", blur);
  const activate = (el) => {
    if (!el) return;
    if (el.dataset.s) only("schools", el.dataset.s);
    else if (el.dataset.t && el.dataset.t !== OTHER) only("states", el.dataset.t);
    else return;
    goToDirectory();
  };
  root.addEventListener("click", (e) => activate(e.target.closest(".node, .bars button")));
  root.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest(".node")) {
      e.preventDefault();
      activate(e.target.closest(".node"));
    }
  });

  initCombo(schoolTotals);
}

function initCombo(schoolTotals) {
  const input = $("#school-input");
  const list = $("#school-options");
  let options = [];
  let active = -1;

  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  function renderList() {
    const q = norm(input.value).trim();
    options = schoolTotals.filter(([s]) => !q || norm(s).includes(q)).slice(0, 40);
    active = options.length ? 0 : -1;
    list.innerHTML = options.length
      ? options.map(([s, n], i) => `<li role="option" id="school-opt-${i}" data-i="${i}" aria-selected="${i === active}">${esc(s)}<small>${n}</small></li>`).join("")
      : `<li class="none" role="option" aria-disabled="true">No match yet — try the city or a shorter name</li>`;
    open(true);
  }
  function open(on) {
    list.hidden = !on;
    input.setAttribute("aria-expanded", String(on));
  }
  function setActive(i) {
    active = Math.max(0, Math.min(options.length - 1, i));
    $$("li", list).forEach((li, j) => li.setAttribute("aria-selected", String(j === active)));
    const el = $(`#school-opt-${active}`);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
      input.setAttribute("aria-activedescendant", el.id);
    }
  }
  function choose(i) {
    const opt = options[i];
    if (!opt) return;
    input.value = opt[0];
    open(false);
    only("schools", opt[0]);
    goToDirectory();
  }
  input.addEventListener("input", renderList);
  input.addEventListener("focus", renderList);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); list.hidden ? renderList() : setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter") { e.preventDefault(); choose(active); }
    else if (e.key === "Escape") open(false);
  });
  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-i]");
    if (li) { e.preventDefault(); choose(+li.dataset.i); }
  });
  input.addEventListener("blur", () => setTimeout(() => open(false), 120));
}

/* ==========================================================================
   Tile map of US states
   ========================================================================== */
const TILES = {
  AK: [0, 0], ME: [11, 0],
  VT: [10, 1], NH: [11, 1],
  WA: [1, 2], ID: [2, 2], MT: [3, 2], ND: [4, 2], MN: [5, 2], IL: [6, 2], WI: [7, 2], MI: [8, 2], NY: [9, 2], RI: [10, 2], MA: [11, 2],
  OR: [1, 3], NV: [2, 3], WY: [3, 3], SD: [4, 3], IA: [5, 3], IN: [6, 3], OH: [7, 3], PA: [8, 3], NJ: [9, 3], CT: [10, 3],
  CA: [1, 4], UT: [2, 4], CO: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], DE: [10, 4],
  AZ: [2, 5], NM: [3, 5], KS: [4, 5], AR: [5, 5], TN: [6, 5], NC: [7, 5], SC: [8, 5], DC: [9, 5],
  OK: [4, 6], LA: [5, 6], MS: [6, 6], AL: [7, 6], GA: [8, 6],
  HI: [0, 7], TX: [4, 7], FL: [9, 7],
};
const STEPS = [0, 1, 6, 15, 30, 80];
const MIX = [0, 14, 30, 48, 70, 92];

export function initMap() {
  const root = $("#tilemap");
  const panel = $("#map-panel");
  const counts = new Map(totals("states"));
  const level = (n) => STEPS.reduce((lv, s, i) => (n >= s ? i : lv), 0);

  const cells = [];
  for (let row = 0; row < 8; row++) for (let col = 0; col < 12; col++) cells.push([col, row]);
  const at = new Map(Object.entries(TILES).map(([st, [c, r]]) => [c + "," + r, st]));
  root.innerHTML = cells.map(([c, r], i) => {
    const st = at.get(c + "," + r);
    if (!st) return `<span aria-hidden="true"></span>`;
    const n = counts.get(st) || 0;
    const lv = level(n);
    const bg = lv ? `color-mix(in srgb, var(--accent) ${MIX[lv]}%, var(--surface))` : "var(--surface)";
    const ink = lv >= 4 ? "var(--accent-ink)" : "var(--ink)";
    return `<button type="button" class="tile${n ? "" : " empty"}" data-st="${st}" style="--tile-bg:${bg};--tile-ink:${ink};--d:${c + r * 2}" aria-label="${esc(STATE_NAMES[st])}: ${plural(n, "professor")}"${n ? "" : " aria-disabled=\"true\""}><b>${st}</b><small>${n || ""}</small></button>`;
  }).join("");

  $("#map-scale").innerHTML = "Fewer " + MIX.slice(1).map((m) => `<i style="background:color-mix(in srgb, var(--accent) ${m}%, var(--surface))"></i>`).join("") + " More";

  let pinned = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  function show(st) {
    const list = people.filter((p) => p.st === st);
    if (!list.length) return;
    const unis = new Map();
    list.forEach((p) => unis.set(p.u, (unis.get(p.u) || 0) + 1));
    const top = [...unis.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const fields = new Map();
    list.forEach((p) => fields.set(p.fi, (fields.get(p.fi) || 0) + 1));
    const fieldList = [...fields.entries()].sort((a, b) => b[1] - a[1]);
    panel.innerHTML = `
      <p class="eyebrow">${st === pinned ? "Selected state" : "State"}</p>
      <h3>${esc(STATE_NAMES[st])}</h3>
      <p class="big">${plural(list.length, "professor")} at ${plural(unis.size, "institution")}</p>
      <div class="fields" aria-hidden="true">${fieldList.map(([fi, n]) => `<i style="flex:${n};background:var(--f${fi})"></i>`).join("")}</div>
      <div class="fields-key">${fieldList.slice(0, 4).map(([fi, n]) => `<span style="--c:var(--f${fi})">${esc(FIELD_SHORT[FIELDS[fi]] || FIELDS[fi])} ${n}</span>`).join("")}</div>
      <ol>${top.map(([u, n]) => `<li><span>${esc(u)}</span><small>${n}</small></li>`).join("")}</ol>
      <button type="button" class="btn primary" data-go="${st}">See all ${fmt(list.length)} in ${esc(STATE_NAMES[st])} →</button>`;
    $$(".tile", root).forEach((t) => t.classList.toggle("on", t.dataset.st === pinned));
  }

  root.addEventListener("mouseover", (e) => {
    const t = e.target.closest(".tile:not(.empty)");
    if (t) show(t.dataset.st);
  });
  root.addEventListener("mouseleave", () => show(pinned));
  root.addEventListener("focusin", (e) => {
    const t = e.target.closest(".tile:not(.empty)");
    if (t) show(t.dataset.st);
  });
  root.addEventListener("click", (e) => {
    const t = e.target.closest(".tile:not(.empty)");
    if (!t) return;
    pinned = t.dataset.st;
    show(pinned);
    if (window.matchMedia("(max-width: 1060px)").matches) panel.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "nearest" });
  });
  panel.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (!b) return;
    only("states", b.dataset.go);
    goToDirectory();
  });
  if (pinned) show(pinned);
  onVisible(root.parentElement, () => root.parentElement.classList.add("in"), { threshold: 0.2 });
}
