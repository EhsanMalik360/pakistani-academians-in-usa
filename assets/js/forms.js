import { $, $$, esc, store, ICONS, toast } from "./utils.js";
import { people, byId, CONFIG, on } from "./store.js";
import { openView, close } from "./panel.js";

const ENDPOINT = "https://formsubmit.co/ajax/";
const COOLDOWN_MS = 30000;
const URL_RX = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const field = ({ name, label, type = "text", required = false, hint = "", placeholder = "", value = "", wide = false, list = "", autocomplete = "" }) => `
  <label class="ff${wide ? " wide" : ""}">
    <span class="ff-label">${esc(label)}${required ? ' <i aria-hidden="true">*</i>' : ' <em>optional</em>'}</span>
    ${type === "textarea"
      ? `<textarea name="${name}" rows="4" placeholder="${esc(placeholder)}"${required ? " required" : ""} aria-describedby="${name}-err${hint ? ` ${name}-hint` : ""}">${esc(value)}</textarea>`
      : `<input name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}"${required ? " required" : ""}${list ? ` list="${list}"` : ""}${autocomplete ? ` autocomplete="${autocomplete}"` : ""} aria-describedby="${name}-err${hint ? ` ${name}-hint` : ""}">`}
    ${hint ? `<small class="ff-hint" id="${name}-hint">${esc(hint)}</small>` : ""}
    <small class="ff-err" id="${name}-err" aria-live="polite"></small>
  </label>`;

function suggestFields() {
  return `
    ${field({ name: "professor", label: "Professor’s name", required: true, placeholder: "e.g. Dr. Sana Ahmed" })}
    ${field({ name: "university", label: "US university", required: true, placeholder: "e.g. University of Michigan" })}
    ${field({ name: "profile", label: "Official faculty profile link", type: "url", required: true, wide: true, placeholder: "https://…" })}
    ${field({ name: "source", label: "Public source for their connection to Pakistan", type: "url", required: true, wide: true, placeholder: "https://… (profile, CV, interview or news article)", hint: "A page that says they were born, raised or educated in Pakistan. We can only list people with a public source." })}
    ${field({ name: "institution", label: "Pakistani institution they attended", placeholder: "e.g. NED University, Karachi" })}
    ${field({ name: "field", label: "Field", placeholder: "e.g. Civil engineering" })}
    ${field({ name: "notes", label: "Anything else", type: "textarea", wide: true, placeholder: "Optional context that helps us verify" })}`;
}

function correctFields(p) {
  return `
    ${field({ name: "listing", label: "Which listing?", required: true, wide: true, list: "rabta-names", value: p ? `${p.n} — ${p.u}` : "", placeholder: "Start typing a name" })}
    <fieldset class="ff wide ff-choices">
      <legend class="ff-label">What would you like? <i aria-hidden="true">*</i></legend>
      <label><input type="radio" name="request" value="Update details" checked> Update or fix details</label>
      <label><input type="radio" name="request" value="Remove listing"> Remove this listing</label>
      <label><input type="radio" name="request" value="Other"> Something else</label>
    </fieldset>
    ${field({ name: "details", label: "Details", type: "textarea", required: true, wide: true, placeholder: "What should change? For updates, include a link to the correct information." })}
    <label class="ff wide ff-check"><input type="checkbox" name="is_professor" value="yes"> I am this professor, or I’m writing on their behalf</label>`;
}

function formHtml(type, p) {
  const prefs = store("rabta.contact") || {};
  const configured = Boolean(CONFIG.submitTo);
  return `
    <div class="saved-head">
      <p class="eyebrow">${type === "correct" ? "Corrections and removals" : "Help the directory grow"}</p>
      <h2 id="panel-title">${type === "correct" ? "Correct or remove a listing" : "Suggest a professor"}</h2>
      <p>${type === "correct"
        ? "Professors stay in control of how they appear. Removal requests are handled promptly, with no questions asked."
        : "Know a professor at a US university who was born, raised or educated in Pakistan? Tell us, and we’ll check the public sources before adding them."}</p>
    </div>
    <div class="seg form-switch" role="tablist" aria-label="Type of request">
      <button type="button" role="tab" data-type="suggest" aria-selected="${type === "suggest"}">Suggest a professor</button>
      <button type="button" role="tab" data-type="correct" aria-selected="${type === "correct"}">Correct or remove</button>
    </div>
    ${configured ? "" : `<p class="form-note">Submissions aren’t switched on yet. The site owner needs to add an email address in <code>RABTA_CONFIG.submitTo</code>.</p>`}
    <form class="rform" novalidate data-type="${type}">
      <div class="rform-grid">
        ${type === "correct" ? correctFields(p) : suggestFields()}
      </div>
      <div class="rform-grid rform-you">
        <p class="ff-section wide">About you</p>
        ${field({ name: "name", label: "Your name", required: type === "correct", value: prefs.name || "", autocomplete: "name" })}
        ${field({ name: "email", label: "Your email", type: "email", required: type === "correct", value: prefs.email || "", autocomplete: "email", hint: type === "correct" ? "So we can confirm the request with you." : "Only if you’d like to hear back." })}
      </div>
      <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="rform-bar">
        <p class="form-status" role="status" aria-live="polite"></p>
        <button type="submit" class="btn primary"${configured ? "" : " disabled"}>
          <span>${type === "correct" ? "Send request" : "Send suggestion"}</span>
        </button>
      </div>
      <p class="form-fine">Your details are used only to follow up on this message and are never published.</p>
    </form>
    <datalist id="rabta-names">${type === "correct" ? people.map((x) => `<option value="${esc(x.n)} — ${esc(x.u)}"></option>`).join("") : ""}</datalist>`;
}

function successHtml(type) {
  return `<div class="form-done">
    <span class="form-done-mark" aria-hidden="true">${ICONS.check}</span>
    <h2 id="panel-title">Thank you</h2>
    <p>${type === "correct"
      ? "Your request has been sent. We’ll update or remove the listing as soon as we can, and reply if you left an email."
      : "Your suggestion has been sent. We’ll check the sources and add them if everything lines up."}</p>
    <div class="p-actions" style="justify-content:center">
      <button type="button" class="btn" data-again="${type}">Send another</button>
      <button type="button" class="btn primary" data-close>Back to the directory</button>
    </div>
  </div>`;
}

function validate(form) {
  let first = null;
  $$("input[name], textarea[name]", form).forEach((el) => {
    if (el.type === "radio" || el.type === "checkbox" || el.name === "_honey") return;
    const v = el.value.trim();
    let msg = "";
    if (el.required && !v) msg = "Please fill this in.";
    else if (v && el.type === "url" && !URL_RX.test(v)) msg = "Please enter a full link starting with https://";
    else if (v && el.type === "email" && !EMAIL_RX.test(v)) msg = "Please check this email address.";
    else if (el.name === "listing" && v && !people.some((x) => `${x.n} — ${x.u}` === v || x.n.toLowerCase() === v.toLowerCase())) msg = "Pick a name from the list so we know exactly which listing you mean.";
    const err = $(`#${el.name}-err`, form);
    if (err) err.textContent = msg;
    el.setAttribute("aria-invalid", msg ? "true" : "false");
    if (msg && !first) first = el;
  });
  const req = $("input[name=request]:checked", form);
  if (form.dataset.type === "correct" && req && req.value === "Remove listing" && !$("input[name=is_professor]", form).checked) {
    const box = $("input[name=is_professor]", form);
    box.closest(".ff-check").classList.add("invalid");
    if (!first) first = box;
  } else {
    $(".ff-check", form)?.classList.remove("invalid");
  }
  return first;
}

