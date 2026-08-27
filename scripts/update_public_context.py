#!/usr/bin/env python3
"""Analysis Ultimate — Clermont Public Context Sentinel.

Public-only updater executed by GitHub Actions.
No TGM/customer data is read, transmitted or required.

Priority chain:
1. Clermont Auvergne Métropole Explore API v2.1
2. Official Clermont Métropole works pages as a fallback/complement
3. Open-Meteo for weather context
4. Last-known-good local payload if a source is temporarily unavailable

The writer is transactional: a new payload is validated before replacing the
last known good JSON file.
"""
from __future__ import annotations

import csv
import datetime as dt
import io
import json
import math
import re
import time
import unicodedata
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "public-context.json"
HISTORY_OUT = ROOT / "data" / "public-context-history.json"
TMP = OUT.with_suffix(".json.tmp")

VERSION = "3.1.0 API SENTINEL"
API_BASE = "https://opendata.clermontmetropole.eu/api/explore/v2.1"
API_CONSOLE = "https://opendata.clermontmetropole.eu/api/explore/v2.1/console"
USER_AGENT = "AnalysisUltimate-PublicContext/3.1 (+GitHub Actions; public-data-only)"

KNOWN_DATASETS = {
    "parking": "occupation_parcs_stationnement_metropolitains",
    "addresses": "base-adresse-locale-clermont-auvergne-metropole",
    "roads": "axes-de-voie-de-la-metropole",
}
ROLE_MATCH_TOKENS = {
    "parking": ["occupation", "stationnement", "parcs"],
    "addresses": ["base", "adresse", "locale"],
    "roads": ["axes", "voie", "metropole"],
}

WORK_PAGES = {
    "Clermont-Centre": "https://www.clermontmetropole.eu/fr/les-travaux-en-cours/les-travaux-en-cours/travaux-secteur-centre/",
    "Nord & Est": "https://www.clermontmetropole.eu/les-travaux-en-cours/les-travaux-en-cours/travaux-secteurs-nord-est/",
    "Ouest": "https://www.clermontmetropole.eu/les-travaux-en-cours/les-travaux-en-cours/travaux-secteur-ouest/",
    "Sud": "https://www.clermontmetropole.eu/fr/les-travaux-en-cours/les-travaux-en-cours/travaux-secteur-sud/",
}

RELEVANCE_TERMS = {
    "travaux": 9,
    "chantier": 9,
    "circulation": 8,
    "voirie": 7,
    "route": 5,
    "stationnement": 6,
    "parking": 6,
    "mobilite": 5,
    "mobilité": 5,
    "inspire": 7,
    "deviation": 7,
    "déviation": 7,
    "fermeture": 7,
    "rue": 2,
    "voie": 2,
}
EXCLUDE_TERMS = {
    "marches publics": 12,
    "marchés publics": 12,
    "budget": 12,
    "achat public": 12,
    "subvention": 8,
}


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def iso_now() -> str:
    return utcnow().isoformat()


def norm(value: Any) -> str:
    s = "" if value is None else str(value)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("’", "'")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def compact_text(value: Any, limit: int = 700) -> str:
    s = re.sub(r"\s+", " ", "" if value is None else str(value)).strip()
    return s if len(s) <= limit else s[: limit - 1] + "…"


def safe_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    s = str(value).strip().replace("\u202f", "").replace(" ", "").replace(",", ".")
    s = re.sub(r"[^0-9.\-]", "", s)
    try:
        x = float(s)
        return x if math.isfinite(x) else None
    except Exception:
        return None


def read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text("utf-8"))
    except Exception:
        return default


