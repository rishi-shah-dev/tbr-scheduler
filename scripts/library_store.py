import json
import os
from .config import OUTPUT_JSON_PATH


def load_existing_library():
    """Loads existing JSON if it exists."""
    if not os.path.exists(OUTPUT_JSON_PATH):
        return {}
    try:
        with open(OUTPUT_JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("books", {})
    except json.JSONDecodeError:
        print("Warning: Existing library.json is corrupted. Starting fresh.")
        return {}


def save_library(books_data):
    """Saves the updated data to JSON."""
    # Ensure directory exists
    os.makedirs(os.path.dirname(OUTPUT_JSON_PATH), exist_ok=True)

    output = {
        "meta": {"schema_version": 1, "book_count": len(books_data)},
        "books": books_data,
    }

    with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\n✅ Saved {len(books_data)} books to {OUTPUT_JSON_PATH}")