async function submit(form) {
  const type = form.dataset.type;
  const status = $(".form-status", form);
  const button = $("button[type=submit]", form);
  if ($("input[name=_honey]", form).value) return { ok: true };

  const last = store("rabta.lastSubmit") || 0;
  if (Date.now() - last < COOLDOWN_MS) {
    status.textContent = "Please wait a few seconds before sending another message.";
    return { ok: false };
  }

  const data = Object.fromEntries(new FormData(form).entries());
  delete data._honey;
  const payload = {
    _subject: type === "correct"
      ? `Rabta: ${data.request || "Correction"} — ${data.listing || ""}`
      : `Rabta: new suggestion — ${data.professor || ""}`,
    _template: "table",
    _captcha: "false",
    "Request type": type === "correct" ? "Correction / removal" : "Suggest a professor",
    ...Object.fromEntries(Object.entries(data).filter(([, v]) => String(v).trim()).map(([k, v]) => [LABELS[k] || k, String(v).trim()])),
    "Sent from": location.href,
  };
  if (data.email) payload._replyto = data.email;

  button.disabled = true;
  button.classList.add("loading");
  status.textContent = "Sending…";
  try {
    const res = await fetch(ENDPOINT + encodeURIComponent(CONFIG.submitTo), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || String(body.success) === "false") throw new Error(body.message || `Status ${res.status}`);
    store("rabta.lastSubmit", Date.now());
    store("rabta.contact", { name: data.name || "", email: data.email || "" });
    return { ok: true };
  } catch (err) {
    status.textContent = /activat/i.test(err.message)
      ? "The form is being set up and isn’t accepting messages yet. Please try again a little later."
      : "We couldn’t send that just now. Please check your connection and try again.";
    console.error("Form submission failed:", err);
    return { ok: false };
  } finally {
    button.disabled = false;
    button.classList.remove("loading");
  }
}

const LABELS = {
  professor: "Professor", university: "US university", profile: "Faculty profile", source: "Source for Pakistan connection",
  institution: "Pakistani institution", field: "Field", notes: "Notes", listing: "Listing", request: "Request",
  details: "Details", is_professor: "Is the professor (or on their behalf)", name: "From", email: "Reply-to email",
};

export function openForm(type = "suggest", id = null) {
  const p = id ? byId.get(id) : null;
  openView({
    label: type === "correct" ? "Correct or remove a listing" : "Suggest a professor",
    html: formHtml(type, p),
    mount: (body) => bind(body, type, id),
  });
}

function bind(body, type, id) {
  $$(".form-switch [data-type]", body).forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.type !== type) openForm(b.dataset.type, id);
  }));
  const form = $(".rform", body);
  if (!form) return;
  form.addEventListener("input", (e) => {
    if (e.target.getAttribute("aria-invalid") === "true") {
      e.target.setAttribute("aria-invalid", "false");
      const err = $(`#${e.target.name}-err`, form);
      if (err) err.textContent = "";
    }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const bad = validate(form);
    if (bad) {
      bad.focus();
      $(".form-status", form).textContent = "Please fix the highlighted fields.";
      return;
    }
    const { ok } = await submit(form);
    if (ok) {
      body.innerHTML = successHtml(type);
      body.scrollTop = 0;
      toast(type === "correct" ? "Request sent" : "Suggestion sent");
    }
  });
}

export function initForms() {
  on("open-form", ({ type, id } = {}) => openForm(type, id));
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-form], [data-again], [data-close]");
    if (!t) return;
    e.preventDefault();
    if (t.dataset.close !== undefined) return close();
    if (t.dataset.again) return openForm(t.dataset.again, null);
    openForm(t.dataset.form, t.dataset.id || null);
  });
}