class HttpClient:
    def __init__(self, retries: int = 3, timeout: int = 30):
        self.retries = retries
        self.timeout = timeout

    def get_bytes(self, url: str, *, accept: str = "application/json,text/plain,*/*") -> bytes:
        last: Exception | None = None
        for attempt in range(self.retries):
            try:
                req = Request(
                    url,
                    headers={
                        "User-Agent": USER_AGENT,
                        "Accept": accept,
                        "Cache-Control": "no-cache",
                    },
                )
                with urlopen(req, timeout=self.timeout) as r:
                    if getattr(r, "status", 200) >= 400:
                        raise RuntimeError(f"HTTP {r.status}")
                    return r.read()
            except (HTTPError, URLError, TimeoutError, OSError, RuntimeError) as exc:
                last = exc
                if attempt + 1 < self.retries:
                    time.sleep(1.5 * (2**attempt))
        raise RuntimeError(f"GET failed after {self.retries} attempts: {url} — {last}")

    def get_json(self, url: str) -> dict[str, Any]:
        raw = self.get_bytes(url, accept="application/json")
        try:
            obj = json.loads(raw.decode("utf-8"))
        except Exception as exc:
            raise RuntimeError(f"Invalid JSON from {url}: {exc}") from exc
        if not isinstance(obj, dict):
            raise RuntimeError(f"Unexpected JSON shape from {url}")
        return obj

    def get_text(self, url: str) -> str:
        raw = self.get_bytes(url, accept="text/html,text/plain,*/*")
        return raw.decode("utf-8", "replace")


HTTP = HttpClient()


def api_url(path: str, **params: Any) -> str:
    q = {k: v for k, v in params.items() if v is not None}
    return f"{API_BASE}{path}" + ("?" + urlencode(q, doseq=True) if q else "")


def api_health() -> dict[str, Any]:
    started = time.perf_counter()
    try:
        obj = HTTP.get_json(api_url("/catalog/datasets", limit=1, offset=0))
        elapsed = round((time.perf_counter() - started) * 1000)
        return {
            "ok": isinstance(obj.get("results"), list),
            "latency_ms": elapsed,
            "total_datasets": obj.get("total_count"),
            "endpoint": API_BASE,
            "checked_at": iso_now(),
            "error": None,
        }
    except Exception as exc:
        return {
            "ok": False,
            "latency_ms": None,
            "total_datasets": None,
            "endpoint": API_BASE,
            "checked_at": iso_now(),
            "error": compact_text(exc),
        }


def catalog_all(max_pages: int = 10) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    offset = 0
    limit = 100
    for _ in range(max_pages):
        obj = HTTP.get_json(api_url("/catalog/datasets", limit=limit, offset=offset))
        batch = obj.get("results") or []
        if not isinstance(batch, list):
            raise RuntimeError("catalog.results is not a list")
        results.extend(x for x in batch if isinstance(x, dict))
        total = int(obj.get("total_count") or len(results))
        if len(results) >= total or not batch:
            break
        offset += len(batch)
    return results


def dataset_id(ds: dict[str, Any]) -> str:
    return str(ds.get("dataset_id") or ds.get("datasetid") or ds.get("id") or "").strip()


def dataset_meta_default(ds: dict[str, Any]) -> dict[str, Any]:
    metas = ds.get("metas") or {}
    if isinstance(metas, dict):
        default = metas.get("default") or metas.get("dcat") or {}
        return default if isinstance(default, dict) else {}
    return {}


def dataset_title(ds: dict[str, Any]) -> str:
    meta = dataset_meta_default(ds)
    return compact_text(meta.get("title") or ds.get("title") or dataset_id(ds), 240)


def dataset_description(ds: dict[str, Any]) -> str:
    meta = dataset_meta_default(ds)
    return compact_text(meta.get("description") or ds.get("description") or "", 900)


def dataset_processed(ds: dict[str, Any]) -> str | None:
    meta = dataset_meta_default(ds)
    return meta.get("data_processed") or meta.get("modified") or ds.get("data_processed") or None


def relevance(ds: dict[str, Any]) -> int:
    text = norm(" ".join([dataset_title(ds), dataset_description(ds), dataset_id(ds)]))
    score = 0
    for term, weight in RELEVANCE_TERMS.items():
        if norm(term) in text:
            score += weight
    for term, weight in EXCLUDE_TERMS.items():
        if norm(term) in text:
            score -= weight
    return score


