#!/usr/bin/env python3
"""
Kenya Law Document Scraper — new.kenyalaw.org
==============================================
Downloads actual legal documents (PDFs) from Kenya Law, organized by type.

Scale:
  ~314,026 judgments  (1930–present)
  ~490+   legislation acts
  ~8,234  gazettes    (1899–present)

Storage layout:
  {output_dir}/
  ├── case_law/
  │   ├── KESC/SCK/{year}/{month}/[citation].pdf
  │   ├── KECA/{station}/{year}/{month}/[citation].pdf
  │   ├── KEHC/{station}/{year}/{month}/[citation].pdf
  │   └── ... (all courts)
  ├── legislation/
  │   ├── acts_in_force/[title_slug].pdf
  │   ├── subsidiary/[title_slug].pdf
  │   ├── repealed/[title_slug].pdf
  │   └── uncommenced/[title_slug].pdf
  ├── gazettes/
  │   └── {year}/{gazette_vol_no}.pdf
  └── metadata/
      ├── judgments.jsonl   (one record per doc with all metadata + local path)
      ├── legislation.jsonl
      └── gazettes.jsonl

Usage:
  python3 scraper.py --mode all                        # Everything
  python3 scraper.py --mode judgments                  # All courts
  python3 scraper.py --mode judgments --court KEHC     # One court
  python3 scraper.py --mode legislation
  python3 scraper.py --mode gazettes
  python3 scraper.py --mode gazettes --years 2020 2021
  python3 scraper.py --mode all --workers 50           # More concurrency
  python3 scraper.py --mode all --output-dir /data/kenyalaw
  python3 scraper.py --stats                           # Print DB stats and exit
  python3 scraper.py --mode all --fresh-days 7         # Re-check batches scraped <7 days ago (weekly runs)
"""

import asyncio
import aiohttp
import aiofiles
import json
import sqlite3
import argparse
import logging
import re
import sys
import shutil
import time
import hashlib
from pathlib import Path
from dataclasses import dataclass, asdict, field
from typing import Optional
from bs4 import BeautifulSoup
from tqdm import tqdm
from datetime import datetime, timezone, timedelta

# ─── Defaults (override via CLI or env vars) ──────────────────────────────────

DEFAULT_WORKERS     = 50          # Async IO-bound — safe to run high
DEFAULT_DELAY       = 0.1         # Seconds between requests per worker
DEFAULT_OUTPUT_DIR  = Path("./output")
DEFAULT_PER_PAGE    = 20          # Listing page size (site ignores this, uses ~50)
DEFAULT_FRESH_DAYS  = 7           # Re-scrape batches last done within N days (weekly mode)
REQUEST_TIMEOUT     = 90          # Seconds
MAX_RETRIES         = 4
RETRY_BACKOFF       = [2, 4, 8, 16]  # Seconds per retry attempt
DB_PATH             = Path("./scraper_state.db")
DISK_RESERVE_MB     = 500         # Stop downloading PDFs if free space drops below this
PROGRESS_LOG_EVERY  = 200         # Log a running total every N new docs

BASE_URL = "https://new.kenyalaw.org"

# ─── Court taxonomy ───────────────────────────────────────────────────────────

COURTS = {
    # Superior Courts
    "KESC":   ("Superior Courts", "Supreme Court"),
    "KECA":   ("Superior Courts", "Court of Appeal"),
    "KEHC":   ("Superior Courts", "High Court"),
    "KEELRC": ("Superior Courts", "Employment and Labour Relations Court"),
    "KEELC":  ("Superior Courts", "Environment and Land Court"),
    "KEIC":   ("Superior Courts", "Industrial Court"),
    # Subordinate Courts
    "KEMC":   ("Subordinate Courts", "Magistrates Court"),
    "KEKC":   ("Subordinate Courts", "Kadhis Courts"),
    # Small Claims
    "SCC":    ("Small Claims", "Small Claims Court"),
    # Tribunals
    "KETAT":  ("Tribunals", "Tax Appeals Tribunal"),
    "KEPLC":  ("Tribunals", "Political Parties Disputes Tribunal"),
    "KECPT":  ("Tribunals", "Competition Tribunal"),
    "KEBRT":  ("Tribunals", "Banking and Financial Services Tribunal"),
    "KEENT":  ("Tribunals", "Energy Tribunal"),
    "KEWRT":  ("Tribunals", "Water Tribunal"),
    "KELAT":  ("Tribunals", "Land Acquisition Tribunal"),
    # Regional / International
    "AfCHPR": ("International", "African Court on Human and Peoples Rights"),
    "CT":     ("International", "Continental Court"),
}

