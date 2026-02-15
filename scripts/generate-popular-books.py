#!/usr/bin/env python3
"""
Generates src/screens/Books/popularBooks.ts with a static list of popular books
from BookHive's catalog, sorted by ratingsCount, including community activity data.

Usage: python3 scripts/generate-popular-books.py
"""

import json
import subprocess
import os
import time

API_BASE = "https://bookhive.buzz/xrpc"
SEARCH_URL = f"{API_BASE}/buzz.bookhive.searchBooks"
GETBOOK_URL = f"{API_BASE}/buzz.bookhive.getBook"
QUERIES = [
    "book", "story", "world", "life", "love", "history", "dark", "night",
    "time", "war", "girl", "man", "house", "fire", "death", "lord", "king",
    "queen", "power", "game", "secret", "blood", "last", "shadow", "heart",
    "dream", "lost", "city", "magic", "star",
]
TOP_N = 50
ACTIVITY_LIMIT = 10  # Max activity entries per book
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "src", "screens", "Books", "popularBooks.ts"
)


def fetch_books():
    seen = set()
    books = []
    for q in QUERIES:
        url = f"{SEARCH_URL}?q={q}&limit=25&offset=0"
        result = subprocess.run(
            ["curl", "-s", url], capture_output=True, text=True
        )
        try:
            data = json.loads(result.stdout)
            for b in data:
                if b["id"] not in seen:
                    seen.add(b["id"])
                    books.append(b)
        except (json.JSONDecodeError, KeyError):
            pass
    return books


def fetch_activity(hive_id):
    """Fetch activity for a single book via getBook API."""
    url = f"{GETBOOK_URL}?id={hive_id}"
    result = subprocess.run(
        ["curl", "-s", url], capture_output=True, text=True
    )
    try:
        data = json.loads(result.stdout)
        activity = data.get("activity", [])
        # Keep only the fields we need, limit total entries
        trimmed = []
        for a in activity[:ACTIVITY_LIMIT]:
            trimmed.append({
                "type": a.get("type", "started"),
                "userDid": a["userDid"],
                "userHandle": a["userHandle"],
            })
        return trimmed
    except (json.JSONDecodeError, KeyError):
        return []


def esc(s):
    if s is None:
        return "undefined"
    s = s.replace("\u2018", "'").replace("\u2019", "'")  # smart quotes to ascii
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def generate_ts(books):
    books.sort(key=lambda b: b.get("ratingsCount", 0), reverse=True)
    top = books[:TOP_N]

    lines = [
        "// This file is auto-generated. To refresh, run:",
        "// python3 scripts/generate-popular-books.py",
        "import {type HiveBook} from '#/state/queries/bookhive'",
        "",
        "export const POPULAR_BOOKS: HiveBook[] = [",
    ]

    for i, b in enumerate(top):
        comma = "," if i < len(top) - 1 else ""
        lines.append("  {")
        lines.append(f"    id: {esc(b['id'])},")
        lines.append(f"    title: {esc(b['title'])},")
        lines.append(f"    authors: {esc(b['authors'])},")
        lines.append(f"    thumbnail: {esc(b['thumbnail'])},")
        if b.get("cover"):
            lines.append(f"    cover: {esc(b['cover'])},")
        if b.get("rating") is not None:
            lines.append(f"    rating: {b['rating']},")
        if b.get("ratingsCount") is not None:
            lines.append(f"    ratingsCount: {b['ratingsCount']},")
        lines.append(f"    createdAt: {esc(b['createdAt'])},")
        lines.append(f"    updatedAt: {esc(b['updatedAt'])},")
        # Activity data
        activity = b.get("_activity", [])
        if activity:
            lines.append("    activity: [")
            for j, a in enumerate(activity):
                acomma = "," if j < len(activity) - 1 else ""
                lines.append(
                    f"      {{type: {esc(a['type'])}, "
                    f"userDid: {esc(a['userDid'])}, "
                    f"userHandle: {esc(a['userHandle'])}}}{acomma}"
                )
            lines.append("    ],")
        lines.append("  }" + comma)

    lines.append("]")
    lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    print(f"Fetching books from {len(QUERIES)} queries...")
    books = fetch_books()
    print(f"Found {len(books)} unique books")

    # Sort and take top N before fetching activity
    books.sort(key=lambda b: b.get("ratingsCount", 0), reverse=True)
    top = books[:TOP_N]

    print(f"Fetching activity for top {len(top)} books...")
    for i, b in enumerate(top):
        activity = fetch_activity(b["id"])
        b["_activity"] = activity
        if activity:
            print(f"  [{i+1}/{len(top)}] {b['title']}: {len(activity)} activity entries")
        else:
            print(f"  [{i+1}/{len(top)}] {b['title']}: no activity")
        time.sleep(0.1)  # Be nice to the API

    ts = generate_ts(top)
    with open(OUTPUT_PATH, "w") as f:
        f.write(ts)
    print(f"Wrote top {TOP_N} to {OUTPUT_PATH}")
