#!/usr/bin/env python3
"""
Generates src/screens/Books/popularBooks.ts with a static list of popular books
from BookHive's catalog, sorted by ratingsCount.

Usage: python3 scripts/generate-popular-books.py
"""

import json
import subprocess
import os

API_BASE = "https://bookhive.buzz/xrpc/buzz.bookhive.searchBooks"
QUERIES = [
    "book", "story", "world", "life", "love", "history", "dark", "night",
    "time", "war", "girl", "man", "house", "fire", "death", "lord", "king",
    "queen", "power", "game", "secret", "blood", "last", "shadow", "heart",
    "dream", "lost", "city", "magic", "star",
]
TOP_N = 50
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "src", "screens", "Books", "popularBooks.ts"
)


def fetch_books():
    seen = set()
    books = []
    for q in QUERIES:
        url = f"{API_BASE}?q={q}&limit=25&offset=0"
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


def esc(s):
    if s is None:
        return "undefined"
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
        lines.append("  }" + comma)

    lines.append("]")
    lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    print(f"Fetching books from {len(QUERIES)} queries...")
    books = fetch_books()
    print(f"Found {len(books)} unique books")
    ts = generate_ts(books)
    with open(OUTPUT_PATH, "w") as f:
        f.write(ts)
    print(f"Wrote top {TOP_N} to {OUTPUT_PATH}")