LEGISLATION_VARIANTS = [
    ("acts_in_force",   "/legislation/"),
    ("subsidiary",      "/legislation/subsidiary"),
    ("uncommenced",     "/legislation/uncommenced"),
    ("repealed",        "/legislation/repealed"),
]

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("scraper.log"),
    ],
)
log = logging.getLogger(__name__)

# ─── Progress counter (shared across all workers) ─────────────────────────────

class ProgressTracker:
    def __init__(self):
        self._lock = asyncio.Lock()
        self.new_docs = 0          # New docs added this session
        self.skipped = 0           # Already-done docs skipped
        self.pdf_failed = 0        # Docs where PDF download failed
        self.start_time = time.time()

    async def record_new(self, had_pdf: bool):
        async with self._lock:
            self.new_docs += 1
            if not had_pdf:
                self.pdf_failed += 1
            if self.new_docs % PROGRESS_LOG_EVERY == 0:
                elapsed = time.time() - self.start_time
                rate = self.new_docs / elapsed * 60 if elapsed > 0 else 0
                log.info(
                    f"── Progress: {self.new_docs:,} new docs this session "
                    f"| {self.skipped:,} skipped | {self.pdf_failed} pdf-failures "
                    f"| {rate:.0f} docs/min ──"
                )

    async def record_skip(self):
        async with self._lock:
            self.skipped += 1

_progress = ProgressTracker()

# ─── Disk space guard ─────────────────────────────────────────────────────────

_disk_full = False   # Set to True once we detect low space; stops PDF writes

def check_disk_space(output_dir: Path) -> bool:
    """Returns True if there is enough free space to continue writing PDFs."""
    global _disk_full
    if _disk_full:
        return False
    try:
        usage = shutil.disk_usage(output_dir)
        free_mb = usage.free / (1024 * 1024)
        if free_mb < DISK_RESERVE_MB:
            log.error(
                f"DISK SPACE CRITICAL: only {free_mb:.0f} MB free "
                f"(reserve is {DISK_RESERVE_MB} MB). "
                f"PDF downloads paused — metadata still being saved."
            )
            _disk_full = True
            return False
    except OSError:
        pass
    return True

# ─── Data model ───────────────────────────────────────────────────────────────

@dataclass
class DocRecord:
    # Identity
    url: str
    doc_type: str           # judgment | legislation | gazette
    # Metadata
    title: str = ""
    court: str = ""
    court_class: str = ""   # Superior Courts | Subordinate Courts | Tribunals
    court_station: str = ""
    court_division: str = ""
    case_number: str = ""
    judges: str = ""
    date: str = ""
    year: str = ""
    citation: str = ""
    outcome: str = ""
    language: str = ""
    action_type: str = ""   # Judgment | Ruling | Order
    # For legislation
    cap_number: str = ""
    # Storage
    pdf_url: str = ""
    local_path: str = ""    # Relative path within output_dir
    pdf_size_bytes: int = 0
    scraped_at: str = ""

# ─── Database ─────────────────────────────────────────────────────────────────

