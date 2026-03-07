# Kenya Law Scraper

Scrapes the full Kenya Law database at [new.kenyalaw.org](https://new.kenyalaw.org) — one of Africa's most comprehensive legal repositories.

## What it scrapes

| Collection | Count | Source |
|---|---|---|
| **Case Law (Judgments)** | ~314,026 | All courts, 1930–present |
| **Legislation** | ~490 acts + variants | Acts in force, subsidiary, repealed, uncommenced |
| **Kenya Gazette** | ~8,234 issues | 1899–present |

### Courts covered

| Code | Court |
|---|---|
| `KESC` | Supreme Court |
| `KECA` | Court of Appeal |
| `KEHC` | High Court |
| `KEELRC` | Employment and Labour Relations Court |
| `KEELC` | Environment and Land Court |
| `KEIC` | Industrial Court |
| `KEMC` | Magistrate's Court |
| `KEKC` | Kadhis Courts |
| `SCC` | Small Claims Court |
| `KETAT` | Tax Appeals Tribunal |
| `AfCHPR` | African Court on Human and Peoples' Rights |
| *(+ more)* | See `--list-courts` |

## Output format

**`output/judgments.jsonl`** — one JSON record per line:
```json
{
  "url": "https://new.kenyalaw.org/akn/ke/judgment/kehc/2024/10886/eng@2024-09-20",
  "title": "Gikonyo & another v National Assembly...",
  "doc_type": "judgment",
  "court": "KEHC",
  "date": "20 September 2024",
  "citation": "[2024] KEHC 10886 (KLR)",
  "judges": "RE Aburili, K Kimondo, M Thande",
  "case_number": "Constitutional Petition 178 of 2016",
  "outcome": "Allowed",
  "court_station": "High Court at Nairobi (Milimani Law Courts)",
  "court_division": "Constitutional and Human Rights",
  "language": "English",
  "action_type": "Judgment",
  "pdf_url": "https://new.kenyalaw.org/akn/ke/.../source",
  "docx_url": null,
  "scraped_at": "2026-03-07T17:32:00Z"
}
```

Similar JSONL files are produced for `legislation.jsonl` and `gazettes.jsonl`.

**`scraper_state.db`** — SQLite database tracking all scraped docs and pages (enables resume).

**`output/pdfs/`** — downloaded PDFs (only when `--download-docs` is passed).

## Installation

```bash
pip install aiohttp beautifulsoup4 tqdm aiofiles
```

## Usage

```bash
# Scrape everything (all judgments + legislation + gazettes)
python3 scraper.py --mode all

# Scrape only judgments
python3 scraper.py --mode judgments

# Scrape only a specific court
python3 scraper.py --mode judgments --court KEHC

# Scrape multiple courts
python3 scraper.py --mode judgments --court KEHC KECA KESC

# Scrape legislation only
python3 scraper.py --mode legislation

# Scrape gazettes only
python3 scraper.py --mode gazettes

# Scrape gazettes for specific years
python3 scraper.py --mode gazettes --years 2020 2021 2022

# Also download PDFs (large — ~300KB-5MB each)
python3 scraper.py --mode judgments --court KESC --download-docs

# Resume from where you left off (checkpoint is automatic)
python3 scraper.py --mode all

# Adjust speed (increase concurrency, reduce delay for faster scraping)
python3 scraper.py --mode all --concurrency 10 --delay 0.3

# List all known court codes
python3 scraper.py --list-courts

# Custom output directory
python3 scraper.py --mode all --output-dir /data/kenyalaw
```

## Performance & scale

With default settings (`--concurrency 5`, `--delay 0.5`):
- **~1–2 docs/sec** throughput
- ~314,000 judgments ≈ **~3–4 days** to fully scrape
- ~8,234 gazettes ≈ **~2–3 hours**
- ~490 legislation ≈ **~10 minutes**

For faster scraping (be respectful — don't overwhelm the server):
```bash
python3 scraper.py --mode all --concurrency 8 --delay 0.3
```

## Resume & checkpointing

The scraper automatically checkpoints progress in `scraper_state.db`. If interrupted, simply re-run the same command — it will skip already-scraped documents and completed pages.

## Rate limiting

Default settings are conservative (5 concurrent, 0.5s delay) to avoid overloading the Kenya Law servers. Please be respectful — this is a public service running on limited infrastructure.

## Site structure

The scraper targets `https://new.kenyalaw.org` which uses:
- **Akoma Ntoso (AKN)** document format for URLs
- **Server-side rendered HTML** — no JS execution required
- **Pagination** via `?page=N&per_page=20`
- **PDF download** via `{document_url}/source`

URL patterns:
- Judgments: `/akn/ke/judgment/{court}/{year}/{number}/eng@{date}`
- Legislation: `/akn/ke/act/{year}/{number}/eng@{date}`
- Gazettes: `/akn/ke/officialGazette/{date}/{issue}/eng@{date}`
