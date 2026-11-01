# US professors connected to Pakistan — student directory

A single-page, searchable directory that helps Pakistani students find and contact US faculty who were born, raised or educated in Pakistan. No server, no database, no build step.

## Files

- `index.html` — the page (layout, search, filters, student email guide)
- `data.js` — the list of professors. Edit this file to add, change or remove people.

## Before you publish

1. **Restrict your master Google Sheet.** It contains emails and research notes. Set sharing to "Restricted" and keep it as your private working copy. Only `data.js` goes public.
2. **Create two Google Forms** (forms.google.com):
   - *Correction or removal* — fields: your name, your faculty profile link, what should change (or "please remove me").
   - *Suggest a professor* — fields: professor name, US university, faculty profile link, public source showing their connection to Pakistan.
3. Paste both form links into the `CONFIG` block near the bottom of `index.html`:
   ```js
   const CONFIG = {
     correctionFormUrl: "https://forms.gle/...",
     suggestFormUrl: "https://forms.gle/..."
   };
   ```

## Publish on GitHub Pages

1. Create a new public repository on GitHub, for example `pk-professors`.
2. Upload `index.html` and `data.js` to the root of the repository (Add file → Upload files → Commit).
3. Go to **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then Save.
4. After a minute or two the site is live at `https://<your-username>.github.io/pk-professors/`.
5. Optional custom domain: add it under Settings → Pages → Custom domain, then create a CNAME record at your domain registrar pointing to `<your-username>.github.io`. Tick "Enforce HTTPS" once it's available.

## After publishing

- Send each listed professor a short note with the page link, explaining why they're listed and how to request a change or removal.
- Handle removal requests promptly: delete their line from `data.js` and commit.

## Updating the data

Each professor is one line in `data.js`:

```js
{n:"Name", u:"US university", d:"Department", t:"Title", c:"Field",
 r:"Research area", k:"Connection to Pakistan, as the source states it",
 a:["Pakistani institution attended"], s:"active", p:"https://faculty-profile-link"},
```

- `c` (field) must be one of: Engineering, Computer science, Medicine and public health, Natural sciences, Economics and finance, Law, Humanities and social sciences. A new value creates a new filter option automatically.
- `a` drives the "Where do you study?" tiles. Use the same spelling as existing entries (e.g. `"Aga Khan University, Karachi"`) so they group together. Leave it as `[]` if they didn't study in Pakistan.
- `s` is one of `active`, `emeritus`, `adjunct`, `visiting`.
- Never add email addresses. Students find them on the faculty profile.
- Update `window.DIRECTORY_UPDATED` at the top when you re-check the list.

## Left out of this version

These rows from the master sheet were not included because their connection to Pakistan was institutional only, pre-dated Pakistan, related to East Pakistan, or rested on a weak source. Add them back only if a stronger public source turns up, or if they ask to be listed:

- Tahir Andrabi (Pomona College), institutional link only
- Khurram Afridi (Cornell), institutional link only
- Nilendra G. Deshpande (University of Oregon), born in Karachi in 1938, before Partition
- M. Shahid Alam (Northeastern), born in Dhaka, East Pakistan
- Niloufer Siddiqui (University at Albany), source was a podcast listing page
