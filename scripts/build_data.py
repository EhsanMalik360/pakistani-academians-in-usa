"""Build data.js (the public directory data) from the private master sheet.

Usage:
    python scripts/build_data.py [path/to/master.xlsx]

Download the master sheet with File > Download > Microsoft Excel (.xlsx) and save
it as master.xlsx in the project root (it is git-ignored), or pass its path.

Only student-facing columns are written. Emails, email sources, evidence quotes,
notes and working columns never leave the master sheet.

Entries in scripts/curated.json (hand-edited wording) override generated ones,
matched by name. Names in EXCLUDED are skipped.
"""

import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("Missing dependency: run  pip install openpyxl")

ROOT = Path(__file__).resolve().parent.parent
CURATED = ROOT / "scripts" / "curated.json"
OUT = ROOT / "data.js"
INDEX = ROOT / "index.html"

# Connection to Pakistan was institutional only, pre-dated Pakistan, related to
# East Pakistan, or rested on a weak source. See README.
EXCLUDED = {
    "Tahir Andrabi",
    "Khurram Afridi",
    "Nilendra G. Deshpande",
    "Nilendra Deshpande",
    "M. Shahid Alam",
    "Niloufer Siddiqui",
}

# (pattern, canonical name). First match wins per institution; order matters
# where one name contains another.
INSTITUTIONS = [
    (r"aga\s*khan", "Aga Khan University, Karachi"),
    (r"\bdow\b|\bduhs\b", "Dow Medical College, Karachi"),
    (r"king\s+edward", "King Edward Medical University, Lahore"),
    (r"allama\s+iqbal\s+medical", "Allama Iqbal Medical College, Lahore"),
    (r"allama\s+iqbal\s+open", "Allama Iqbal Open University, Islamabad"),
    (r"fati?n?ma\s+jinnah\s+medical|fatina\s+jinnah", "Fatima Jinnah Medical University, Lahore"),
    (r"fatima\s+jinnah\s+women", "Fatima Jinnah Women University, Rawalpindi"),
    (r"fati?ma\s+memorial|\bfmh\s+college", "Fatima Memorial College, Lahore"),
    (r"jinnah\s+medical\s+(and|&)\s+dental", "Jinnah Medical and Dental College, Karachi"),
    (r"sahiwal\s+medical", "Sahiwal Medical College"),
    (r"sargodha\s+medical", "Sargodha Medical College"),
    (r"shaikh\s+khalifa\s+bin\s+zayed", "Shaikh Khalifa Bin Zayed Al-Nahyan Medical and Dental College, Lahore"),
    (r"yusra\s+medical", "Yusra Medical and Dental College, Islamabad"),
    (r"nawaz\s+sharif\s+medical", "Nawaz Sharif Medical College, Gujrat"),
    (r"national\s+college\s+of\s+(the\s+)?arts", "National College of Arts, Lahore"),
    (r"indus\s+valley\s+school", "Indus Valley School of Art and Architecture, Karachi"),
    (r"national\s+textile\s+university", "National Textile University, Faisalabad"),
    (r"capital\s+university\s+of\s+science", "Capital University of Science and Technology, Islamabad"),
    (r"preston\s+university", "Preston University"),
    (r"the\s+university\s+of\s+faisalabad", "The University of Faisalabad"),
    (r"nishtar", "Nishtar Medical University, Multan"),
    (r"army\s+medical\s+college", "Army Medical College, Rawalpindi"),
    (r"rawalpindi\s+medical", "Rawalpindi Medical College"),
    (r"khyber\s+medical", "Khyber Medical College, Peshawar"),
    (r"khyber\s+girls", "Khyber Girls Medical College, Peshawar"),
    (r"liaquat|lumhs", "Liaquat University of Medical and Health Sciences, Jamshoro"),
    (r"jinnah\s+sindh\s+medical|sindh?\s+medical", "Sindh Medical College, Karachi"),
    (r"services\s+institute\s+of\s+medical", "Services Institute of Medical Sciences, Lahore"),
    (r"quaid-?\s*[ei]-?\s*azam\s+medical", "Quaid-e-Azam Medical College, Bahawalpur"),
    (r"punjab\s+medical\s+college|faisalabad\s+medical", "Punjab Medical College, Faisalabad"),
    (r"ayub\s+medical", "Ayub Medical College, Abbottabad"),
    (r"bolan\s+medical", "Bolan Medical College, Quetta"),
    (r"chandka", "Chandka Medical College, Larkana"),
    (r"peshawar\s+medical", "Peshawar Medical College"),
    (r"baqai", "Baqai Medical University, Karachi"),
    (r"ziauddin", "Ziauddin University, Karachi"),
    (r"shifa", "Shifa College of Medicine, Islamabad"),
    (r"karachi\s+medical\s+(and|&)\s+dental", "Karachi Medical and Dental College"),
    (r"de['’]?\s*montmorency", "de'Montmorency College of Dentistry, Lahore"),
    (r"lahore\s+medical\s+(and|&)\s+dental", "Lahore Medical and Dental College"),
    (r"\bcmh\b[^.;]{0,30}medical|combined\s+military\s+hospital", "CMH Lahore Medical College"),
    (r"foundation\s+university", "Foundation University, Islamabad"),
    (r"riphah", "Riphah International University, Islamabad"),
    (r"hamdard", "Hamdard University, Karachi"),
    (r"university\s+of\s+health\s+sciences", "University of Health Sciences, Lahore"),
    (r"college\s+of\s+physicians\s+(and|&)\s+surgeons\s+pakistan|\bcpsp\b", "College of Physicians and Surgeons Pakistan"),
    (r"\bned\b|n\.\s*e\.\s*d\.", "NED University, Karachi"),
    (r"\bnust\b|national\s+university\s+of\s+sciences|college\s+of\s+e\s*&\s*me|military\s+college\s+of\s+signals|\bpnec\b", "NUST, Islamabad"),
    (r"\bnuces\b|\bfast\b[^.;]{0,25}(university|national|nu\b|lahore|karachi|islamabad|peshawar)|national\s+university\s+of\s+computer", "FAST-NUCES"),
    (r"\blums\b|lahore\s+university\s+of\s+management", "LUMS, Lahore"),
    (r"ghulam\s+ishaq|\bgiki\b|\bgik\b", "GIK Institute, Topi"),
    (r"comsats|ciit\b", "COMSATS University"),
    (r"\bpieas\b|pakistan\s+institute\s+of\s+engineering", "PIEAS, Islamabad"),
    (r"\bpide\b|pakistan\s+institute\s+of\s+development\s+economics", "PIDE, Islamabad"),
    (r"sukkur\s+iba", "Sukkur IBA University"),
    (r"institute\s+of\s+business\s+administration|\biba\b[^.;]{0,20}karachi|karachi[^.;]{0,5}\biba\b", "IBA Karachi"),
    (r"lahore\s+school\s+of\s+economics", "Lahore School of Economics"),
    (r"mehran", "Mehran UET, Jamshoro"),
    (r"dawood", "Dawood College, Karachi"),
    (r"(university\s+of\s+engineering\s*(and|&)\s*technology|\buet\b)[^.;]{0,40}taxila|taxila[^.;]{0,25}(uet|university\s+of\s+engineering)", "UET Taxila"),
    (r"(university\s+of\s+engineering\s*(and|&)\s*technology|\buet\b)[^.;]{0,40}peshawar|peshawar[^.;]{0,25}(uet|university\s+of\s+engineering)", "UET Peshawar"),
    (r"(university\s+of\s+engineering\s*(and|&)\s*technology|\buet\b)[^.;]{0,40}lahore|lahore[^.;]{0,25}(uet|university\s+of\s+engineering)|west\s+pakistan\s+university\s+of\s+engineering|university\s+of\s+engineering[^.;]{0,20}lahore", "UET Lahore"),
    (r"university\s+of\s+engineering\s*(and|&)\s*technology|\buet\b", "UET (campus not stated)"),
    (r"quaid-?\s*[ei]-?\s*azam\s+university|\bqau\b", "Quaid-i-Azam University, Islamabad"),
    (r"university\s+of\s+(the\s+)?punjab|punjab\s+university|\bpu\b[^.;]{0,10}lahore|(university\s+of\s+(the\s+)?panjab|panjab\s+university)[^.;]{0,15}(lahore|pakistan)", "University of the Punjab, Lahore"),
    (r"university\s+of\s+karachi|karachi\s+university", "University of Karachi"),
    (r"university\s+of\s+peshawar|peshawar\s+university|islamia\s+college[^.;]{0,15}peshawar", "University of Peshawar"),
    (r"university\s+of\s+sindh|sindh\s+university", "University of Sindh, Jamshoro"),
    (r"university\s+of\s+balochistan|balochistan\s+university", "University of Balochistan, Quetta"),
    (r"(university\s+of\s+agriculture|agricultural\s+university)[^.;]{0,25}(faisalabad|pakistan)|faisalabad[^.;]{0,10}agricultur|\buaf\b", "University of Agriculture, Faisalabad"),
    (r"pir\s+mehr\s+ali\s+shah|arid\s+agriculture", "PMAS Arid Agriculture University, Rawalpindi"),
    (r"sindh\s+agricultur", "Sindh Agriculture University, Tandojam"),
    (r"bahauddin\s+zakariya|\bbzu\b", "Bahauddin Zakariya University, Multan"),
    (r"islamia\s+university[^.;]{0,15}bahawalpur", "Islamia University of Bahawalpur"),
    (r"international\s+islamic\s+university", "International Islamic University, Islamabad"),
    (r"government\s+college\s+university[^.;]{0,15}faisalabad|gc\s*university[^.;]{0,15}faisalabad", "Government College University, Faisalabad"),
    (r"(government|govt\.?)\s+college[^.;]{0,30}lahore|gc\s*,?\s*university|\bgcu\b", "Government College, Lahore"),
    (r"forman", "Forman Christian College, Lahore"),
    (r"kinnaird", "Kinnaird College, Lahore"),
    (r"lahore\s+college\s+for\s+women", "Lahore College for Women University"),
    (r"aitchison", "Aitchison College, Lahore"),
    (r"hasan\s*abdal", "Cadet College Hasan Abdal"),
    (r"petaro", "Cadet College Petaro"),
    (r"lawrence\s+college", "Lawrence College, Ghora Gali"),
    (r"karachi\s+grammar", "Karachi Grammar School"),
    (r"d\.?\s*j\.?\s+(sindh\s+)?(government\s+)?science\s+college|dayaram\s+jethmal", "D.J. Science College, Karachi"),
    (r"bahria", "Bahria University"),
    (r"\bair\s+university", "Air University, Islamabad"),
    (r"szabist|zulfikar\s+ali\s+bhutto\s+institute", "SZABIST"),
    (r"university\s+of\s+management\s+(and|&)\s+technology|\bumt\b", "UMT, Lahore"),
    (r"university\s+of\s+central\s+punjab", "University of Central Punjab, Lahore"),
    (r"university\s+of\s+lahore", "University of Lahore"),
    (r"habib\s+university", "Habib University, Karachi"),
    (r"gomal", "Gomal University, Dera Ismail Khan"),
    (r"hazara\s+university", "Hazara University"),
    (r"university\s+of\s+gujrat", "University of Gujrat"),
    (r"university\s+of\s+sargodha", "University of Sargodha"),
    (r"university\s+of\s+malakand", "University of Malakand"),
    (r"abdul\s+wali\s+khan", "Abdul Wali Khan University, Mardan"),
    (r"kohat\s+university", "Kohat University of Science and Technology"),
    (r"university\s+of\s+azad\s+jammu|\bajk\s+university", "University of Azad Jammu and Kashmir"),
    (r"pakistan\s+military\s+academy", "Pakistan Military Academy, Kakul"),
    (r"virtual\s+university", "Virtual University of Pakistan"),
    (r"iqra\s+university", "Iqra University, Karachi"),
    (r"st\.?\s+patrick", "St. Patrick's, Karachi"),
]
INSTITUTIONS = [(re.compile(p, re.I), name) for p, name in INSTITUTIONS]

CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Peshawar", "Quetta",
          "Multan", "Faisalabad", "Hyderabad", "Sialkot", "Gujranwala", "Abbottabad",
          "Sargodha", "Bahawalpur", "Sukkur", "Larkana", "Mardan", "Gujrat", "Jhelum",
          "Muzaffarabad", "Swat", "Mirpur", "Sahiwal", "Okara", "Kohat", "Nawabshah"]

# (keywords in field/department, category). First match wins.
CATEGORIES = [
    ("Law", r"\blaw\b|legal|jurisprud"),
    ("Medicine and public health",
     r"medic|health|clinic|surg|cardio|neuro|oncol|psychiat|pediatr|paediatr|patho|radiol|anesth|nurs|pharm|dent|epidem|"
     r"nephro|gastro|hepat|pulmon|immun|endocrin|dermat|ophthal|urolog|obstet|gynec|hemat|infectious|geriat|rheumat|"
     r"emergency|critical care|hospital|transplant|orthop|otolaryng|sonograph|biostat|nutrition|physical therapy|"
     r"kinesiol|rehab|veterin|optom|allerg|genetic counsel|sleep|pain|vascular|physician|biomedical sciences|"
     r"molecular medicine|cancer|virol|microbiol|physiol|anatom|pharmacol|toxicol"),
    ("Computer science", r"computer|comput|software|data science|artificial intel|\bai\b|machine learning|cyber|informat|information (systems|science|technology)|robotic"),
    ("Engineering", r"engineer|electrical|mechanical|civil|chemical eng|aerospace|materials|industrial|petroleum|nuclear|structural|environmental eng|photonic|semiconductor|architect"),
    ("Business and management", r"business|management|marketing|accounting|supply chain|operations|entrepreneur|organizational|strategy|hospitality|logistics|real estate|\bmba\b"),
    ("Economics and finance", r"econom|financ|actuar|bank"),
    ("Natural sciences and mathematics",
     r"physics|chemistry|biolog|mathemat|statist|geolog|earth|astronom|ecology|botan|zoolog|biochem|neuroscience|"
     r"genetic|genomic|horticult|agricultur|plant|soil|environment|atmospher|ocean|marine|food science|entomol|forestry|natural science|science"),
    ("Education", r"educat|teaching|curriculum|pedagog|literacy|counsel"),
    ("Humanities and social sciences", r".*"),
]
CATEGORIES = [(name, re.compile(p, re.I)) for name, p in CATEGORIES]
LEGACY_CATEGORY = {"Natural sciences": "Natural sciences and mathematics"}

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
STOP = {"university", "of", "the", "at", "and", "medical", "center", "college", "school", "health",
        "state", "sciences", "science", "institute", "medicine", "system", "campus"}