def init_db(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")   # Safe for concurrent writes
    conn.execute("PRAGMA synchronous=NORMAL") # Fast but safe
    conn.execute("""
        CREATE TABLE IF NOT EXISTS docs (
            url          TEXT PRIMARY KEY,
            doc_type     TEXT,
            title        TEXT,
            court        TEXT,
            court_class  TEXT,
            court_station TEXT,
            court_division TEXT,
            case_number  TEXT,
            judges       TEXT,
            date         TEXT,
            year         TEXT,
            citation     TEXT,
            outcome      TEXT,
            language     TEXT,
            action_type  TEXT,
            cap_number   TEXT,
            pdf_url      TEXT,
            local_path   TEXT,
            pdf_size_bytes INTEGER DEFAULT 0,
            scraped_at   TEXT,
            pdf_ok       INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS crawl_state (
            key        TEXT PRIMARY KEY,
            done       INTEGER DEFAULT 0,
            item_count INTEGER DEFAULT 0,
            updated_at TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_docs_type ON docs(doc_type)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_docs_court ON docs(court)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_docs_year ON docs(year)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_docs_pdf_ok ON docs(pdf_ok)")
    conn.commit()
    return conn


# Thread-safe DB lock for concurrent writes
_db_lock = asyncio.Lock()


async def db_is_done(conn, key: str, fresh_days: int = 0) -> bool:
    """
    Returns True if this key is marked done.
    If fresh_days > 0, treats entries older than fresh_days as NOT done
    so they get re-crawled (catches new documents added to the site).
    """
    row = conn.execute(
        "SELECT done, updated_at FROM crawl_state WHERE key=?", (key,)
    ).fetchone()
    if not row or not row[0]:
        return False
    if fresh_days > 0 and row[1]:
        try:
            updated = datetime.fromisoformat(row[1])
            if datetime.now(timezone.utc) - updated < timedelta(days=fresh_days):
                return False  # Re-crawl — may have new docs since last visit
        except ValueError:
            pass
    return True


async def db_mark_done(conn, key: str, count: int = 0):
    async with _db_lock:
        conn.execute(
            "INSERT OR REPLACE INTO crawl_state(key,done,item_count,updated_at) VALUES(?,1,?,?)",
            (key, count, datetime.now(timezone.utc).isoformat())
        )
        conn.commit()


async def db_doc_exists(conn, url: str) -> bool:
    """
    Returns True only if the doc was successfully saved WITH a PDF.
    Docs with pdf_ok=0 (failed PDF download) will be retried.
    """
    row = conn.execute("SELECT pdf_ok FROM docs WHERE url=?", (url,)).fetchone()
    return bool(row and row[0] == 1)


async def db_save_doc(conn, rec: DocRecord, meta_dir: Path):
    pdf_ok = 1 if rec.pdf_size_bytes > 0 else 0  # Only mark OK if PDF actually saved

    async with _db_lock:
        conn.execute("""
            INSERT OR REPLACE INTO docs
            (url,doc_type,title,court,court_class,court_station,court_division,
             case_number,judges,date,year,citation,outcome,language,action_type,
             cap_number,pdf_url,local_path,pdf_size_bytes,scraped_at,pdf_ok)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            rec.url, rec.doc_type, rec.title, rec.court, rec.court_class,
            rec.court_station, rec.court_division, rec.case_number, rec.judges,
            rec.date, rec.year, rec.citation, rec.outcome, rec.language,
            rec.action_type, rec.cap_number, rec.pdf_url, rec.local_path,
            rec.pdf_size_bytes, rec.scraped_at, pdf_ok,
        ))
        conn.commit()

    # Append to JSONL metadata file
    jsonl_path = meta_dir / f"{rec.doc_type}s.jsonl"
    async with aiofiles.open(jsonl_path, "a", encoding="utf-8") as f:
        await f.write(json.dumps(asdict(rec), ensure_ascii=False) + "\n")


def print_stats(db_path: Path):
    """Print current DB stats and exit. Used by --stats flag."""
    if not db_path.exists():
        print(f"No database found at {db_path}")
        return

    conn = sqlite3.connect(str(db_path))
    print("\n" + "═" * 60)
    print("  WAKILI SCRAPER — CURRENT PROGRESS")
    print("═" * 60)

    total_docs = 0
    total_pdfs = 0
    total_bytes = 0

    for dt in ["judgment", "legislation", "gazette"]:
        total   = conn.execute("SELECT COUNT(*) FROM docs WHERE doc_type=?", (dt,)).fetchone()[0]
        with_pdf = conn.execute(
            "SELECT COUNT(*) FROM docs WHERE doc_type=? AND pdf_ok=1", (dt,)
        ).fetchone()[0]
        no_pdf  = conn.execute(
            "SELECT COUNT(*) FROM docs WHERE doc_type=? AND pdf_ok=0", (dt,)
        ).fetchone()[0]
        size    = conn.execute(
            "SELECT SUM(pdf_size_bytes) FROM docs WHERE doc_type=?", (dt,)
        ).fetchone()[0] or 0
        print(f"\n  {dt.upper()}S")
        print(f"    Records      : {total:>10,}")
        print(f"    PDFs saved   : {with_pdf:>10,}")
        print(f"    PDF missing  : {no_pdf:>10,}  ← will retry on next run")
        print(f"    Storage used : {size/1e9:>10.2f} GB")
        total_docs  += total
        total_pdfs  += with_pdf
        total_bytes += size

    # Crawl state summary
    done_batches = conn.execute("SELECT COUNT(*) FROM crawl_state WHERE done=1").fetchone()[0]
    total_batches = conn.execute("SELECT COUNT(*) FROM crawl_state").fetchone()[0]

    print("\n" + "─" * 60)
    print(f"  TOTAL DOCUMENTS  : {total_docs:>10,}")
    print(f"  TOTAL PDFs SAVED : {total_pdfs:>10,}")
    print(f"  TOTAL STORAGE    : {total_bytes/1e9:>10.2f} GB")
    print(f"  CRAWL BATCHES    : {done_batches:,} / {total_batches:,} done")

    # Per-court breakdown
    print("\n  JUDGMENTS BY COURT:")
    rows = conn.execute("""
        SELECT court, COUNT(*) as n, SUM(pdf_size_bytes)/1e6 as mb
        FROM docs WHERE doc_type='judgment'
        GROUP BY court ORDER BY n DESC
    """).fetchall()
    for court, n, mb in rows:
        print(f"    {(court or 'UNKNOWN'):<12}  {n:>8,} docs   {(mb or 0):>8.0f} MB")

    # Recent activity
    recent = conn.execute("""
        SELECT DATE(scraped_at) as day, COUNT(*) as n
        FROM docs WHERE scraped_at IS NOT NULL
        GROUP BY day ORDER BY day DESC LIMIT 7
    """).fetchall()
    if recent:
        print("\n  RECENT ACTIVITY (last 7 days scraped):")
        for day, n in recent:
            print(f"    {day}  {n:>8,} docs")

    print("\n" + "═" * 60 + "\n")
    conn.close()