def resolve_known_datasets(catalog: list[dict[str, Any]]) -> dict[str, str]:
    ids={dataset_id(ds):ds for ds in catalog if dataset_id(ds)}
    resolved={}
    for role, preferred in KNOWN_DATASETS.items():
        if preferred in ids:
            resolved[role]=preferred
            continue
        tokens=ROLE_MATCH_TOKENS[role]
        candidates=[]
        for ds in catalog:
            text=norm(" ".join([dataset_title(ds), dataset_description(ds), dataset_id(ds)]))
            score=sum(1 for t in tokens if norm(t) in text)
            if score:
                candidates.append((score,dataset_id(ds)))
        candidates.sort(reverse=True)
        resolved[role]=candidates[0][1] if candidates and candidates[0][0]>=max(2,len(tokens)-1) else preferred
    return resolved


def discover_relevant(catalog: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for ds in catalog:
        did = dataset_id(ds)
        if not did:
            continue
        score = relevance(ds)
        if did in KNOWN_DATASETS.values():
            score += 100
        if score >= 7:
            out.append(
                {
                    "dataset_id": did,
                    "title": dataset_title(ds),
                    "description": dataset_description(ds),
                    "score": score,
                    "data_processed": dataset_processed(ds),
                    "has_records": bool(ds.get("has_records", True)),
                }
            )
    return sorted(out, key=lambda x: (-x["score"], x["title"]))[:30]


def get_dataset_meta(did: str) -> dict[str, Any]:
    return HTTP.get_json(api_url(f"/catalog/datasets/{quote(did, safe='')}"))


def get_records(did: str, limit: int = 100, offset: int = 0, select: str | None = None) -> dict[str, Any]:
    return HTTP.get_json(
        api_url(
            f"/catalog/datasets/{quote(did, safe='')}/records",
            limit=max(1, min(limit, 100)),
            offset=max(0, offset),
            select=select,
        )
    )


def compact_record(record: dict[str, Any], max_fields: int = 14) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, val in record.items():
        if len(result) >= max_fields:
            break
        if isinstance(val, (dict, list)):
            # Keep simple coordinates if present, otherwise avoid large structures.
            if isinstance(val, dict) and set(val.keys()) >= {"lat", "lon"}:
                result[key] = {"lat": val.get("lat"), "lon": val.get("lon")}
            continue
        if val is None or val == "":
            continue
        result[key] = compact_text(val, 220)
    return result


def pick(record: dict[str, Any], include: Iterable[str], exclude: Iterable[str] = ()) -> Any:
    inc = [norm(x) for x in include]
    exc = [norm(x) for x in exclude]
    best = None
    best_score = -1
    for key, value in record.items():
        nk = norm(key)
        if any(x in nk for x in exc):
            continue
        score = sum(3 if nk == x else 1 for x in inc if x and x in nk)
        if score > best_score and score > 0 and value not in (None, ""):
            best, best_score = value, score
    return best


def extract_geo(record: dict[str, Any]) -> tuple[float | None, float | None]:
    for val in record.values():
        if isinstance(val, dict):
            lat = safe_float(val.get("lat") or val.get("latitude"))
            lon = safe_float(val.get("lon") or val.get("lng") or val.get("longitude"))
            if lat is not None and lon is not None:
                return lat, lon
        if isinstance(val, (list, tuple)) and len(val) >= 2:
            a, b = safe_float(val[0]), safe_float(val[1])
            if a is not None and b is not None:
                # GeoJSON order is usually lon, lat.
                if abs(a) <= 180 and abs(b) <= 90:
                    return b, a
    lat = safe_float(pick(record, ["latitude", "lat"]))
    lon = safe_float(pick(record, ["longitude", "lon", "lng"]))
    return lat, lon


def normalize_parking_record(record: dict[str, Any]) -> dict[str, Any]:
    name = pick(record, ["nom", "libelle", "parking", "parc"])
    capacity = safe_float(pick(record, ["capacite", "capacite vl", "places total", "nb places", "total"], ["dispon", "libre", "occupe"]))
    available = safe_float(pick(record, ["disponible", "libre", "places libres", "places dispo"], ["taux"]))
    occupied = safe_float(pick(record, ["occupees", "occupe", "occupied"], ["taux"]))
    rate = safe_float(pick(record, ["taux occupation", "occupation", "remplissage"], ["places", "nb"]))
    if rate is not None and 0 <= rate <= 1.01:
        rate *= 100
    if rate is None and capacity and capacity > 0:
        if occupied is not None:
            rate = occupied / capacity * 100
        elif available is not None:
            rate = (capacity - available) / capacity * 100
    lat, lon = extract_geo(record)
    status = pick(record, ["statut", "status", "etat"])
    updated = pick(record, ["date", "horodatage", "timestamp", "maj", "mise a jour"])
    return {
        "name": compact_text(name or "Parking métropolitain", 140),
        "capacity": capacity,
        "available": available,
        "occupied": occupied,
        "occupancy_pct": round(rate, 2) if rate is not None else None,
        "status": compact_text(status, 80) if status is not None else None,
        "updated": compact_text(updated, 100) if updated is not None else None,
        "lat": lat,
        "lon": lon,
        "raw": compact_record(record),
    }


def fetch_parking(did: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    started = time.perf_counter()
    try:
        obj = get_records(did, 100)
        rows = obj.get("results") or []
        if not isinstance(rows, list):
            raise RuntimeError("parking results invalid")
        normalized = [normalize_parking_record(r) for r in rows if isinstance(r, dict)]
        return normalized, {
            "ok": True,
            "dataset_id": did,
            "records": len(normalized),
            "total_count": obj.get("total_count"),
            "latency_ms": round((time.perf_counter() - started) * 1000),
            "error": None,
        }
    except Exception as exc:
        return [], {
            "ok": False,
            "dataset_id": did,
            "records": 0,
            "total_count": None,
            "latency_ms": None,
            "error": compact_text(exc),
        }


def verify_dataset(did: str) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        meta = get_dataset_meta(did)
        ds = meta.get("dataset") if isinstance(meta.get("dataset"), dict) else meta
        title = dataset_title(ds if isinstance(ds, dict) else {})
        fields = (ds or {}).get("fields") if isinstance(ds, dict) else None
        return {
            "ok": True,
            "dataset_id": did,
            "title": title or did,
            "field_count": len(fields) if isinstance(fields, list) else None,
            "data_processed": dataset_processed(ds if isinstance(ds, dict) else {}),
            "latency_ms": round((time.perf_counter() - started) * 1000),
            "error": None,
        }
    except Exception as exc:
        return {
            "ok": False,
            "dataset_id": did,
            "title": did,
            "field_count": None,
            "data_processed": None,
            "latency_ms": None,
            "error": compact_text(exc),
        }


def infer_sector_from_text(text: str) -> str:
    t = norm(text)
    if any(x in t for x in ["aulnat", "gerzat", "lempdes", "pont du chateau", "cebazat", "blanzat", "chateaugay", "nord est"]):
        return "Nord & Est"
    if any(x in t for x in ["chamalieres", "durtol", "orcines", "royat", "ouest"]):
        return "Ouest"
    if any(x in t for x in ["aubiere", "beaumont", "ceyrat", "cournon", "romagnat", "le cendre", "sud"]):
        return "Sud"
    if "clermont ferrand" in t or "clermont" in t or "centre" in t:
        return "Clermont-Centre"
    return "Métropole / secteur non déterminé"


def record_text(record: dict[str, Any]) -> str:
    parts = []
    for key, val in record.items():
        if isinstance(val, (dict, list)) or val in (None, ""):
            continue
        if any(x in norm(key) for x in ["objectid", "identifiant", "id technique", "geo shape"]):
            continue
        parts.append(f"{key}: {val}")
    return compact_text(" · ".join(parts), 900)


def api_context_candidates(discovered: list[dict[str, Any]], excluded_ids: set[str] | None = None, max_datasets: int = 10) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    events: list[dict[str, Any]] = []
    status: list[dict[str, Any]] = []
    excluded_ids = excluded_ids or set(KNOWN_DATASETS.values())
    for ds in [x for x in discovered if x["dataset_id"] not in excluded_ids][:max_datasets]:
        did = ds["dataset_id"]
        started = time.perf_counter()
        try:
            obj = get_records(did, 100)
            rows = obj.get("results") or []
            if not isinstance(rows, list):
                raise RuntimeError("results invalid")
            status.append({
                "ok": True,
                "dataset_id": did,
                "title": ds["title"],
                "records_sampled": len(rows),
                "total_count": obj.get("total_count"),
                "latency_ms": round((time.perf_counter() - started) * 1000),
                "error": None,
            })
            for r in rows[:100]:
                if not isinstance(r, dict):
                    continue
                text = record_text(r)
                nt = norm(text)
                if not any(norm(term) in nt for term in ["travaux", "chantier", "circulation", "route barr", "fermeture", "deviation", "déviation", "inspire"]):
                    continue
                place = pick(r, ["lieu", "voie", "rue", "adresse", "commune", "libelle", "nom"])
                start = pick(r, ["date debut", "debut", "start"])
                end = pick(r, ["date fin", "fin", "end"])
                events.append({
                    "sector": infer_sector_from_text(text),
                    "place": compact_text(place or ds["title"], 180),
                    "text": text,
                    "start": compact_text(start, 80) if start is not None else None,
                    "end": compact_text(end, 80) if end is not None else None,
                    "source": f"{API_BASE}/catalog/datasets/{did}",
                    "source_type": "clermont_api",
                    "dataset_id": did,
                })
        except Exception as exc:
            status.append({
                "ok": False,
                "dataset_id": did,
                "title": ds["title"],
                "records_sampled": 0,
                "total_count": None,
                "latency_ms": None,
                "error": compact_text(exc),
            })
    return dedupe_works(events), status


class TextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style", "noscript"):
            self.skip += 1
        if tag in ("h1", "h2", "h3", "h4", "p", "li", "td", "br"):
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "noscript") and self.skip:
            self.skip -= 1
        if tag in ("h1", "h2", "h3", "h4", "p", "li", "td"):
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.skip:
            self.parts.append(data)


def works_for_sector(sector: str, url: str) -> list[dict[str, Any]]:
    raw = HTTP.get_text(url)
    parser = TextParser()
    parser.feed(raw)
    text = re.sub(r"[ \t\r\f\v]+", " ", "".join(parser.parts))
    lines = [x.strip() for x in re.sub(r"\n+", "\n", text).split("\n") if len(x.strip()) >= 4]
    items = []
    current_place = ""
    for i, line in enumerate(lines):
        low = line.lower()
        if low.startswith("travaux à "):
            current_place = line[10:].strip()
        impact_words = (
            "route barrée",
            "circulation",
            "fermeture",
            "déviation",
            "sens unique",
            "travaux",
            "aménagement",
            "réseaux",
            "chantier",
            "inspire",
        )
        if any(w in low for w in impact_words) and not low.startswith("travaux secteur"):
            context = " · ".join(lines[max(0, i - 1) : min(len(lines), i + 2)])
            items.append(
                {
                    "sector": sector,
                    "place": compact_text(current_place, 180),
                    "text": compact_text(context, 700),
                    "source": url,
                    "source_type": "official_page",
                    "dataset_id": None,
                }
            )
    return dedupe_works(items)[:100]


def dedupe_works(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    out = []
    for item in items:
        key = (norm(item.get("sector")), norm(item.get("place")), norm(item.get("text"))[:240])
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def merge_works(api_items: list[dict[str, Any]], page_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # API first, pages supplement. Similar entries are kept only once.
    out: list[dict[str, Any]] = []
    signatures: list[tuple[str, set[str]]] = []
    for item in api_items + page_items:
        text = norm(" ".join([str(item.get("sector", "")), str(item.get("place", "")), str(item.get("text", ""))]))
        tokens = {x for x in text.split() if len(x) >= 4}
        duplicate = False
        for sector, prev in signatures:
            if sector != norm(item.get("sector")):
                continue
            overlap = len(tokens & prev) / max(1, min(len(tokens), len(prev)))
            if overlap >= 0.72:
                duplicate = True
                break
        if not duplicate:
            out.append(item)
            signatures.append((norm(item.get("sector")), tokens))
    return out[:250]


def weather() -> list[dict[str, Any]]:
    url = (
        "https://api.open-meteo.com/v1/forecast?latitude=45.7772&longitude=3.0870"
        "&past_days=92&forecast_days=7&timezone=Europe%2FParis"
        "&daily=temperature_2m_mean,precipitation_sum,rain_sum,snowfall_sum"
    )
    data = HTTP.get_json(url)
    d = data.get("daily", {}) if isinstance(data, dict) else {}
    times = d.get("time", []) or []
    out = []
    for i, date in enumerate(times):
        def at(key: str) -> Any:
            arr = d.get(key) or []
            return arr[i] if i < len(arr) else None
        out.append(
            {
                "date": date,
                "temperature_mean": at("temperature_2m_mean"),
                "precipitation_mm": at("precipitation_sum"),
                "rain_mm": at("rain_sum"),
                "snowfall_cm": at("snowfall_sum"),
            }
        )
    return out


def source_state(name: str, ok: bool, *, detail: str = "", error: str | None = None, url: str | None = None) -> dict[str, Any]:
    return {
        "name": name,
        "ok": bool(ok),
        "checked_at": iso_now(),
        "detail": compact_text(detail, 350),
        "error": compact_text(error, 350) if error else None,
        "url": url,
    }


def validate_payload(payload: dict[str, Any]) -> list[str]:
    errors = []
    if payload.get("schema_version") != 2:
        errors.append("schema_version must be 2")
    if not isinstance(payload.get("works"), list):
        errors.append("works must be a list")
    if not isinstance(payload.get("weather"), list):
        errors.append("weather must be a list")
    if not isinstance(payload.get("source_health"), list):
        errors.append("source_health must be a list")
    api = payload.get("clermont_api")
    if not isinstance(api, dict):
        errors.append("clermont_api missing")
    elif not isinstance(api.get("health"), dict):
        errors.append("clermont_api.health missing")
    return errors


def update_history(payload: dict[str, Any]) -> None:
    history = read_json(HISTORY_OUT, {"schema_version": 1, "snapshots": []})
    snapshots = history.get("snapshots") if isinstance(history, dict) else []
    if not isinstance(snapshots, list):
        snapshots = []
    parking_rates = [safe_float(x.get("occupancy_pct")) for x in payload.get("parking", [])]
    parking_rates = [x for x in parking_rates if x is not None]
    by_sector: dict[str, int] = {}
    for w in payload.get("works", []):
        sec = str(w.get("sector") or "Non déterminé")
        by_sector[sec] = by_sector.get(sec, 0) + 1
    snapshot = {
        "generated_at": payload.get("generated_at"),
        "status": payload.get("status"),
        "api_ok": bool(payload.get("clermont_api", {}).get("health", {}).get("ok")),
        "api_total_datasets": payload.get("clermont_api", {}).get("health", {}).get("total_datasets"),
        "works_count": len(payload.get("works", [])),
        "works_by_sector": by_sector,
        "parking_avg_occupancy_pct": round(sum(parking_rates) / len(parking_rates), 2) if parking_rates else None,
        "parking_records": len(payload.get("parking", [])),
        "weather_days": len(payload.get("weather", [])),
    }
    if snapshots and snapshots[-1].get("generated_at", "")[:13] == str(snapshot["generated_at"])[:13]:
        snapshots[-1] = snapshot
    else:
        snapshots.append(snapshot)
    snapshots = snapshots[-720:]
    HISTORY_OUT.write_text(json.dumps({"schema_version": 1, "snapshots": snapshots}, ensure_ascii=False, separators=(",", ":")), "utf-8")


def main() -> None:
    old = read_json(OUT, {})
    errors: list[str] = []
    source_health: list[dict[str, Any]] = []

    health = api_health()
    source_health.append(source_state("Clermont Métropole Explore API", health["ok"], detail=f"{health.get('total_datasets') or '—'} jeux détectés · {health.get('latency_ms') or '—'} ms", error=health.get("error"), url=API_CONSOLE))

    catalog: list[dict[str, Any]] = []
    discovered: list[dict[str, Any]] = []
    if health["ok"]:
        try:
            catalog = catalog_all()
            discovered = discover_relevant(catalog)
            source_health.append(source_state("Catalogue Open Data Clermont", True, detail=f"{len(catalog)} jeux lus, {len(discovered)} candidats mobilité/travaux" , url=f"{API_BASE}/catalog/datasets"))
        except Exception as exc:
            errors.append(f"catalog: {exc}")
            source_health.append(source_state("Catalogue Open Data Clermont", False, error=str(exc), url=f"{API_BASE}/catalog/datasets"))
    else:
        errors.append(f"api-health: {health.get('error')}")

    resolved_datasets = resolve_known_datasets(catalog) if catalog else dict(KNOWN_DATASETS)

    dataset_checks = []
    for role, did in resolved_datasets.items():
        if health["ok"]:
            chk = verify_dataset(did)
        else:
            chk = {"ok": False, "dataset_id": did, "title": did, "error": "API indisponible", "field_count": None, "data_processed": None, "latency_ms": None}
        chk["role"] = role
        dataset_checks.append(chk)
        source_health.append(source_state(f"Dataset Clermont · {role}", chk["ok"], detail=f"{chk.get('title') or did} · {chk.get('field_count') if chk.get('field_count') is not None else '—'} champs", error=chk.get("error"), url=f"{API_BASE}/catalog/datasets/{did}"))

    parking: list[dict[str, Any]] = []
    parking_status: dict[str, Any]
    if health["ok"]:
        parking, parking_status = fetch_parking(resolved_datasets["parking"])
    else:
        parking_status = {"ok": False, "dataset_id": resolved_datasets["parking"], "records": 0, "error": "API indisponible"}
    if not parking and isinstance(old.get("parking"), list):
        parking = old.get("parking", [])
        parking_status["fallback_last_known_good"] = bool(parking)
    source_health.append(source_state("Occupation parkings Métropole", parking_status.get("ok", False), detail=f"{parking_status.get('records', 0)} parcs lus" + (" · dernier état conservé" if parking_status.get("fallback_last_known_good") else ""), error=parking_status.get("error"), url=f"{API_BASE}/catalog/datasets/{resolved_datasets['parking']}/records"))

    api_works: list[dict[str, Any]] = []
    candidate_status: list[dict[str, Any]] = []
    if discovered and health["ok"]:
        api_works, candidate_status = api_context_candidates(discovered, set(resolved_datasets.values()))
    source_health.append(source_state("Détection automatique jeux travaux/mobilité", bool(discovered) and all(x.get("ok") for x in candidate_status if x), detail=f"{len(discovered)} candidat(s), {len(api_works)} événement(s) exploitable(s) via API", error=None if discovered else "Aucun jeu candidat détecté dans le catalogue", url=f"{API_BASE}/catalog/datasets"))

    page_works: list[dict[str, Any]] = []
    page_status: list[dict[str, Any]] = []
    for sector, url in WORK_PAGES.items():
        try:
            rows = works_for_sector(sector, url)
            page_works.extend(rows)
            page_status.append({"sector": sector, "ok": True, "records": len(rows), "error": None, "url": url})
            source_health.append(source_state(f"Travaux officiels · {sector}", True, detail=f"{len(rows)} élément(s)", url=url))
        except Exception as exc:
            page_status.append({"sector": sector, "ok": False, "records": 0, "error": compact_text(exc), "url": url})
            errors.append(f"works-page-{sector}: {exc}")
            source_health.append(source_state(f"Travaux officiels · {sector}", False, error=str(exc), url=url))

    works = merge_works(api_works, page_works)
    if not works and isinstance(old.get("works"), list):
        works = old.get("works", [])
        errors.append("works: no fresh event, last-known-good retained")

    try:
        meteo = weather()
        source_health.append(source_state("Open-Meteo Clermont", True, detail=f"{len(meteo)} jours météo", url="https://api.open-meteo.com/"))
    except Exception as exc:
        errors.append(f"weather: {exc}")
        meteo = old.get("weather", []) if isinstance(old.get("weather"), list) else []
        source_health.append(source_state("Open-Meteo Clermont", False, detail="dernier historique conservé" if meteo else "", error=str(exc), url="https://api.open-meteo.com/"))

    old_health = {str(x.get("name")):x for x in old.get("source_health",[]) if isinstance(x,dict)} if isinstance(old,dict) else {}
    for row in source_health:
        if row.get("ok"):
            row["last_success_at"] = row.get("checked_at")
        else:
            row["last_success_at"] = old_health.get(str(row.get("name")),{}).get("last_success_at") or old_health.get(str(row.get("name")),{}).get("checked_at")

    api_ok = bool(health.get("ok"))
    fresh_work_sources = sum(1 for x in page_status if x.get("ok")) + (1 if api_works else 0)
    critical_ok = api_ok and any(x.get("ok") for x in dataset_checks if x.get("role") in ("roads", "parking"))
    status = "ok" if critical_ok and fresh_work_sources >= 2 and not errors else "partial"
    if not api_ok and not works and not meteo:
        status = "unavailable"

    payload = {
        "schema_version": 2,
        "build": VERSION,
        "generated_at": iso_now(),
        "status": status,
        "privacy": "Public-data-only updater. No customer/TGM data is transmitted.",
        "clermont_api": {
            "base_url": API_BASE,
            "health": health,
            "resolved_dataset_ids": resolved_datasets,
            "known_datasets": dataset_checks,
            "discovered_relevant_datasets": discovered,
            "candidate_fetch_status": candidate_status,
        },
        "works": works,
        "works_sources": {
            "api_events": len(api_works),
            "official_page_events": len(page_works),
            "page_status": page_status,
        },
        "parking": parking,
        "parking_status": parking_status,
        "weather": meteo,
        "source_health": source_health,
        "errors": [compact_text(x, 500) for x in errors],
        "sources": [API_CONSOLE, *WORK_PAGES.values(), "https://api.open-meteo.com/"],
    }

    validation_errors = validate_payload(payload)
    if validation_errors:
        raise RuntimeError("Payload validation failed: " + "; ".join(validation_errors))

    # Transactional write.
    OUT.parent.mkdir(parents=True, exist_ok=True)
    TMP.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    json.loads(TMP.read_text("utf-8"))
    TMP.replace(OUT)
    update_history(payload)

    ok_sources = sum(1 for x in source_health if x.get("ok"))
    print(
        f"status={status} api_ok={api_ok} datasets={len(catalog)} relevant={len(discovered)} "
        f"works={len(works)} api_works={len(api_works)} parking={len(parking)} weather={len(meteo)} "
        f"sources_ok={ok_sources}/{len(source_health)} errors={len(errors)}"
    )


if __name__ == "__main__":
    main()