def clean(v):
    if v is None:
        return ""
    s = EMAIL.sub("", str(v))
    return re.sub(r"\s+", " ", s).strip(" ;,")


def institutions(text):
    found = []
    for rx, name in INSTITUTIONS:
        if rx.search(text) and name not in found:
            if name == "UET (campus not stated)" and any(n.startswith("UET ") for n in found):
                continue
            found.append(name)
    return found


def category(field, dept):
    hay = field + " " + dept
    for name, rx in CATEGORIES:
        if rx.search(field):
            return name
    for name, rx in CATEGORIES[:-1]:
        if rx.search(hay):
            return name
    return CATEGORIES[-1][0]


def status(raw, title):
    s = (raw + " " + title).lower()
    if "emerit" in s:
        return "emeritus"
    if "visiting" in s:
        return "visiting"
    if "adjunct" in s:
        return "adjunct"
    return "active"


PLACE = r"(" + "|".join(CITIES) + r"|Pakistan)\b"
ORIGIN_PHRASES = [
    ("Born in", r"\bborn\b[^.;]{0,40}?\bin\s+(the\s+city\s+of\s+)?" + PLACE),
    ("Grew up in", r"(grew\s+up|raised|childhood[^.;]{0,30}?)\s+in\s+" + PLACE),
    ("Originally from", r"(originally\s+from|native\s+of|hails\s+from|hometown:?\s*(i\s+was\s+born\s+and\s+raised\s+in\s+)?)\s*" + PLACE),
]