# ─── HTTP ─────────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}


async def fetch(
    session: aiohttp.ClientSession,
    url: str,
    sem: asyncio.Semaphore,
    delay: float,
    binary: bool = False,
) -> Optional[bytes | str]:
    async with sem:
        await asyncio.sleep(delay)
        for attempt, wait in enumerate(RETRY_BACKOFF):
            try:
                async with session.get(
                    url,
                    headers=HEADERS,
                    timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT),
                    allow_redirects=True,
                ) as r:
                    if r.status == 200:
                        return await r.read() if binary else await r.text()
                    if r.status in (404, 410):
                        return None
                    if r.status == 429:
                        log.warning(f"Rate limited — waiting {wait}s: {url}")
                        await asyncio.sleep(wait)
                        continue
                    log.debug(f"HTTP {r.status}: {url}")
                    await asyncio.sleep(wait)
            except asyncio.TimeoutError:
                log.debug(f"Timeout attempt {attempt+1}: {url}")
                await asyncio.sleep(wait)
            except aiohttp.ClientError as e:
                log.debug(f"Client error attempt {attempt+1}: {e}")
                await asyncio.sleep(wait)
        log.warning(f"Failed after {len(RETRY_BACKOFF)} attempts: {url}")
        return None

# ─── HTML Parsers ─────────────────────────────────────────────────────────────

def parse_listing(html: str) -> tuple[list[dict], bool]:
    """
    Parse a listing page.
    Returns: (list of {url, title}, has_more_pages)
    """
    soup = BeautifulSoup(html, "html.parser")
    seen = set()
    docs = []

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if re.match(r"^/akn/ke/(judgment|act|officialGazette)/", href):
            url = BASE_URL + href
            if url not in seen:
                seen.add(url)
                docs.append({"url": url, "title": a.get_text(strip=True) or href})

    has_more = len(docs) >= 10
    return docs, has_more


def parse_doc_page(html: str, url: str, doc_type: str) -> DocRecord:
    """Extract metadata from a document page."""
    soup = BeautifulSoup(html, "html.parser")

    h1 = soup.find("h1")
    title = h1.get_text(strip=True) if h1 else url.split("/")[-1]

    meta = {}
    for dt, dd in zip(soup.find_all("dt"), soup.find_all("dd")):
        key = dt.get_text(strip=True).lower()
        dd_c = BeautifulSoup(str(dd), "html.parser")
        for btn in dd_c.find_all("button"):
            btn.decompose()
        meta[key] = dd_c.get_text(strip=True)

    pdf_url = ""
    for a in soup.find_all("a", href=True):
        if re.search(r"download pdf", a.get_text(strip=True), re.I):
            h = a["href"]
            pdf_url = h if h.startswith("http") else BASE_URL + h
            break
    if not pdf_url:
        pdf_url = url + "/source"

    court = ""
    m = re.search(r"/akn/ke/judgment/([^/]+)/", url)
    if m:
        court = m.group(1).upper()

    year = ""
    m = re.search(r"/(\d{4})/", url)
    if m:
        year = m.group(1)

    court_class, _ = COURTS.get(court, ("", ""))

    return DocRecord(
        url=url,
        doc_type=doc_type,
        title=title,
        court=court or meta.get("court", ""),
        court_class=court_class,
        court_station=meta.get("court station", ""),
        court_division=meta.get("court division", ""),
        case_number=meta.get("case number", ""),
        judges=meta.get("judges", meta.get("judge", "")),
        date=meta.get("judgment date", meta.get("date", "")),
        year=year,
        citation=meta.get("media neutral citation", meta.get("citation", "")),
        outcome=meta.get("outcome", ""),
        language=meta.get("language", ""),
        action_type=meta.get("case action", meta.get("type", "")),
        pdf_url=pdf_url,
        scraped_at=datetime.now(timezone.utc).isoformat(),
    )


