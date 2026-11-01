# US professors connected to Pakistan — student directory

A single-page, searchable directory that helps Pakistani students find and contact US faculty who were born, raised or educated in Pakistan. No server, no database, no build step.

## Files

- `index.html` — the page (layout, search, filters, student email guide)
- `data.js` — the list of professors, generated from the master sheet by `scripts/build_data.py`
- `scripts/build_data.py` — turns the master sheet into `data.js`, keeping only student-facing columns
- `scripts/curated.json` — hand-written wording for some professors; it overrides the generated entry with the same name

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
2. Push this folder to the repository (`master.xlsx` stays local).
3. Go to **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then Save.
4. After a minute or two the site is live at `https://<your-username>.github.io/pk-professors/`.
5. Optional custom domain: add it under Settings → Pages → Custom domain, then create a CNAME record at your domain registrar pointing to `<your-username>.github.io`. Tick "Enforce HTTPS" once it's available.

## After publishing

- Send each listed professor a short note with the page link, explaining why they're listed and how to request a change or removal.
- Handle removal requests promptly: delete their line from `data.js` and commit.

## Updating the data

Requires Python 3.10+ and `pip install openpyxl`.

1. In the master Google Sheet: File → Download → Microsoft Excel (.xlsx). Save it as `master.xlsx` in the project root. It is git-ignored because it contains emails; never commit it.
2. Run `python scripts/build_data.py` (or pass a path: `python scripts/build_data.py path/to/file.xlsx`).
3. Check the summary it prints, then commit and push `data.js` and `index.html`. The script stamps a version on `data.js` in `index.html` so visitors don't see a cached old list.

What the script does with each row of the `Professors` tab:

- Keeps name, university, department, title, research area, status and faculty profile link, plus the evidence source link (shown as "Source").
- Maps the specific field to one of: Medicine and public health, Computer science, Engineering, Natural sciences and mathematics, Economics and finance, Business and management, Education, Law, Humanities and social sciences.
- Reads the Pakistani institutions out of the evidence quote. These drive the "Where do you study?" tiles. To recognise a new institution or spelling, add a line to `INSTITUTIONS` in the script.
- Writes a short "Connection to Pakistan" line (born in, grew up in, originally from, studied at), based on the link type and evidence.
- Drops emails, evidence quotes, notes, wave and date columns, and strips anything that looks like an email address.
- Skips rows whose link type is `institutional`, names in `EXCLUDED`, and duplicates of the same person.

To change one professor's wording permanently, edit or add their entry in `scripts/curated.json` (same field names as `data.js`) and re-run the script. To remove someone, add their name to `EXCLUDED` in the script and re-run it.

## Left out of this version

Rows whose Pakistan link type is `institutional` (they taught or worked in Pakistan but weren't born, raised or educated there) are skipped automatically. These were also left out by name because their connection pre-dated Pakistan, related to East Pakistan, or rested on a weak source. Add them back only if a stronger public source turns up, or if they ask to be listed:

- Tahir Andrabi (Pomona College), institutional link only
- Khurram Afridi (Cornell), institutional link only
- Nilendra G. Deshpande (University of Oregon), born in Karachi in 1938, before Partition
- M. Shahid Alam (Northeastern), born in Dhaka, East Pakistan
- Niloufer Siddiqui (University at Albany), source was a podcast listing page