def origin(evidence):
    for label, rx in ORIGIN_PHRASES:
        m = re.search(rx, evidence, re.I)
        if m:
            place = m.groups()[-1]
            return label + " " + place[0].upper() + place[1:].lower()
    return None


def connection(link_type, evidence, alma):
    t = link_type.lower()
    parts = []
    where = origin(evidence)
    if where:
        parts.append(where)
    elif "born" in t:
        parts.append("Born in Pakistan")
    elif "origin" in t:
        parts.append("Pakistani origin, as stated in a public source")
    if alma:
        parts.append(("studied at " if parts else "Studied at ") + ", ".join(alma))
    elif "educat" in t or "multiple" in t or re.search(r"(degree|studies|school|trained|graduate)[^.;]{0,40}pakistan", evidence, re.I):
        parts.append("studied in Pakistan" if parts else "Studied in Pakistan")
    if not parts:
        parts.append("Pakistani origin, as stated in a public source")
    return "; ".join(parts)


def same_person(a, b):
    if a["p"] == b["p"]:
        return True
    wa = {w for w in re.findall(r"[a-z]+", a["u"].lower()) if w not in STOP}
    wb = {w for w in re.findall(r"[a-z]+", b["u"].lower()) if w not in STOP}
    aliases = {"ut": "texas", "ucsf": "california", "ucla": "california", "um": "michigan"}
    wa |= {aliases[w] for w in wa if w in aliases}
    wb |= {aliases[w] for w in wb if w in aliases}
    return bool(wa & wb)