def doc_local_path(rec: DocRecord, variant: str = "") -> str:
    """
    Determine the organised local path for a document's PDF.

    Judgments:   case_law/{COURT}/{station_slug}/{year}/{month}/{citation_slug}.pdf
    Legislation: legislation/{variant}/{title_slug}.pdf
    Gazettes:    gazettes/{year}/{title_slug}.pdf
    """
    def slug(s: str) -> str:
        s = re.sub(r"[^\w\s-]", "", s or "unknown").strip()
        return re.sub(r"[\s_]+", "_", s)[:80]

    if rec.doc_type == "judgment":
        court = rec.court or "UNKNOWN"
        station = slug(rec.court_station) or "general"
        year = rec.year or "unknown_year"
        month = "00"
        if rec.date:
            m = re.search(r"\b(0?[1-9]|1[0-2])\b", rec.date)
            if m:
                month = m.group(1).zfill(2)
            else:
                months = {
                    "january": "01", "february": "02", "march": "03",
                    "april": "04", "may": "05", "june": "06",
                    "july": "07", "august": "08", "september": "09",
                    "october": "10", "november": "11", "december": "12",
                }
                for name, num in months.items():
                    if name in rec.date.lower():
                        month = num
                        break
        citation = slug(rec.citation or rec.case_number or rec.title)
        return f"case_law/{court}/{station}/{year}/{month}/{citation}.pdf"

    if rec.doc_type == "legislation":
        var = variant or "acts_in_force"
        title = slug(rec.title)
        return f"legislation/{var}/{title}.pdf"

    if rec.doc_type == "gazette":
        year = rec.year
        if not year:
            m = re.search(r"/(\d{4})/", rec.url)
            year = m.group(1) if m else "unknown"
        title = slug(rec.title or rec.url.split("/")[-1])
        return f"gazettes/{year}/{title}.pdf"

    return f"other/{slug(rec.title)}.pdf"


def get_sub_links(html: str, path_prefix: str) -> list[str]:
    """Extract child navigation links starting with path_prefix."""
    soup = BeautifulSoup(html, "html.parser")
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith(path_prefix) and href != path_prefix and href not in links:
            links.append(href)
    return links


def get_gazette_years(html: str) -> list[int]:
    soup = BeautifulSoup(html, "html.parser")
    years = []
    for a in soup.find_all("a", href=True):
        m = re.match(r"^/gazettes/(\d{4})/?$", a["href"])
        if m:
            years.append(int(m.group(1)))
    return sorted(set(years))

# ─── Core download pipeline ───────────────────────────────────────────────────

async def download_doc(
    session: aiohttp.ClientSession,
    sem: asyncio.Semaphore,
    conn: sqlite3.Connection,
    doc_url: str,
    doc_type: str,
    output_dir: Path,
    meta_dir: Path,
    delay: float,
    variant: str = "",
) -> bool:
    """Fetch a document page, extract metadata, download the PDF, save both."""
    if await db_doc_exists(conn, doc_url):
        await _progress.record_skip()
        return False  # Already done with PDF confirmed

    html = await fetch(session, doc_url, sem, delay)
    if not html:
        return False

    rec = parse_doc_page(html, doc_url, doc_type)
    rec.local_path = doc_local_path(rec, variant)

    pdf_dest = output_dir / rec.local_path
    if pdf_dest.exists() and pdf_dest.stat().st_size > 1024:
        # File already on disk — just record metadata
        rec.pdf_size_bytes = pdf_dest.stat().st_size
    elif check_disk_space(output_dir):
        pdf_dest.parent.mkdir(parents=True, exist_ok=True)
        pdf_data = await fetch(session, rec.pdf_url, sem, delay, binary=True)
        if pdf_data and len(pdf_data) > 1024:
            async with aiofiles.open(pdf_dest, "wb") as f:
                await f.write(pdf_data)
            rec.pdf_size_bytes = len(pdf_data)
        else:
            rec.pdf_size_bytes = 0  # PDF unavailable — will retry next run
    else:
        rec.pdf_size_bytes = 0  # Disk full — save metadata only, retry next run

    await db_save_doc(conn, rec, meta_dir)
    await _progress.record_new(had_pdf=rec.pdf_size_bytes > 0)
    return True


