#!/usr/bin/env python3
"""log_case.py - Persistent case storage and map/reduce pipeline for Power Platform log analysis.

Standard-library only. No network calls. No execution of log content.

This tool is the deterministic backbone for a hierarchical map/reduce log-analysis
workflow used by an LLM agent (see SKILL.md). It never performs the actual
diagnostic reasoning itself: it ingests, normalizes, deduplicates, batches, and
tracks coverage/state so that an agent can analyze bounded chunks of data and
have its structured findings validated, stored, and later reduced/exported.

Commands (see `--help` on each for details):
  init             Create a new case (SQLite-backed) in a case directory.
  ingest           Ingest one or more files/directories into the case.
  overview         Print deterministic overview statistics for the case.
  batch build      Build correlation-aware bounded batches (JSONL + manifest).
  batch list       List batches (optionally only pending ones).
  batch show       Show details of one batch.
  batch template   Emit the batch-summary JSON template to fill in.
  batch put-summary  Validate and store a structured batch summary.
  reduce build     Build a bounded reduction pack from pending summaries.
  reduce list      List reduction packs.
  reduce template  Emit the reduction-summary JSON template.
  reduce put-summary Validate and store a reduction summary.
  coverage         Report factual coverage of the case (batches/reductions).
  report template  Emit the final-report JSON template.
  report export    Export a final structured report to JSON/Markdown/HTML/CSV.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import sqlite3
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = 1
TOOL_VERSION = "1.0.0"

# --------------------------------------------------------------------------
# Generic helpers
# --------------------------------------------------------------------------

GUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
NUMBER_RE = re.compile(r"\d+")
ISO_TZ_RE = re.compile(r"(Z|[+-]\d{2}:?\d{2})$")


class CaseError(Exception):
    """Raised for user-facing validation/usage errors (no traceback needed)."""


def atomic_write_bytes(path: Path, data: bytes) -> None:
    """Write bytes to `path` atomically (write temp file + os.replace)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=".tmp-", dir=str(path.parent))
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            try:
                os.remove(tmp_name)
            except OSError:
                pass


def atomic_write_text(path: Path, text: str) -> None:
    atomic_write_bytes(path, text.encode("utf-8"))


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def canonical_json(obj) -> str:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str)


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def normalize_template(text: str, max_len: int = 400) -> str:
    """Replace volatile tokens (GUIDs, numbers) with placeholders for fuzzy fingerprinting."""
    if not text:
        return ""
    t = text[:max_len]
    t = GUID_RE.sub("<guid>", t)
    t = NUMBER_RE.sub("<n>", t)
    return t.strip().lower()


# --------------------------------------------------------------------------
# Time / value parsing
# --------------------------------------------------------------------------

_DT_FORMATS = [
    "%m/%d/%Y %I:%M:%S %p",
    "%m/%d/%Y %H:%M:%S",
    "%Y-%m-%d %H:%M:%S.%f",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S.%f",
    "%Y-%m-%dT%H:%M:%S",
]


def parse_datetime(raw):
    """Best-effort parse of a timestamp. Returns (iso_string_or_None, tz_known_bool).

    Never raises; caveats about assumed timezone must be surfaced by the agent
    (see SKILL.md timezone caveat section) since source timezone is often unknown.
    """
    if raw is None:
        return None, False
    if isinstance(raw, (int, float)):
        try:
            # Heuristic: treat >= 10^12 as milliseconds since epoch, else seconds.
            val = float(raw)
            if val > 1e12:
                val = val / 1000.0
            dt = datetime.fromtimestamp(val, tz=timezone.utc)
            return dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ"), True
        except (ValueError, OSError, OverflowError):
            return None, False
    if not isinstance(raw, str):
        return None, False
    s = raw.strip()
    if not s:
        return None, False
    tz_known = bool(ISO_TZ_RE.search(s))
    s_norm = s
    if s_norm.endswith("Z"):
        s_norm = s_norm[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s_norm)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc)
            return dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ"), True
        return dt.strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z", False
    except ValueError:
        pass
    for fmt in _DT_FORMATS:
        try:
            dt = datetime.strptime(s, fmt)
            return dt.strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z", False
        except ValueError:
            continue
    return None, False