def load_rows(path):
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb["Professors"]
    it = ws.iter_rows(values_only=True)
    header = [clean(h) for h in next(it)]
    rows = []
    for r in it:
        if not any(c not in (None, "") for c in r):
            continue
        rows.append(dict(zip(header, r)))
    return rows


def build(path):
    curated = {p["n"]: p for p in json.loads(CURATED.read_text(encoding="utf-8"))} if CURATED.exists() else {}
    stats = {"rows": 0, "excluded_name": 0, "institutional": 0, "duplicate": 0, "no_profile": 0}
    people = []
    for row in load_rows(path):
        stats["rows"] += 1
        name = clean(row.get("Name"))
        if not name:
            continue
        if name in EXCLUDED:
            stats["excluded_name"] += 1
            continue
        link_type = clean(row.get("Pakistan link type"))
        if link_type.lower() == "institutional":
            stats["institutional"] += 1
            continue
        profile = clean(row.get("Faculty profile"))
        if not profile.startswith("http"):
            stats["no_profile"] += 1
            continue
        title = clean(row.get("Title"))
        dept = clean(row.get("School / Department"))
        field = clean(row.get("Field"))
        evidence = clean(row.get("Pakistan link evidence"))
        alma = institutions(evidence)
        source = clean(row.get("Link evidence source"))
        entry = {
            "n": name,
            "u": clean(row.get("University")),
            "d": dept,
            "t": title,
            "c": category(field, dept),
            "r": clean(row.get("Research area")) or field,
            "k": connection(link_type, evidence, alma),
            "a": alma,
            "s": status(clean(row.get("Status")), title),
            "p": profile,
        }
        if source.startswith("http") and source != profile:
            entry["e"] = source
        if name in curated:
            cur = dict(curated[name])
            cur["c"] = LEGACY_CATEGORY.get(cur["c"], cur["c"])
            if "e" in entry and "e" not in cur:
                cur["e"] = entry["e"]
            entry = cur
        if any(p["n"] == name and same_person(p, entry) for p in people):
            stats["duplicate"] += 1
            continue
        people.append(entry)

    people.sort(key=lambda p: (p["n"].split()[-1].lower(), p["n"].lower()))
    lines = [json.dumps(p, ensure_ascii=False, separators=(",", ":")) for p in people]
    header = (
        "// Student-facing directory data, generated by scripts/build_data.py from the master sheet.\n"
        "// Fields: n = name, u = US university, d = department, t = title, c = field,\n"
        "// r = research area, k = connection to Pakistan (from a public source),\n"
        "// a = Pakistani institutions attended, s = status (active | emeritus | adjunct | visiting),\n"
        "// p = official or public profile link, e = source for the Pakistan connection (optional).\n"
        "// No emails here, by design. Re-run the script instead of editing by hand.\n\n"
    )
    updated = date.today().strftime("%B %Y")
    body = "window.DIRECTORY_UPDATED = " + json.dumps(updated) + ";\n\nwindow.PROFESSORS = [\n" + ",\n".join(lines) + "\n];\n"
    OUT.write_text(header + body, encoding="utf-8", newline="\n")

    version = hashlib.sha1(body.encode("utf-8")).hexdigest()[:8]
    html = INDEX.read_text(encoding="utf-8")
    html = re.sub(r'src="data\.js(\?v=[^"]*)?"', f'src="data.js?v={version}"', html)
    INDEX.write_text(html, encoding="utf-8", newline="\n")

    with_alma = sum(1 for p in people if p["a"])
    cats = {}
    for p in people:
        cats[p["c"]] = cats.get(p["c"], 0) + 1
    print(f"Read {stats['rows']} rows; wrote {len(people)} professors to {OUT.name}")
    print(f"Skipped: {stats['institutional']} institutional-only, {stats['excluded_name']} excluded by name, "
          f"{stats['duplicate']} duplicates, {stats['no_profile']} without a profile link")
    print(f"{with_alma} have a recognised Pakistani institution")
    for c, n in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {n:5d}  {c}")


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "master.xlsx"
    if not src.exists():
        sys.exit(f"Master sheet not found: {src}\nDownload it as .xlsx and save it as master.xlsx in the project root.")
    build(src)