async def process_listing_url(
    session: aiohttp.ClientSession,
    sem: asyncio.Semaphore,
    conn: sqlite3.Connection,
    listing_url: str,
    doc_type: str,
    output_dir: Path,
    meta_dir: Path,
    delay: float,
    label: str,
    pbar: tqdm,
    variant: str = "",
    fresh_days: int = 0,
):
    """Paginate through a listing URL and download all documents."""
    page = 1
    consecutive_empty = 0

    while True:
        page_key = f"page::{listing_url}::{page}"
        if await db_is_done(conn, page_key, fresh_days=fresh_days):
            page += 1
            if page > 5000:
                break
            continue

        url = f"{listing_url}?page={page}&per_page={DEFAULT_PER_PAGE}"
        html = await fetch(session, url, sem, delay)
        if not html:
            consecutive_empty += 1
            if consecutive_empty >= 3:
                break
            page += 1
            continue

        items, has_more = parse_listing(html)

        if not items:
            break

        consecutive_empty = 0
        log.info(f"{label} p{page}: {len(items)} docs")

        tasks = [
            download_doc(session, sem, conn, item["url"], doc_type,
                         output_dir, meta_dir, delay, variant)
            for item in items
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        new_count = sum(1 for r in results if r is True)
        if pbar is not None:
            pbar.update(new_count)

        await db_mark_done(conn, page_key, len(items))

        if not has_more:
            break
        page += 1

# ─── Judgment scraper — full hierarchy ────────────────────────────────────────

async def scrape_judgments(
    session, sem, conn, output_dir, meta_dir, delay, courts_filter, pbar, fresh_days
):
    """
    Traverse: court → station → year → month
    Keeps each leaf listing small (<200 docs) — no pagination limit issues.
    """
    target = courts_filter or list(COURTS.keys())

    for court_code in target:
        court_class, court_name = COURTS.get(court_code, ("", court_code))
        court_path = f"/judgments/{court_code}/"
        log.info(f"Court: {court_name} ({court_code})")

        court_html = await fetch(session, BASE_URL + court_path, sem, delay)
        if not court_html:
            log.warning(f"  Could not reach {court_code}")
            continue

        station_paths = [
            p for p in get_sub_links(court_html, court_path)
            if not re.search(r"/\d{4}/?$", p)
        ] or [court_path]

        for station_path in station_paths:
            station_html = await fetch(session, BASE_URL + station_path, sem, delay)
            if not station_html:
                continue

            year_paths = [
                p for p in get_sub_links(station_html, station_path)
                if re.search(r"/\d{4}/?$", p)
            ]

            if not year_paths:
                await process_listing_url(
                    session, sem, conn, BASE_URL + station_path, "judgment",
                    output_dir, meta_dir, delay,
                    f"[{station_path.strip('/')}]", pbar,
                    fresh_days=fresh_days,
                )
                continue

            for year_path in sorted(year_paths, reverse=True):
                year_key = f"year::{year_path}"
                # For fresh_days runs, always re-check the 2 most recent years
                year_match = re.search(r"/(\d{4})/?$", year_path)
                current_year = datetime.now().year
                is_recent_year = year_match and int(year_match.group(1)) >= current_year - 1

                if not is_recent_year and await db_is_done(conn, year_key, fresh_days=0):
                    continue

                year_html = await fetch(session, BASE_URL + year_path, sem, delay)
                if not year_html:
                    continue

                month_paths = [
                    p for p in get_sub_links(year_html, year_path)
                    if re.search(r"/\d{4}/\d{1,2}/?$", p)
                ]

                if not month_paths:
                    await process_listing_url(
                        session, sem, conn, BASE_URL + year_path, "judgment",
                        output_dir, meta_dir, delay,
                        f"[{year_path.strip('/')}]", pbar,
                        fresh_days=fresh_days if is_recent_year else 0,
                    )
                else:
                    for month_path in sorted(month_paths, reverse=True):
                        month_key = f"month::{month_path}"
                        month_match = re.search(r"/(\d{4})/(\d{1,2})/?$", month_path)
                        is_recent_month = (
                            month_match and
                            int(month_match.group(1)) >= current_year - 1
                        )
                        effective_fresh = fresh_days if is_recent_month else 0
                        if await db_is_done(conn, month_key, fresh_days=effective_fresh):
                            continue
                        await process_listing_url(
                            session, sem, conn, BASE_URL + month_path, "judgment",
                            output_dir, meta_dir, delay,
                            f"[{month_path.strip('/')}]", pbar,
                            fresh_days=effective_fresh,
                        )
                        await db_mark_done(conn, month_key)

                await db_mark_done(conn, year_key)


# ─── Legislation scraper ───────────────────────────────────────────────────────

async def scrape_legislation(
    session, sem, conn, output_dir, meta_dir, delay, pbar, fresh_days
):
    for variant_name, variant_path in LEGISLATION_VARIANTS:
        var_key = f"legislation_variant::{variant_name}"
        if await db_is_done(conn, var_key, fresh_days=fresh_days):
            continue
        log.info(f"Legislation: {variant_name}")
        await process_listing_url(
            session, sem, conn, BASE_URL + variant_path, "legislation",
            output_dir, meta_dir, delay, f"[LEG:{variant_name}]", pbar,
            variant=variant_name, fresh_days=fresh_days,
        )
        await db_mark_done(conn, var_key)


# ─── Gazette scraper ───────────────────────────────────────────────────────────

async def scrape_gazettes(
    session, sem, conn, output_dir, meta_dir, delay, years_filter, pbar, fresh_days
):
    index_html = await fetch(session, f"{BASE_URL}/gazettes/", sem, delay)
    if not index_html:
        log.error("Cannot reach gazettes index")
        return

    all_years = get_gazette_years(index_html)
    years = years_filter or all_years
    log.info(f"Gazettes: {len(years)} years to scrape")

    current_year = datetime.now().year
    for year in sorted(years, reverse=True):
        year_key = f"gazette_year::{year}"
        is_recent = year >= current_year - 1
        effective_fresh = fresh_days if is_recent else 0
        if await db_is_done(conn, year_key, fresh_days=effective_fresh):
            continue

        year_html = await fetch(session, f"{BASE_URL}/gazettes/{year}", sem, delay)
        if not year_html:
            continue

        soup = BeautifulSoup(year_html, "html.parser")
        issue_links = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if re.match(r"^/akn/ke/officialGazette/", href):
                url = BASE_URL + href
                if url not in [i["url"] for i in issue_links]:
                    issue_links.append({"url": url, "title": a.get_text(strip=True) or href})

        log.info(f"  Gazettes/{year}: {len(issue_links)} issues")

        tasks = [
            download_doc(session, sem, conn, issue["url"], "gazette",
                         output_dir, meta_dir, delay)
            for issue in issue_links
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        new = sum(1 for r in results if r is True)
        if pbar is not None:
            pbar.update(new)

        await db_mark_done(conn, year_key, len(issue_links))


# ─── Final stats ──────────────────────────────────────────────────────────────

def log_final_stats(db_path: Path, elapsed: float):
    conn = sqlite3.connect(str(db_path))
    log.info("─" * 50)
    log.info("FINAL STATS")
    for dt in ["judgment", "legislation", "gazette"]:
        total    = conn.execute("SELECT COUNT(*) FROM docs WHERE doc_type=?", (dt,)).fetchone()[0]
        with_pdf = conn.execute("SELECT COUNT(*) FROM docs WHERE doc_type=? AND pdf_ok=1", (dt,)).fetchone()[0]
        no_pdf   = conn.execute("SELECT COUNT(*) FROM docs WHERE doc_type=? AND pdf_ok=0", (dt,)).fetchone()[0]
        size     = conn.execute("SELECT SUM(pdf_size_bytes) FROM docs WHERE doc_type=?", (dt,)).fetchone()[0] or 0
        log.info(f"  {dt}s: {total:,} records | {with_pdf:,} PDFs saved | {no_pdf:,} PDF-missing | {size/1e9:.2f} GB")
    log.info(f"  New this session: {_progress.new_docs:,} | Skipped (already done): {_progress.skipped:,}")
    log.info(f"  Total time: {elapsed/3600:.1f}h ({elapsed:.0f}s)")
    conn.close()


# ─── Main ─────────────────────────────────────────────────────────────────────

async def run(
    modes: list[str],
    output_dir: Path,
    workers: int,
    delay: float,
    courts_filter: Optional[list[str]],
    years_filter: Optional[list[int]],
    fresh_days: int,
    db_path: Path,
):
    output_dir.mkdir(parents=True, exist_ok=True)
    meta_dir = output_dir / "metadata"
    meta_dir.mkdir(exist_ok=True)

    conn = init_db(db_path)
    sem = asyncio.Semaphore(workers)

    connector = aiohttp.TCPConnector(
        limit=workers,
        limit_per_host=workers,
        ssl=False,
        keepalive_timeout=60,
        enable_cleanup_closed=True,
    )
    timeout = aiohttp.ClientTimeout(total=REQUEST_TIMEOUT, connect=15)

    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:

        if "judgments" in modes:
            with tqdm(desc="Judgments (PDFs)", unit="doc", dynamic_ncols=True) as pbar:
                await scrape_judgments(
                    session, sem, conn, output_dir, meta_dir, delay,
                    courts_filter, pbar, fresh_days
                )

        if "legislation" in modes:
            with tqdm(desc="Legislation (PDFs)", unit="doc", dynamic_ncols=True) as pbar:
                await scrape_legislation(
                    session, sem, conn, output_dir, meta_dir, delay, pbar, fresh_days
                )

        if "gazettes" in modes:
            with tqdm(desc="Gazettes (PDFs)", unit="doc", dynamic_ncols=True) as pbar:
                await scrape_gazettes(
                    session, sem, conn, output_dir, meta_dir, delay,
                    years_filter, pbar, fresh_days
                )


def main():
    parser = argparse.ArgumentParser(
        description="Kenya Law document scraper — downloads actual PDFs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--mode", choices=["all", "judgments", "legislation", "gazettes"],
                        default="all")
    parser.add_argument("--court", nargs="+", metavar="CODE",
                        help="Filter courts, e.g. --court KEHC KECA")
    parser.add_argument("--years", nargs="+", type=int,
                        help="Filter gazette years, e.g. --years 2020 2021")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS,
                        help=f"Concurrent connections (default: {DEFAULT_WORKERS})")
    parser.add_argument("--delay", type=float, default=DEFAULT_DELAY,
                        help=f"Delay per request in seconds (default: {DEFAULT_DELAY})")
    parser.add_argument("--fresh-days", type=int, default=0,
                        help=(
                            "Re-crawl batches last scraped within N days to pick up new docs. "
                            "Set to 7 for weekly runs. Default: 0 (full resume, skip done batches)."
                        ))
    parser.add_argument("--db-path", type=Path, default=DB_PATH,
                        help=f"Path to SQLite state DB (default: {DB_PATH})")
    parser.add_argument("--stats", action="store_true",
                        help="Print current DB stats and exit (no scraping)")
    parser.add_argument("--list-courts", action="store_true",
                        help="List all court codes and exit")

    args = parser.parse_args()

    if args.list_courts:
        print(f"\n{'Code':<12} {'Class':<22} {'Name'}")
        print(f"{'-'*12} {'-'*22} {'-'*40}")
        for code, (cls, name) in COURTS.items():
            print(f"{code:<12} {cls:<22} {name}")
        sys.exit(0)

    if args.stats:
        print_stats(args.db_path)
        sys.exit(0)

    modes = [args.mode] if args.mode != "all" else ["judgments", "legislation", "gazettes"]
    courts_filter = [c.upper() for c in args.court] if args.court else None
    years_filter = args.years or None

    log.info("=" * 60)
    log.info("Kenya Law Document Scraper")
    log.info(f"  Modes:      {modes}")
    log.info(f"  Courts:     {courts_filter or 'ALL'}")
    log.info(f"  Years:      {years_filter or 'ALL'}")
    log.info(f"  Output:     {args.output_dir}")
    log.info(f"  Workers:    {args.workers}")
    log.info(f"  Delay:      {args.delay}s")
    log.info(f"  DB:         {args.db_path}")
    log.info(f"  Fresh days: {args.fresh_days} ({'re-check recent batches' if args.fresh_days else 'full resume mode'})")
    log.info("  Downloads:  PDFs saved to disk (always on)")
    log.info("=" * 60)

    t0 = time.time()
    asyncio.run(run(
        modes=modes,
        output_dir=args.output_dir,
        workers=args.workers,
        delay=args.delay,
        courts_filter=courts_filter,
        years_filter=years_filter,
        fresh_days=args.fresh_days,
        db_path=args.db_path,
    ))
    log_final_stats(args.db_path, time.time() - t0)


if __name__ == "__main__":
    main()