def to_float(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def to_bool(v):
    if isinstance(v, bool):
        return v
    if v is None:
        return None
    s = str(v).strip().lower()
    if s in ("true", "1", "yes"):
        return True
    if s in ("false", "0", "no"):
        return False
    return None


SEVERITY_MAP = {
    "0": "Verbose", "1": "Information", "2": "Warning", "3": "Error", "4": "Critical",
    "verbose": "Verbose", "trace": "Verbose", "debug": "Verbose",
    "information": "Information", "info": "Information",
    "warning": "Warning", "warn": "Warning",
    "error": "Error", "err": "Error",
    "critical": "Critical", "fatal": "Critical",
}


def normalize_severity(v):
    if v is None:
        return None
    key = str(v).strip().lower()
    return SEVERITY_MAP.get(key)


MODE_MAP = {"0": "Sync", "1": "Async", "sync": "Sync", "async": "Async", "synchronous": "Sync", "asynchronous": "Async"}


def normalize_mode(v):
    if v is None:
        return None
    return MODE_MAP.get(str(v).strip().lower())


# --------------------------------------------------------------------------
# Field alias tables (documented in references/data-model.md)
# --------------------------------------------------------------------------

# Each alias list is checked in order; first present, non-empty value wins.
ALIASES = {
    "correlation_id": ["correlationid", "correlation_id", "operation_id", "operationid"],
    "parent_id": ["operation_parentid", "operationparentid", "parentid", "parent_id"],
    "request_id": ["requestid", "request_id"],
    "event_time_raw": ["timestamp", "timegenerated", "createdon", "time", "eventtime", "date"],
    "duration_ms": ["performanceexecutionduration", "duration", "durationms", "duration_ms"],
    "constructor_duration_ms": ["performanceconstructorduration", "constructorduration"],
    "success_raw": ["success"],
    "severity_raw": ["severitylevel", "severity", "level"],
    "telemetry_type_raw": ["itemtype", "type", "telemetry_type"],
    "operation_name": ["operation_name", "operationname", "name"],
    "message_text": ["message", "messageblock", "message_text"],
    "exception_type": ["exceptiontype", "problemid", "exception_type"],
    "exception_text": ["exceptiondetails", "exceptions", "outermessage", "exception_text", "stacktrace", "stack_trace"],
    "plugin_type": ["typename", "plugin_type"],
    "message_name": ["messagename", "message_name"],
    "primary_entity": ["primaryentity", "primary_entity"],
    "plugin_step_id": ["pluginstepid", "plugin_step_id"],
    "mode_raw": ["mode"],
    "depth_raw": ["depth"],
    "role_name": ["cloud_rolename", "approlename", "role_name"],
    "result_code": ["resultcode", "result_code"],
    "target": ["target"],
    "source_event_id": ["id", "itemid", "requestid"],
    "operation_type_raw": ["operationtype", "operation_type"],
}


def _lower_key_map(raw: dict) -> dict:
    return {str(k).strip().lower(): v for k, v in raw.items()}


def first_alias(lower_raw: dict, keys):
    for k in keys:
        if k in lower_raw and lower_raw[k] not in (None, ""):
            return lower_raw[k]
    return None


def normalize_record(raw: dict, source_kind: str) -> dict:
    """Map a raw record (any supported source shape) onto the normalized schema.

    See references/data-model.md for the full field list and source mappings.
    """
    lower = _lower_key_map(raw)

    correlation_id = first_alias(lower, ALIASES["correlation_id"])
    parent_id = first_alias(lower, ALIASES["parent_id"])
    request_id = first_alias(lower, ALIASES["request_id"])
    event_time_raw = first_alias(lower, ALIASES["event_time_raw"])
    duration_ms = to_float(first_alias(lower, ALIASES["duration_ms"]))
    constructor_duration_ms = to_float(first_alias(lower, ALIASES["constructor_duration_ms"]))
    success = to_bool(first_alias(lower, ALIASES["success_raw"]))
    severity = normalize_severity(first_alias(lower, ALIASES["severity_raw"]))
    telemetry_type = first_alias(lower, ALIASES["telemetry_type_raw"])
    operation_name = first_alias(lower, ALIASES["operation_name"])
    message_text = first_alias(lower, ALIASES["message_text"])
    exception_type = first_alias(lower, ALIASES["exception_type"])
    exception_text = first_alias(lower, ALIASES["exception_text"])
    plugin_type = first_alias(lower, ALIASES["plugin_type"])
    message_name = first_alias(lower, ALIASES["message_name"])
    primary_entity = first_alias(lower, ALIASES["primary_entity"])
    plugin_step_id = first_alias(lower, ALIASES["plugin_step_id"])
    mode = normalize_mode(first_alias(lower, ALIASES["mode_raw"]))
    depth_raw = first_alias(lower, ALIASES["depth_raw"])
    role_name = first_alias(lower, ALIASES["role_name"])
    result_code = first_alias(lower, ALIASES["result_code"])
    target = first_alias(lower, ALIASES["target"])
    source_event_id = first_alias(lower, ALIASES["source_event_id"])

    event_time_iso, tz_known = parse_datetime(event_time_raw)

    depth = None
    if depth_raw not in (None, ""):
        try:
            depth = int(depth_raw)
        except (TypeError, ValueError):
            depth = None

    if telemetry_type is None:
        if plugin_type or plugin_step_id or message_name:
            telemetry_type = "plugintrace"
        elif exception_text or exception_type:
            telemetry_type = "exception"
        else:
            telemetry_type = "log"
    telemetry_type = str(telemetry_type).strip().lower()

    if success is None and telemetry_type in ("plugintrace", "exception") and (exception_text or exception_type):
        success = False

    normalized = {
        "event_time": event_time_iso,
        "event_time_raw": str(event_time_raw) if event_time_raw is not None else None,
        "tz_known": tz_known,
        "correlation_id": str(correlation_id) if correlation_id else None,
        "parent_id": str(parent_id) if parent_id else None,
        "request_id": str(request_id) if request_id else None,
        "duration_ms": duration_ms,
        "constructor_duration_ms": constructor_duration_ms,
        "success": success,
        "severity": severity,
        "telemetry_type": telemetry_type,
        "operation_name": str(operation_name) if operation_name else None,
        "message_text": str(message_text) if message_text is not None else None,
        "exception_type": str(exception_type) if exception_type else None,
        "exception_text": str(exception_text) if exception_text is not None else None,
        "plugin_type": str(plugin_type) if plugin_type else None,
        "message_name": str(message_name) if message_name else None,
        "primary_entity": str(primary_entity) if primary_entity else None,
        "plugin_step_id": str(plugin_step_id) if plugin_step_id else None,
        "mode": mode,
        "depth": depth,
        "role_name": str(role_name) if role_name else None,
        "result_code": str(result_code) if result_code else None,
        "target": str(target) if target else None,
        "source_event_id": str(source_event_id) if source_event_id else None,
        "source_kind": source_kind,
    }
    return normalized


def compute_fingerprint(normalized: dict) -> str:
    """Fuzzy grouping key: same shape of problem, ignoring volatile IDs/numbers."""
    basis = "|".join([
        normalized.get("telemetry_type") or "",
        normalized.get("exception_type") or "",
        normalize_template(normalized.get("exception_text") or normalized.get("message_text") or ""),
        normalized.get("plugin_type") or "",
        normalized.get("message_name") or "",
        normalized.get("primary_entity") or "",
    ])
    return sha256_text(basis)[:24]


# --------------------------------------------------------------------------
# Input parsing (JSON / JSONL / CSV / log-txt) with multiline preservation
# --------------------------------------------------------------------------

def flatten_json_value(obj):
    """Turn a parsed JSON document into a flat list of raw record dicts.

    Supports: a bare object, an array of objects, Log Analytics query export
    shape ({"tables": [{"columns": [...], "rows": [...]}]}), and Application
    Insights telemetry envelopes with a nested data.baseData object.
    """
    records = []
    if isinstance(obj, dict) and isinstance(obj.get("tables"), list):
        for table in obj["tables"]:
            cols = table.get("columns") or []
            colnames = [c.get("name") if isinstance(c, dict) else str(c) for c in cols]
            for row in table.get("rows") or []:
                if isinstance(row, list):
                    records.append({colnames[i]: row[i] for i in range(min(len(colnames), len(row)))})
                elif isinstance(row, dict):
                    records.append(row)
        return records
    if isinstance(obj, list):
        items = obj
    elif isinstance(obj, dict):
        found = None
        for key in ("value", "rows", "records", "items"):
            if isinstance(obj.get(key), list):
                found = obj[key]
                break
        items = found if found is not None else [obj]
    else:
        return [{"_raw_value": obj}]

    for item in items:
        if not isinstance(item, dict):
            records.append({"_raw_value": item})
            continue
        data = item.get("data")
        if isinstance(data, dict) and isinstance(data.get("baseData"), dict):
            flat = dict(data["baseData"])
            for k in ("time", "iKey", "name"):
                if k in item and k not in flat:
                    flat[k] = item[k]
            flat.setdefault("itemType", data.get("baseType"))
            records.append(flat)
        else:
            records.append(item)
    return records


LOG_LINE_START_RE = re.compile(
    r"^(?:\[?\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}|\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2}|"
    r"(ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL|CRITICAL)\b)",
    re.IGNORECASE,
)


def parse_log_text(text: str, source_name: str):
    """Parse a free-form .log/.txt file into events, preserving multiline stack traces.

    A new event starts at a line matching a leading timestamp or a log-level
    keyword; subsequent non-matching lines (e.g. `System.Exception ...` stack
    frames) are appended to the current event's message as continuation lines.
    """
    records = []
    issues = []
    current_lines = []

    def flush():
        if current_lines:
            first = current_lines[0]
            level_match = re.search(r"\b(ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL|CRITICAL)\b", first, re.IGNORECASE)
            ts_match = re.match(
                r"^\[?(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?|"
                r"\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2}(?:\s?[AP]M)?)",
                first,
            )
            records.append({
                "timestamp": ts_match.group(1) if ts_match else None,
                "level": level_match.group(1).upper() if level_match else None,
                "message": "\n".join(current_lines),
                "_source_file": source_name,
            })

    for raw_line in text.splitlines():
        if raw_line.strip() == "":
            if current_lines:
                current_lines.append(raw_line)
            continue
        if LOG_LINE_START_RE.match(raw_line) or not current_lines:
            flush()
            current_lines = [raw_line]
        else:
            current_lines.append(raw_line)
    flush()
    if not records and text.strip():
        issues.append({"reason": "no_recognizable_log_lines", "snippet": text[:300]})
    return records, issues


# --------------------------------------------------------------------------
# SQLite schema / case management
# --------------------------------------------------------------------------

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS case_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    kind TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size INTEGER NOT NULL,
    added_at TEXT NOT NULL,
    record_count INTEGER NOT NULL DEFAULT 0,
    issue_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(sha256)
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    seq_in_source INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    event_time TEXT,
    tz_known INTEGER NOT NULL DEFAULT 0,
    correlation_id TEXT,
    parent_id TEXT,
    severity TEXT,
    success INTEGER,
    duration_ms REAL,
    telemetry_type TEXT,
    operation_name TEXT,
    plugin_type TEXT,
    message_name TEXT,
    primary_entity TEXT,
    exception_type TEXT,
    raw_json TEXT NOT NULL,
    normalized_json TEXT NOT NULL,
    batch_id TEXT,
    duplicate_count INTEGER NOT NULL DEFAULT 1,
    UNIQUE(content_hash)
);
CREATE INDEX IF NOT EXISTS idx_events_correlation ON events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_time ON events(event_time);
CREATE INDEX IF NOT EXISTS idx_events_batch ON events(batch_id);

CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER,
    line_no INTEGER,
    reason TEXT NOT NULL,
    snippet TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    seq INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    event_count INTEGER NOT NULL,
    correlation_ids_json TEXT NOT NULL,
    time_range_start TEXT,
    time_range_end TEXT,
    file_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS batch_summaries (
    batch_id TEXT PRIMARY KEY,
    summary_json TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    stored_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reduction_packs (
    id TEXT PRIMARY KEY,
    level INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    member_kind TEXT NOT NULL,
    member_ids_json TEXT NOT NULL,
    file_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reduction_summaries (
    pack_id TEXT PRIMARY KEY,
    level INTEGER NOT NULL,
    summary_json TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    stored_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    format TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def case_db_path(case_dir: Path) -> Path:
    return case_dir / "case.db"


def open_db(case_dir: Path) -> sqlite3.Connection:
    db_path = case_db_path(case_dir)
    if not db_path.exists():
        raise CaseError(f"Case not found at {case_dir}. Run `init` first.")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def cmd_init(args):
    case_dir = Path(args.case_dir)
    case_dir.mkdir(parents=True, exist_ok=True)
    db_path = case_db_path(case_dir)
    is_new = not db_path.exists()
    conn = sqlite3.connect(str(db_path))
    try:
        conn.executescript(SCHEMA_SQL)
        if is_new:
            case_id = args.case_id or str(uuid.uuid4())
            meta = {
                "case_id": case_id,
                "schema_version": str(SCHEMA_VERSION),
                "tool_version": TOOL_VERSION,
                "created_at": now_iso(),
                "timezone_note": args.timezone or "unspecified-see-per-event-tz_known",
            }
            for k, v in meta.items():
                conn.execute("INSERT OR REPLACE INTO case_meta(key, value) VALUES (?, ?)", (k, v))
            conn.commit()
        else:
            case_id = conn.execute("SELECT value FROM case_meta WHERE key='case_id'").fetchone()[0]
    finally:
        conn.close()
    for sub in ("batches", "reduction", "reports"):
        (case_dir / sub).mkdir(parents=True, exist_ok=True)
    print(json.dumps({"status": "ok", "case_dir": str(case_dir), "case_id": case_id, "new": is_new}, indent=2))
    return 0


# --------------------------------------------------------------------------
# Ingestion
# --------------------------------------------------------------------------

SUPPORTED_EXTS = {".json", ".jsonl", ".ndjson", ".csv", ".log", ".txt"}


def iter_input_files(paths, recursive):
    seen = []
    for p in paths:
        pp = Path(p)
        if pp.is_dir():
            pattern = "**/*" if recursive else "*"
            for f in sorted(pp.glob(pattern)):
                if f.is_file() and f.suffix.lower() in SUPPORTED_EXTS:
                    seen.append(f)
        elif pp.is_file():
            seen.append(pp)
        else:
            raise CaseError(f"Input path does not exist: {p}")
    return seen


def read_records_from_file(path: Path):
    """Return (records, issues) where issues are dicts with line_no/reason/snippet."""
    ext = path.suffix.lower()
    issues = []
    records = []
    if ext in (".jsonl", ".ndjson"):
        with open(path, "r", encoding="utf-8-sig", errors="replace") as f:
            for i, line in enumerate(f, start=1):
                s = line.strip()
                if not s:
                    continue
                try:
                    obj = json.loads(s)
                except json.JSONDecodeError as e:
                    issues.append({"line_no": i, "reason": f"invalid_json_line: {e}", "snippet": s[:300]})
                    continue
                if isinstance(obj, dict):
                    records.append(obj)
                else:
                    records.extend(flatten_json_value(obj))
    elif ext == ".json":
        raw_text = path.read_text(encoding="utf-8-sig", errors="replace")
        try:
            obj = json.loads(raw_text)
        except json.JSONDecodeError as e:
            issues.append({"line_no": None, "reason": f"invalid_json_document: {e}", "snippet": raw_text[:300]})
            return records, issues
        records = flatten_json_value(obj)
    elif ext == ".csv":
        with open(path, "r", encoding="utf-8-sig", errors="replace", newline="") as f:
            try:
                reader = csv.DictReader(f)
                for i, row in enumerate(reader, start=2):
                    if row is None:
                        continue
                    records.append(dict(row))
            except csv.Error as e:
                issues.append({"line_no": None, "reason": f"invalid_csv: {e}", "snippet": ""})
    elif ext in (".log", ".txt"):
        raw_text = path.read_text(encoding="utf-8-sig", errors="replace")
        recs, iss = parse_log_text(raw_text, path.name)
        records = recs
        issues = iss
    else:
        raise CaseError(f"Unsupported file extension: {ext}")
    return records, issues


def cmd_ingest(args):
    case_dir = Path(args.case_dir)
    conn = open_db(case_dir)
    try:
        files = iter_input_files(args.path, args.recursive)
        if not files:
            raise CaseError("No supported input files found (.json/.jsonl/.ndjson/.csv/.log/.txt).")
        total_new = 0
        total_dupe = 0
        total_issues = 0
        results = []
        for f in files:
            data = f.read_bytes()
            file_sha = sha256_bytes(data)
            existing = conn.execute("SELECT id, record_count FROM sources WHERE sha256=?", (file_sha,)).fetchone()
            if existing:
                results.append({"file": str(f), "status": "skipped_duplicate_file", "sha256": file_sha})
                continue
            try:
                records, parse_issues = read_records_from_file(f)
            except CaseError as e:
                parse_issues = [{"line_no": None, "reason": str(e), "snippet": ""}]
                records = []
            cur = conn.execute(
                "INSERT INTO sources(path, kind, sha256, size, added_at, record_count, issue_count) "
                "VALUES (?,?,?,?,?,?,?)",
                (str(f), f.suffix.lower().lstrip("."), file_sha, len(data), now_iso(), len(records), len(parse_issues)),
            )
            source_id = cur.lastrowid
            new_count = 0
            dupe_count = 0
            for seq, raw in enumerate(records, start=1):
                if not isinstance(raw, dict):
                    conn.execute(
                        "INSERT INTO issues(source_id, line_no, reason, snippet, created_at) VALUES (?,?,?,?,?)",
                        (source_id, seq, "record_not_an_object", str(raw)[:300], now_iso()),
                    )
                    continue
                normalized = normalize_record(raw, f.suffix.lower().lstrip("."))
                content_hash = sha256_text(canonical_json(raw))
                fingerprint = compute_fingerprint(normalized)
                existing_event = conn.execute(
                    "SELECT id, duplicate_count FROM events WHERE content_hash=?", (content_hash,)
                ).fetchone()
                if existing_event:
                    conn.execute(
                        "UPDATE events SET duplicate_count = duplicate_count + 1 WHERE id=?",
                        (existing_event["id"],),
                    )
                    dupe_count += 1
                    continue
                conn.execute(
                    """INSERT INTO events(
                        source_id, seq_in_source, content_hash, fingerprint, event_time, tz_known,
                        correlation_id, parent_id, severity, success, duration_ms, telemetry_type,
                        operation_name, plugin_type, message_name, primary_entity, exception_type,
                        raw_json, normalized_json
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        source_id, seq, content_hash, fingerprint, normalized["event_time"],
                        1 if normalized["tz_known"] else 0, normalized["correlation_id"], normalized["parent_id"],
                        normalized["severity"], (None if normalized["success"] is None else int(normalized["success"])),
                        normalized["duration_ms"], normalized["telemetry_type"], normalized["operation_name"],
                        normalized["plugin_type"], normalized["message_name"], normalized["primary_entity"],
                        normalized["exception_type"], canonical_json(raw), canonical_json(normalized),
                    ),
                )
                new_count += 1
            for issue in parse_issues:
                conn.execute(
                    "INSERT INTO issues(source_id, line_no, reason, snippet, created_at) VALUES (?,?,?,?,?)",
                    (source_id, issue.get("line_no"), issue.get("reason", "unknown"), issue.get("snippet", ""), now_iso()),
                )
            conn.commit()
            total_new += new_count
            total_dupe += dupe_count
            total_issues += len(parse_issues)
            results.append({
                "file": str(f), "status": "ingested", "sha256": file_sha,
                "records_parsed": len(records), "events_new": new_count,
                "events_duplicate": dupe_count, "issues": len(parse_issues),
            })
        summary = {
            "files_processed": len(files), "events_new": total_new,
            "events_duplicate": total_dupe, "parse_issues": total_issues, "details": results,
        }
        print(json.dumps(summary, indent=2))
        return 0
    finally:
        conn.close()


# --------------------------------------------------------------------------
# Overview
# --------------------------------------------------------------------------

def cmd_overview(args):
    case_dir = Path(args.case_dir)
    conn = open_db(case_dir)
    try:
        total_events = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
        total_dupe = conn.execute("SELECT COALESCE(SUM(duplicate_count-1),0) FROM events").fetchone()[0]
        by_type = {r["telemetry_type"] or "unknown": r["c"] for r in conn.execute(
            "SELECT telemetry_type, COUNT(*) c FROM events GROUP BY telemetry_type")}
        by_severity = {r["severity"] or "unknown": r["c"] for r in conn.execute(
            "SELECT severity, COUNT(*) c FROM events GROUP BY severity")}
        failed = conn.execute("SELECT COUNT(*) FROM events WHERE success=0").fetchone()[0]
        succeeded = conn.execute("SELECT COUNT(*) FROM events WHERE success=1").fetchone()[0]
        unknown_success = total_events - failed - succeeded
        time_row = conn.execute("SELECT MIN(event_time) a, MAX(event_time) b FROM events WHERE event_time IS NOT NULL").fetchone()
        tz_unknown = conn.execute("SELECT COUNT(*) FROM events WHERE tz_known=0").fetchone()[0]
        no_time = conn.execute("SELECT COUNT(*) FROM events WHERE event_time IS NULL").fetchone()[0]
        durations = [r["duration_ms"] for r in conn.execute(
            "SELECT duration_ms FROM events WHERE duration_ms IS NOT NULL")]
        perf = percentiles(durations)
        distinct_fp = conn.execute("SELECT COUNT(DISTINCT fingerprint) FROM events").fetchone()[0]
        top_fp = [dict(r) for r in conn.execute(
            "SELECT fingerprint, COUNT(*) c, MIN(exception_type) exception_type, "
            "MIN(message_name) message_name, MIN(plugin_type) plugin_type "
            "FROM events GROUP BY fingerprint ORDER BY c DESC LIMIT 10")]
        sources = [dict(r) for r in conn.execute(
            "SELECT path, kind, record_count, issue_count FROM sources ORDER BY id")]
        issues = [dict(r) for r in conn.execute(
            "SELECT source_id, line_no, reason, snippet FROM issues ORDER BY id LIMIT 200")]
        issue_total = conn.execute("SELECT COUNT(*) FROM issues").fetchone()[0]
        correlation_ids = conn.execute("SELECT COUNT(DISTINCT correlation_id) FROM events WHERE correlation_id IS NOT NULL").fetchone()[0]

        overview = {
            "case_id": conn.execute("SELECT value FROM case_meta WHERE key='case_id'").fetchone()[0],
            "generated_at": now_iso(),
            "total_events": total_events,
            "duplicate_events_collapsed": total_dupe,
            "distinct_correlation_ids": correlation_ids,
            "by_telemetry_type": by_type,
            "by_severity": by_severity,
            "outcome": {"failed": failed, "succeeded": succeeded, "unknown": unknown_success},
            "time_range": {"start": time_row["a"], "end": time_row["b"]},
            "timezone_caveat": {
                "events_with_unknown_tz": tz_unknown,
                "events_without_timestamp": no_time,
                "note": "Timestamps without explicit offset/Z are stored as-is (tz_known=false); "
                        "do not assume UTC or local time without confirming source export settings.",
            },
            "performance_ms": perf,
            "distinct_fingerprints": distinct_fp,
            "top_fingerprints": top_fp,
            "sources": sources,
            "ingestion_issue_count": issue_total,
            "ingestion_issues_sample": issues,
        }
        print(json.dumps(overview, indent=2, default=str))
        return 0
    finally:
        conn.close()


def percentiles(values):
    if not values:
        return {"count": 0}
    vals = sorted(values)
    n = len(vals)

    def pct(p):
        if n == 1:
            return vals[0]
        k = (n - 1) * p
        f = int(k)
        c = min(f + 1, n - 1)
        if f == c:
            return vals[f]
        return vals[f] + (vals[c] - vals[f]) * (k - f)

    return {
        "count": n, "min": vals[0], "max": vals[-1],
        "p50": pct(0.50), "p90": pct(0.90), "p95": pct(0.95), "p99": pct(0.99),
        "mean": sum(vals) / n,
    }


# --------------------------------------------------------------------------
# Batch building (correlation-aware, bounded)
# --------------------------------------------------------------------------

def cmd_batch_build(args):
    case_dir = Path(args.case_dir)
    conn = open_db(case_dir)
    try:
        rows = conn.execute(
            "SELECT id, correlation_id, event_time, normalized_json FROM events "
            "WHERE batch_id IS NULL ORDER BY COALESCE(correlation_id, ''), COALESCE(event_time, ''), id"
        ).fetchall()
        if not rows:
            print(json.dumps({"status": "no_pending_events", "batches_created": 0}))
            return 0

        max_events = args.max_events
        max_bytes = args.max_bytes

        # Group consecutive rows sharing a correlation_id so a group is never split
        # across batches unless the group itself exceeds the batch bound (then it is
        # split and flagged so downstream analysis knows the correlation was truncated).
        groups = []
        cur_key = object()
        cur_group = []
        for r in rows:
            key = r["correlation_id"] if r["correlation_id"] else f"__no_corr_{r['id']}"
            if key != cur_key:
                if cur_group:
                    groups.append(cur_group)
                cur_group = [r]
                cur_key = key
            else:
                cur_group.append(r)
        if cur_group:
            groups.append(cur_group)

        existing_max_seq = conn.execute("SELECT COALESCE(MAX(seq),0) FROM batches").fetchone()[0]
        seq = existing_max_seq
        batches_created = []
        batch_rows = []  # list of (rows_list, split_flag)
        cur_batch = []
        cur_bytes = 0

        def flush_batch(rows_list, split_corr):
            nonlocal seq
            if not rows_list:
                return
            seq += 1
            batch_id = f"batch-{seq:05d}"
            lines = []
            corr_ids = set()
            times = []
            for r in rows_list:
                norm = json.loads(r["normalized_json"])
                lines.append(canonical_json({"event_id": r["id"], "normalized": norm}))
                if norm.get("correlation_id"):
                    corr_ids.add(norm["correlation_id"])
                if norm.get("event_time"):
                    times.append(norm["event_time"])
            content = "\n".join(lines) + "\n"
            batch_dir = case_dir / "batches"
            file_path = batch_dir / f"{batch_id}.jsonl"
            atomic_write_text(file_path, content)
            file_sha = sha256_text(content)
            conn.execute(
                "INSERT INTO batches(id, seq, status, event_count, correlation_ids_json, "
                "time_range_start, time_range_end, file_path, sha256, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (batch_id, seq, "pending", len(rows_list), canonical_json(sorted(corr_ids)),
                 min(times) if times else None, max(times) if times else None,
                 str(file_path), file_sha, now_iso()),
            )
            ids = [r["id"] for r in rows_list]
            conn.executemany("UPDATE events SET batch_id=? WHERE id=?", [(batch_id, i) for i in ids])
            batches_created.append({
                "batch_id": batch_id, "event_count": len(rows_list),
                "correlation_split": split_corr, "file_path": str(file_path),
            })

        for group in groups:
            group_bytes = sum(len(canonical_json({"event_id": r["id"]})) for r in group)
            if len(group) > max_events or group_bytes > max_bytes:
                # Oversized single-correlation group: flush current batch, then split
                # this group across dedicated batches (flagged split_corr=True).
                if cur_batch:
                    flush_batch(cur_batch, False)
                    cur_batch, cur_bytes = [], 0
                for i in range(0, len(group), max_events):
                    flush_batch(group[i:i + max_events], True)
                continue
            if cur_batch and (len(cur_batch) + len(group) > max_events or cur_bytes + group_bytes > max_bytes):
                flush_batch(cur_batch, False)
                cur_batch, cur_bytes = [], 0
            cur_batch.extend(group)
            cur_bytes += group_bytes
        if cur_batch:
            flush_batch(cur_batch, False)

        conn.commit()
        write_manifest(conn, case_dir)
        print(json.dumps({"status": "ok", "batches_created": len(batches_created), "batches": batches_created}, indent=2))
        return 0
    finally:
        conn.close()


def write_manifest(conn, case_dir: Path):
    batches = [dict(r) for r in conn.execute("SELECT * FROM batches ORDER BY seq")]
    summarized = {r["batch_id"] for r in conn.execute("SELECT batch_id FROM batch_summaries")}
    for b in batches:
        b["summarized"] = b["id"] in summarized
    manifest = {
        "generated_at": now_iso(),
        "total_batches": len(batches),
        "summarized_batches": len(summarized),
        "all_batches_summarized": len(batches) > 0 and len(summarized) == len(batches),
        "batches": batches,
    }
    atomic_write_text(case_dir / "manifest.json", json.dumps(manifest, indent=2, default=str))


def cmd_batch_list(args):
    case_dir = Path(args.case_dir)
    conn = open_db(case_dir)
    try:
        query = "SELECT b.*, (s.batch_id IS NOT NULL) AS has_summary FROM batches b " \
                "LEFT JOIN batch_summaries s ON s.batch_id = b.id"
        if args.pending_only:
            query += " WHERE s.batch_id IS NULL"
        query += " ORDER BY b.seq"
        rows = [dict(r) for r in conn.execute(query)]
        print(json.dumps({"count": len(rows), "batches": rows}, indent=2, default=str))
        return 0
    finally:
        conn.close()


def cmd_batch_show(args):
    case_dir = Path(args.case_dir)
    conn = open_db(case_dir)
    try:
        row = conn.execute("SELECT * FROM batches WHERE id=?", (args.batch_id,)).fetchone()
        if not row:
            raise CaseError(f"Unknown batch id: {args.batch_id}")
        events = [dict(r) for r in conn.execute(
            "SELECT id, correlation_id, event_time, telemetry_type, severity, exception_type, duration_ms "
            "FROM events WHERE batch_id=? ORDER BY id", (args.batch_id,))]
        summary_row = conn.execute("SELECT summary_json FROM batch_summaries WHERE batch_id=?", (args.batch_id,)).fetchone()
        result = dict(row)
        result["events"] = events
        result["summary"] = json.loads(summary_row["summary_json"]) if summary_row else None
        print(json.dumps(result, indent=2, default=str))
        return 0
    finally:
        conn.close()


BATCH_SUMMARY_TEMPLATE = {
    "batch_id": "<fill in>",
    "event_count_analyzed": 0,
    "observations": [
        {"description": "<factual, evidence-backed statement of what the data shows>",
         "evidence": [{"event_id": 0, "correlation_id": None, "event_time": None, "source_file": None}]}
    ],
    "hypotheses": [
        {"description": "<plausible but unconfirmed explanation>", "confidence": "low|medium|high",
         "supporting_evidence": [{"event_id": 0}]}
    ],
    "confirmed_causes": [
        {"description": "<root cause directly proven by evidence in this batch>",
         "evidence": [{"event_id": 0}]}
    ],
    "findings": [
        {
            "id": "<stable slug>", "title": "<short title>", "severity": "info|low|medium|high|critical",
            "category": "error|performance|configuration|data|security|other",
            "observation": "<what was observed>",
            "hypothesis": "<optional unconfirmed theory, or null>",
            "confirmed_cause": "<optional confirmed cause, or null>",
            "impact": "<who/what is affected and how>",
            "evidence": [{"event_id": 0, "correlation_id": None, "event_time": None, "source_file": None}],
            "fingerprint": None,
        }
    ],
    "performance_notes": {"duration_ms_percentiles": None, "slow_outliers_evidence": []},
    "fingerprints_seen": [],
    "correlation_ids_seen": [],
    "unresolved_questions": [],
}

REDUCTION_SUMMARY_TEMPLATE = {
    "pack_id": "<fill in>",
    "level": 0,
    "members_covered": [],
    "observations": [],
    "hypotheses": [],
    "confirmed_causes": [],
    "findings": [
        {
            "id": "<stable slug, merge duplicates across members by fingerprint>",
            "title": "<short title>", "severity": "info|low|medium|high|critical",
            "category": "error|performance|configuration|data|security|other",
            "observation": "<merged observation across contributing batches/packs>",
            "hypothesis": None, "confirmed_cause": None,
            "impact": "<aggregate impact>",
            "occurrence_count": 0,
            "evidence": [{"event_id": 0, "correlation_id": None, "event_time": None, "source_file": None}],
            "fingerprint": None,
        }
    ],
    "performance_notes": {"duration_ms_percentiles": None, "slow_outliers_evidence": []},
    "fingerprints_seen": [],
    "unresolved_questions": [],
}


def cmd_batch_template(args):
    out = json.dumps(BATCH_SUMMARY_TEMPLATE, indent=2)
    if args.out:
        atomic_write_text(Path(args.out), out)
        print(json.dumps({"status": "ok", "written_to": args.out}))
    else:
        print(out)
    return 0


REQUIRED_BATCH_SUMMARY_KEYS = {"batch_id", "observations", "hypotheses", "confirmed_causes", "findings"}
REQUIRED_FINDING_KEYS = {"id", "title", "severity", "category", "observation", "impact", "evidence"}
VALID_SEVERITIES = {"info", "low", "medium", "high", "critical"}


def validate_summary_shape(summary: dict, required_keys, is_reduction=False):
    missing = required_keys - set(summary.keys())
    if missing:
        raise CaseError(f"Summary missing required keys: {sorted(missing)}")
    if not isinstance(summary["findings"], list):
        raise CaseError("`findings` must be a list.")
    for i, finding in enumerate(summary["findings"]):
        if not isinstance(finding, dict):
            raise CaseError(f"findings[{i}] must be an object.")
        fmissing = REQUIRED_FINDING_KEYS - set(finding.keys())
        if fmissing:
            raise CaseError(f"findings[{i}] missing required keys: {sorted(fmissing)}")
        if finding["severity"] not in VALID_SEVERITIES:
            raise CaseError(f"findings[{i}].severity must be one of {sorted(VALID_SEVERITIES)}, got {finding['severity']!r}")
        if not isinstance(finding["evidence"], list) or len(finding["evidence"]) == 0:
            raise CaseError(f"findings[{i}].evidence must be a non-empty list of evidence locators.")
        if finding.get("confirmed_cause") and not finding.get("evidence"):
            raise CaseError(f"findings[{i}] claims confirmed_cause without evidence.")


def cmd_batch_put_summary(args):
    case_dir = Path(args.case_dir)
    conn = open_db(case_dir)
    try:
        batch = conn.execute("SELECT * FROM batches WHERE id=?", (args.batch_id,)).fetchone()
        if not batch:
            raise CaseError(f"Unknown batch id: {args.batch_id}")
        text = Path(args.file).read_text(encoding="utf-8-sig")
        try:
            summary = json.loads(text)
        except json.JSONDecodeError as e:
            raise CaseError(f"Summary file is not valid JSON: {e}")
        validate_summary_shape(summary, REQUIRED_BATCH_SUMMARY_KEYS)
        if summary.get("batch_id") != args.batch_id:
            raise CaseError(f"Summary batch_id ({summary.get('batch_id')!r}) does not match target batch ({args.batch_id!r}).")
        conn.execute(
            "INSERT OR REPLACE INTO batch_summaries(batch_id, summary_json, sha256, stored_at) VALUES (?,?,?,?)",
            (args.batch_id, canonical_json(summary), sha256_text(canonical_json(summary)), now_iso()),
        )
        conn.execute("UPDATE batches SET status='summarized' WHERE id=?", (args.batch_id,))
        conn.commit()
        write_manifest(conn, case_dir)
        print(json.dumps({"status": "ok", "batch_id": args.batch_id, "findings": len(summary["findings"])}))
        return 0
    finally:
        conn.close()


# --------------------------------------------------------------------------
# Recursive reduction (hierarchical map/reduce)
# --------------------------------------------------------------------------

def cmd_reduce_build(args):
    """Pack pending summaries at `level` into bounded reduction packs.

    level=1 packs batch summaries. level=2 packs level-1 reduction summaries, etc.
    A level is only buildable once every batch (for level 1) or every pack at the
    prior level (for level>1) has a stored summary -- this guarantees no data is
    silently excluded from the hierarchy.
    """
    case_dir = Path(args.case_dir)
    conn = open_db(case_dir)
    try:
        level = args.level
        if level < 1:
            raise CaseError("--level must be >= 1")
        max_members = args.max_members

        if level == 1:
            total_batches = conn.execute("SELECT COUNT(*) FROM batches").fetchone()[0]
            summarized_batches = conn.execute("SELECT COUNT(*) FROM batch_summaries").fetchone()[0]
            if total_batches == 0:
                raise CaseError("No batches exist yet. Run `batch build` first.")
            if summarized_batches < total_batches:
                raise CaseError(
                    f"Cannot build level-1 reduction packs: {total_batches - summarized_batches} of "
                    f"{total_batches} batches are missing a stored summary. Coverage would be incomplete."
                )
            already_packed = set()
            for r in conn.execute("SELECT member_ids_json FROM reduction_packs WHERE level=1"):
                already_packed.update(json.loads(r["member_ids_json"]))
            member_kind = "batch"
            members = [dict(r) for r in conn.execute(
                "SELECT batch_id AS id, summary_json FROM batch_summaries ORDER BY batch_id")]
            members = [m for m in members if m["id"] not in already_packed]
        else:
            prior_total = conn.execute("SELECT COUNT(*) FROM reduction_packs WHERE level=?", (level - 1,)).fetchone()[0]
            prior_summarized = conn.execute("SELECT COUNT(*) FROM reduction_summaries WHERE level=?", (level - 1,)).fetchone()[0]
            if prior_total == 0:
                raise CaseError(f"No level-{level - 1} reduction packs exist yet.")
            if prior_summarized < prior_total:
                raise CaseError(
                    f"Cannot build level-{level} packs: {prior_total - prior_summarized} of {prior_total} "
                    f"level-{level - 1} packs are missing a stored reduction summary."
                )
            if prior_total == 1:
                raise CaseError(
                    f"Level-{level - 1} already reduced to a single root summary; the hierarchy is complete. "
                    "No further reduction is needed."
                )
            already_packed = set()
            for r in conn.execute("SELECT member_ids_json FROM reduction_packs WHERE level=?", (level,)):
                already_packed.update(json.loads(r["member_ids_json"]))
            member_kind = "reduction"
            members = [dict(r) for r in conn.execute(
                "SELECT pack_id AS id, summary_json FROM reduction_summaries WHERE level=? ORDER BY pack_id", (level - 1,))]
            members = [m for m in members if m["id"] not in already_packed]

        if not members:
            print(json.dumps({"status": "no_pending_members", "packs_created": 0}))
            return 0

        existing_max_seq = conn.execute("SELECT COALESCE(MAX(seq),0) FROM reduction_packs WHERE level=?", (level,)).fetchone()[0]
        seq = existing_max_seq
        packs_created = []
        for i in range(0, len(members), max_members):
            chunk = members[i:i + max_members]
            seq += 1
            pack_id = f"reduce-L{level}-{seq:05d}"
            payload = {
                "pack_id": pack_id, "level": level, "member_kind": member_kind,
                "members": [{"id": m["id"], "summary": json.loads(m["summary_json"])} for m in chunk],
            }
            content = canonical_json(payload)
            file_path = case_dir / "reduction" / f"{pack_id}.json"
            atomic_write_text(file_path, json.dumps(payload, indent=2))
            file_sha = sha256_text(content)
            member_ids = [m["id"] for m in chunk]
            conn.execute(
                "INSERT INTO reduction_packs(id, level, seq, status, member_kind, member_ids_json, file_path, sha256, created_at) "
                "VALUES (?,?,?,?,?,?,?,?,?)",
                (pack_id, level, seq, "pending", member_kind, canonical_json(member_ids), str(file_path), file_sha, now_iso()),
            )
            packs_created.append({"pack_id": pack_id, "member_count": len(chunk), "file_path": str(file_path)})
        conn.commit()
        print(json.dumps({"status": "ok", "level": level, "packs_created": len(packs_created), "packs": packs_created}, indent=2))
        return 0
    finally:
        conn.close()


def cmd_reduce_list(args):
    case_dir = Path(args.case_dir)
    conn = open_db(case_dir)
    try:
        query = "SELECT p.*, (s.pack_id IS NOT NULL) AS has_summary FROM reduction_packs p " \
                "LEFT JOIN reduction_summaries s ON s.pack_id = p.id"
        clauses, params = [], []
        if args.level is not None:
            clauses.append("p.level=?")
            params.append(args.level)
        if args.pending_only:
            clauses.append("s.pack_id IS NULL")
        if clauses:
            query += " WHERE " + " AND ".join(clauses)
        query += " ORDER BY p.level, p.seq"
        rows = [dict(r) for r in conn.execute(query, params)]
        print(json.dumps({"count": len(rows), "packs": rows}, indent=2, default=str))
        return 0
    finally:
        conn.close()


def cmd_reduce_template(args):
    tmpl = dict(REDUCTION_SUMMARY_TEMPLATE)
    tmpl["level"] = args.level or 0
    out = json.dumps(tmpl, indent=2)
    if args.out:
        atomic_write_text(Path(args.out), out)
        print(json.dumps({"status": "ok", "written_to": args.out}))
    else:
        print(out)
    return 0


def cmd_reduce_put_summary(args):
    case_dir = Path(args.case_dir)
    conn = open_db(case_dir)
    try:
        pack = conn.execute("SELECT * FROM reduction_packs WHERE id=?", (args.pack_id,)).fetchone()
        if not pack:
            raise CaseError(f"Unknown reduction pack id: {args.pack_id}")
        text = Path(args.file).read_text(encoding="utf-8-sig")
        try:
            summary = json.loads(text)
        except json.JSONDecodeError as e:
            raise CaseError(f"Summary file is not valid JSON: {e}")
        validate_summary_shape(summary, REQUIRED_BATCH_SUMMARY_KEYS - {"batch_id"} | {"pack_id"}, is_reduction=True)
        if summary.get("pack_id") != args.pack_id:
            raise CaseError(f"Summary pack_id ({summary.get('pack_id')!r}) does not match target pack ({args.pack_id!r}).")
        conn.execute(
            "INSERT OR REPLACE INTO reduction_summaries(pack_id, level, summary_json, sha256, stored_at) VALUES (?,?,?,?,?)",
            (args.pack_id, pack["level"], canonical_json(summary), sha256_text(canonical_json(summary)), now_iso()),
        )
        conn.execute("UPDATE reduction_packs SET status='summarized' WHERE id=?", (args.pack_id,))
        conn.commit()
        print(json.dumps({"status": "ok", "pack_id": args.pack_id, "level": pack["level"], "findings": len(summary["findings"])}))
        return 0
    finally:
        conn.close()


# --------------------------------------------------------------------------
# Coverage
# --------------------------------------------------------------------------

def compute_coverage(conn) -> dict:
    total_events = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    batched_events = conn.execute("SELECT COUNT(*) FROM events WHERE batch_id IS NOT NULL").fetchone()[0]
    total_batches = conn.execute("SELECT COUNT(*) FROM batches").fetchone()[0]
    summarized_batches = conn.execute("SELECT COUNT(*) FROM batch_summaries").fetchone()[0]

    levels = [r["level"] for r in conn.execute("SELECT DISTINCT level FROM reduction_packs ORDER BY level")]
    level_status = []
    root_level = None
    root_pack_id = None
    for level in levels:
        total = conn.execute("SELECT COUNT(*) FROM reduction_packs WHERE level=?", (level,)).fetchone()[0]
        summarized = conn.execute("SELECT COUNT(*) FROM reduction_summaries WHERE level=?", (level,)).fetchone()[0]
        is_root = (total == 1 and summarized == 1)
        level_status.append({"level": level, "total_packs": total, "summarized_packs": summarized, "is_root_candidate": is_root})
        if is_root:
            root_level = level
            root_pack_id = conn.execute("SELECT id FROM reduction_packs WHERE level=?", (level,)).fetchone()[0]

    fully_batched = total_events > 0 and batched_events == total_events
    fully_summarized_batches = total_batches > 0 and summarized_batches == total_batches
    fully_reduced = root_level is not None

    complete = fully_batched and fully_summarized_batches and fully_reduced
    return {
        "total_events": total_events,
        "batched_events": batched_events,
        "unbatched_events": total_events - batched_events,
        "total_batches": total_batches,
        "summarized_batches": summarized_batches,
        "unsummarized_batches": total_batches - summarized_batches,
        "reduction_levels": level_status,
        "root_reduction_pack_id": root_pack_id,
        "root_reduction_level": root_level,
        "full_coverage_achieved": complete,
        "explanation": (
            "full_coverage_achieved is true only when every ingested event belongs to a "
            "batch, every batch has a stored, validated summary, and the reduction "
            "hierarchy has been collapsed to a single root summary. Only under this "
            "condition may the agent claim whole-dataset coverage in a final report."
        ),
    }


def cmd_coverage(args):
    case_dir = Path(args.case_dir)
    conn = open_db(case_dir)
    try:
        cov = compute_coverage(conn)
        print(json.dumps(cov, indent=2))
        return 0
    finally:
        conn.close()


# --------------------------------------------------------------------------
# Final report: template, validation, export (JSON/Markdown/HTML/CSV)
# --------------------------------------------------------------------------

FINAL_REPORT_TEMPLATE = {
    "case_id": "<fill in>",
    "generated_at": "<ISO8601 timestamp>",
    "title": "<report title>",
    "coverage": {
        "full_coverage_achieved": False,
        "total_events": 0,
        "note": "Copy the object returned by `coverage` here verbatim; do not hand-edit these numbers.",
    },
    "scope_and_caveats": [
        "<e.g. timezone of source timestamps unconfirmed>",
        "<e.g. sampling window limited to files provided>",
    ],
    "executive_summary": "<2-5 sentences, non-technical, for stakeholders>",
    "performance_summary": {
        "duration_ms_percentiles": None,
        "baseline_comparison": "<describe baseline used, e.g. prior week p95, or 'none available'>",
        "methodology_note": "Percentile/baseline-based; avoid arbitrary fixed thresholds unless no baseline exists.",
    },
    "findings": [
        {
            "id": "<stable slug>",
            "title": "<short title>",
            "severity": "info|low|medium|high|critical",
            "category": "error|performance|configuration|data|security|other",
            "observation": "<factual, evidence-backed statement>",
            "hypothesis": "<unconfirmed theory or null>",
            "confirmed_cause": "<proven root cause or null>",
            "impact": "<business/technical impact>",
            "occurrence_count": 0,
            "evidence": [
                {"event_id": 0, "source_file": None, "correlation_id": None, "event_time": None}
            ],
            "recommendations": [
                {
                    "priority": "P1|P2|P3|P4",
                    "owner_role": "<e.g. Dataverse Administrator, Plugin Developer, Platform Engineer>",
                    "action": "<concrete step>",
                    "expected_effect": "<what should improve and how to notice>",
                    "validation": "<how to confirm the fix worked>",
                    "risk": "<risk of applying this action>",
                    "rollback": "<how to revert if it goes wrong>",
                }
            ],
        }
    ],
    "appendix": {"batch_count": 0, "reduction_root_pack_id": None},
}


def cmd_report_template(args):
    out = json.dumps(FINAL_REPORT_TEMPLATE, indent=2)
    if args.out:
        atomic_write_text(Path(args.out), out)
        print(json.dumps({"status": "ok", "written_to": args.out}))
    else:
        print(out)
    return 0


REQUIRED_REPORT_KEYS = {"case_id", "generated_at", "coverage", "executive_summary", "findings"}
REQUIRED_RECOMMENDATION_KEYS = {"priority", "owner_role", "action", "expected_effect", "validation", "risk", "rollback"}
VALID_PRIORITIES = {"P1", "P2", "P3", "P4"}


def validate_final_report(report: dict):
    missing = REQUIRED_REPORT_KEYS - set(report.keys())
    if missing:
        raise CaseError(f"Final report missing required keys: {sorted(missing)}")
    if not isinstance(report["findings"], list):
        raise CaseError("`findings` must be a list.")
    for i, finding in enumerate(report["findings"]):
        fmissing = REQUIRED_FINDING_KEYS - set(finding.keys())
        if fmissing:
            raise CaseError(f"findings[{i}] missing required keys: {sorted(fmissing)}")
        if finding["severity"] not in VALID_SEVERITIES:
            raise CaseError(f"findings[{i}].severity invalid: {finding['severity']!r}")
        if not finding.get("evidence"):
            raise CaseError(f"findings[{i}] must include at least one evidence locator.")
        recs = finding.get("recommendations", [])
        if not isinstance(recs, list) or len(recs) == 0:
            raise CaseError(f"findings[{i}] must include at least one recommendation.")
        for j, rec in enumerate(recs):
            rmissing = REQUIRED_RECOMMENDATION_KEYS - set(rec.keys())
            if rmissing:
                raise CaseError(f"findings[{i}].recommendations[{j}] missing keys: {sorted(rmissing)}")
            if rec["priority"] not in VALID_PRIORITIES:
                raise CaseError(f"findings[{i}].recommendations[{j}].priority must be one of {sorted(VALID_PRIORITIES)}")
    if not isinstance(report.get("coverage"), dict) or "full_coverage_achieved" not in report["coverage"]:
        raise CaseError("`coverage` must be an object copied from the `coverage` command, including full_coverage_achieved.")


def sanitize_csv_cell(value) -> str:
    """Prevent spreadsheet formula injection (CSV/Excel/Sheets) by neutralizing
    leading =, +, -, @, tab and CR characters that trigger formula evaluation."""
    s = "" if value is None else str(value)
    s = s.replace("\r", " ").replace("\t", " ")
    if s and s[0] in ("=", "+", "-", "@"):
        s = "'" + s
    return s


def export_json(report: dict, out_dir: Path) -> Path:
    path = out_dir / "final-report.json"
    atomic_write_text(path, json.dumps(report, indent=2, ensure_ascii=False, default=str))
    return path


def export_markdown(report: dict, out_dir: Path) -> Path:
    lines = [f"# {report.get('title', 'Power Platform Log Analysis Report')}", ""]
    lines.append(f"*Case ID:* `{report['case_id']}`  ")
    lines.append(f"*Generated:* {report['generated_at']}  ")
    cov = report.get("coverage", {})
    lines.append(f"*Full dataset coverage claimed:* **{cov.get('full_coverage_achieved')}**")
    lines.append("")
    if report.get("scope_and_caveats"):
        lines.append("## Scope and Caveats")
        for c in report["scope_and_caveats"]:
            lines.append(f"- {c}")
        lines.append("")
    lines.append("## Executive Summary")
    lines.append(report.get("executive_summary", ""))
    lines.append("")
    perf = report.get("performance_summary")
    if perf:
        lines.append("## Performance Summary")
        lines.append(f"- Baseline comparison: {perf.get('baseline_comparison')}")
        lines.append(f"- Methodology: {perf.get('methodology_note')}")
        if perf.get("duration_ms_percentiles"):
            lines.append(f"- Percentiles (ms): {perf['duration_ms_percentiles']}")
        lines.append("")
    lines.append("## Findings")
    for f in report.get("findings", []):
        lines.append(f"### [{f['severity'].upper()}] {f['title']} (`{f['id']}`)")
        lines.append(f"- **Category:** {f['category']}")
        lines.append(f"- **Observation:** {f['observation']}")
        if f.get("hypothesis"):
            lines.append(f"- **Hypothesis (unconfirmed):** {f['hypothesis']}")
        if f.get("confirmed_cause"):
            lines.append(f"- **Confirmed cause:** {f['confirmed_cause']}")
        lines.append(f"- **Impact:** {f['impact']}")
        if f.get("occurrence_count"):
            lines.append(f"- **Occurrences:** {f['occurrence_count']}")
        lines.append("- **Evidence:**")
        for ev in f.get("evidence", []):
            lines.append(f"  - event_id={ev.get('event_id')} file={ev.get('source_file')} "
                          f"correlation_id={ev.get('correlation_id')} time={ev.get('event_time')}")
        lines.append("- **Recommendations:**")
        for rec in f.get("recommendations", []):
            lines.append(f"  - **[{rec['priority']}]** ({rec['owner_role']}) {rec['action']}")
            lines.append(f"    - Expected effect: {rec['expected_effect']}")
            lines.append(f"    - Validation: {rec['validation']}")
            lines.append(f"    - Risk: {rec['risk']}")
            lines.append(f"    - Rollback: {rec['rollback']}")
        lines.append("")
    content = "\n".join(lines) + "\n"
    path = out_dir / "final-report.md"
    atomic_write_text(path, content)
    return path


HTML_TEMPLATE_HEAD = """<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
body {{ font-family: Segoe UI, Arial, sans-serif; margin: 2rem; color: #1b1b1b; background:#fff; }}
h1 {{ border-bottom: 2px solid #444; padding-bottom: .3rem; }}
.finding {{ border: 1px solid #ccc; border-radius: 6px; padding: 1rem; margin-bottom: 1rem; }}
.sev-critical {{ border-left: 6px solid #b00020; }}
.sev-high {{ border-left: 6px solid #e65100; }}
.sev-medium {{ border-left: 6px solid #f9a825; }}
.sev-low {{ border-left: 6px solid #2e7d32; }}
.sev-info {{ border-left: 6px solid #1565c0; }}
table {{ border-collapse: collapse; width: 100%; margin: .5rem 0; }}
th, td {{ border: 1px solid #ddd; padding: .35rem .5rem; text-align: left; font-size: .9rem; }}
code {{ background: #f2f2f2; padding: 0 .25rem; }}
.badge {{ display:inline-block; padding:.1rem .5rem; border-radius:4px; background:#eee; font-size:.8rem; }}
</style>
</head>
<body>
"""


def html_escape(s):
    import html as _html
    return _html.escape("" if s is None else str(s), quote=True)


def export_html(report: dict, out_dir: Path) -> Path:
    title = html_escape(report.get("title", "Power Platform Log Analysis Report"))
    parts = [HTML_TEMPLATE_HEAD.format(title=title)]
    parts.append(f"<h1>{title}</h1>")
    parts.append(f"<p><b>Case ID:</b> <code>{html_escape(report['case_id'])}</code><br>"
                 f"<b>Generated:</b> {html_escape(report['generated_at'])}<br>"
                 f"<b>Full dataset coverage claimed:</b> {html_escape(report.get('coverage', {}).get('full_coverage_achieved'))}</p>")
    if report.get("scope_and_caveats"):
        parts.append("<h2>Scope and Caveats</h2><ul>")
        for c in report["scope_and_caveats"]:
            parts.append(f"<li>{html_escape(c)}</li>")
        parts.append("</ul>")
    parts.append("<h2>Executive Summary</h2>")
    parts.append(f"<p>{html_escape(report.get('executive_summary', ''))}</p>")
    perf = report.get("performance_summary")
    if perf:
        parts.append("<h2>Performance Summary</h2><ul>")
        parts.append(f"<li>Baseline comparison: {html_escape(perf.get('baseline_comparison'))}</li>")
        parts.append(f"<li>Methodology: {html_escape(perf.get('methodology_note'))}</li>")
        if perf.get("duration_ms_percentiles"):
            parts.append(f"<li>Percentiles (ms): {html_escape(perf['duration_ms_percentiles'])}</li>")
        parts.append("</ul>")
    parts.append("<h2>Findings</h2>")
    for f in report.get("findings", []):
        sev = str(f.get("severity", "info")).lower()
        parts.append(f'<div class="finding sev-{html_escape(sev)}">')
        parts.append(f"<h3><span class=\"badge\">{html_escape(sev.upper())}</span> "
                     f"{html_escape(f.get('title'))} <code>{html_escape(f.get('id'))}</code></h3>")
        parts.append(f"<p><b>Category:</b> {html_escape(f.get('category'))}</p>")
        parts.append(f"<p><b>Observation:</b> {html_escape(f.get('observation'))}</p>")
        if f.get("hypothesis"):
            parts.append(f"<p><b>Hypothesis (unconfirmed):</b> {html_escape(f.get('hypothesis'))}</p>")
        if f.get("confirmed_cause"):
            parts.append(f"<p><b>Confirmed cause:</b> {html_escape(f.get('confirmed_cause'))}</p>")
        parts.append(f"<p><b>Impact:</b> {html_escape(f.get('impact'))}</p>")
        if f.get("occurrence_count"):
            parts.append(f"<p><b>Occurrences:</b> {html_escape(f.get('occurrence_count'))}</p>")
        parts.append("<p><b>Evidence:</b></p><table><tr><th>event_id</th><th>source_file</th>"
                     "<th>correlation_id</th><th>event_time</th></tr>")
        for ev in f.get("evidence", []):
            parts.append(f"<tr><td>{html_escape(ev.get('event_id'))}</td><td>{html_escape(ev.get('source_file'))}</td>"
                         f"<td>{html_escape(ev.get('correlation_id'))}</td><td>{html_escape(ev.get('event_time'))}</td></tr>")
        parts.append("</table>")
        parts.append("<p><b>Recommendations:</b></p><table><tr><th>Priority</th><th>Owner</th><th>Action</th>"
                     "<th>Expected effect</th><th>Validation</th><th>Risk</th><th>Rollback</th></tr>")
        for rec in f.get("recommendations", []):
            parts.append("<tr>" + "".join(
                f"<td>{html_escape(rec.get(k))}</td>" for k in
                ("priority", "owner_role", "action", "expected_effect", "validation", "risk", "rollback")
            ) + "</tr>")
        parts.append("</table></div>")
    parts.append("</body></html>")
    content = "\n".join(parts)
    path = out_dir / "final-report.html"
    atomic_write_text(path, content)
    return path


def export_csv(report: dict, out_dir: Path) -> Path:
    path = out_dir / "findings.csv"
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    header = [
        "id", "title", "severity", "category", "observation", "hypothesis", "confirmed_cause",
        "impact", "occurrence_count", "evidence_count", "first_evidence_event_id",
        "first_evidence_correlation_id", "recommendation_count", "top_priority",
    ]
    writer.writerow([sanitize_csv_cell(h) for h in header])
    for f in report.get("findings", []):
        evidence = f.get("evidence", [])
        recs = f.get("recommendations", [])
        priorities = [r.get("priority", "") for r in recs]
        top_priority = min(priorities) if priorities else ""
        row = [
            f.get("id"), f.get("title"), f.get("severity"), f.get("category"), f.get("observation"),
            f.get("hypothesis"), f.get("confirmed_cause"), f.get("impact"), f.get("occurrence_count"),
            len(evidence), evidence[0].get("event_id") if evidence else "",
            evidence[0].get("correlation_id") if evidence else "", len(recs), top_priority,
        ]
        writer.writerow([sanitize_csv_cell(c) for c in row])
    atomic_write_text(path, buf.getvalue())
    return path


def cmd_report_export(args):
    case_dir = Path(args.case_dir)
    conn = open_db(case_dir)
    try:
        text = Path(args.file).read_text(encoding="utf-8-sig")
        try:
            report = json.loads(text)
        except json.JSONDecodeError as e:
            raise CaseError(f"Report file is not valid JSON: {e}")
        validate_final_report(report)

        cov = compute_coverage(conn)
        claimed = bool(report.get("coverage", {}).get("full_coverage_achieved"))
        if claimed and not cov["full_coverage_achieved"]:
            if not args.allow_partial:
                raise CaseError(
                    "Report claims full_coverage_achieved=true but the case does not yet have full "
                    "coverage (see `coverage` command). Re-run coverage checks, or pass --allow-partial "
                    "to export anyway (not recommended)."
                )
        out_dir = Path(args.out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        formats = [f.strip().lower() for f in args.formats.split(",") if f.strip()]
        written = []
        exporters = {"json": export_json, "md": export_markdown, "markdown": export_markdown,
                     "html": export_html, "csv": export_csv}
        for fmt in formats:
            if fmt not in exporters:
                raise CaseError(f"Unknown export format: {fmt} (supported: json, md, html, csv)")
            path = exporters[fmt](report, out_dir)
            conn.execute("INSERT INTO reports(format, file_path, created_at) VALUES (?,?,?)", (fmt, str(path), now_iso()))
            written.append({"format": fmt, "path": str(path)})
        conn.commit()
        print(json.dumps({"status": "ok", "coverage_check": cov["full_coverage_achieved"], "written": written}, indent=2))
        return 0
    finally:
        conn.close()


# --------------------------------------------------------------------------
# CLI wiring
# --------------------------------------------------------------------------

def build_parser():
    p = argparse.ArgumentParser(
        prog="log_case.py",
        description="Persistent case storage and map/reduce pipeline for Power Platform / "
                     "Dataverse / Application Insights log analysis (stdlib only, local-only).",
    )
    sub = p.add_subparsers(dest="command", required=True)

    sp = sub.add_parser("init", help="Create a new case in a case directory.")
    sp.add_argument("--case-dir", required=True, help="Directory to hold the case (created if missing).")
    sp.add_argument("--case-id", help="Optional explicit case ID (default: random UUID).")
    sp.add_argument("--timezone", help="Free-text note about the known/assumed source timezone.")
    sp.set_defaults(func=cmd_init)

    sp = sub.add_parser("ingest", help="Ingest files/directories into the case.")
    sp.add_argument("--case-dir", required=True)
    sp.add_argument("--path", nargs="+", required=True, help="One or more files or directories to ingest.")
    sp.add_argument("--recursive", action="store_true", help="Recurse into subdirectories.")
    sp.set_defaults(func=cmd_ingest)

    sp = sub.add_parser("overview", help="Print deterministic overview statistics for the case.")
    sp.add_argument("--case-dir", required=True)
    sp.set_defaults(func=cmd_overview)

    batch = sub.add_parser("batch", help="Batch management commands.")
    batch_sub = batch.add_subparsers(dest="batch_command", required=True)

    sp = batch_sub.add_parser("build", help="Build correlation-aware bounded batches for pending events.")
    sp.add_argument("--case-dir", required=True)
    sp.add_argument("--max-events", type=int, default=200, help="Max events per batch (default 200).")
    sp.add_argument("--max-bytes", type=int, default=250_000, help="Approx max bytes per batch (default 250000).")
    sp.set_defaults(func=cmd_batch_build)

    sp = batch_sub.add_parser("list", help="List batches.")
    sp.add_argument("--case-dir", required=True)
    sp.add_argument("--pending-only", action="store_true")
    sp.set_defaults(func=cmd_batch_list)

    sp = batch_sub.add_parser("show", help="Show one batch's metadata, events, and stored summary.")
    sp.add_argument("--case-dir", required=True)
    sp.add_argument("--batch-id", required=True)
    sp.set_defaults(func=cmd_batch_show)

    sp = batch_sub.add_parser("template", help="Emit the batch-summary JSON template.")
    sp.add_argument("--case-dir", required=True)
    sp.add_argument("--out", help="Write template to this file instead of stdout.")
    sp.set_defaults(func=cmd_batch_template)

    sp = batch_sub.add_parser("put-summary", help="Validate and store a structured batch summary.")
    sp.add_argument("--case-dir", required=True)
    sp.add_argument("--batch-id", required=True)
    sp.add_argument("--file", required=True, help="Path to the JSON summary file.")
    sp.set_defaults(func=cmd_batch_put_summary)

    reduce = sub.add_parser("reduce", help="Hierarchical reduction commands.")
    reduce_sub = reduce.add_subparsers(dest="reduce_command", required=True)

    sp = reduce_sub.add_parser("build", help="Build bounded reduction packs from pending summaries at a level.")
    sp.add_argument("--case-dir", required=True)
    sp.add_argument("--level", type=int, required=True, help="1 packs batch summaries; >1 packs prior-level reductions.")
    sp.add_argument("--max-members", type=int, default=20, help="Max members per pack (default 20).")
    sp.set_defaults(func=cmd_reduce_build)

    sp = reduce_sub.add_parser("list", help="List reduction packs.")
    sp.add_argument("--case-dir", required=True)
    sp.add_argument("--level", type=int)
    sp.add_argument("--pending-only", action="store_true")
    sp.set_defaults(func=cmd_reduce_list)

    sp = reduce_sub.add_parser("template", help="Emit the reduction-summary JSON template.")
    sp.add_argument("--case-dir", required=True)
    sp.add_argument("--level", type=int)
    sp.add_argument("--out")
    sp.set_defaults(func=cmd_reduce_template)

    sp = reduce_sub.add_parser("put-summary", help="Validate and store a reduction summary.")
    sp.add_argument("--case-dir", required=True)
    sp.add_argument("--pack-id", required=True)
    sp.add_argument("--file", required=True)
    sp.set_defaults(func=cmd_reduce_put_summary)

    sp = sub.add_parser("coverage", help="Report factual batch/reduction coverage of the case.")
    sp.add_argument("--case-dir", required=True)
    sp.set_defaults(func=cmd_coverage)

    report = sub.add_parser("report", help="Final report template and export.")
    report_sub = report.add_subparsers(dest="report_command", required=True)

    sp = report_sub.add_parser("template", help="Emit the final-report JSON template.")
    sp.add_argument("--case-dir", required=True)
    sp.add_argument("--out")
    sp.set_defaults(func=cmd_report_template)

    sp = report_sub.add_parser("export", help="Validate and export a final report to JSON/Markdown/HTML/CSV.")
    sp.add_argument("--case-dir", required=True)
    sp.add_argument("--file", required=True, help="Path to the final-report JSON file.")
    sp.add_argument("--out-dir", required=True, help="Directory to write exported report files into.")
    sp.add_argument("--formats", default="json,md,html,csv", help="Comma-separated list: json,md,html,csv.")
    sp.add_argument("--allow-partial", action="store_true",
                    help="Allow export even if full_coverage_achieved is claimed but not actually met.")
    sp.set_defaults(func=cmd_report_export)

    return p


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except CaseError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    except FileNotFoundError as e:
        print(f"error: file not found: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())

