import subprocess
import json
import os
from .config import CALIBRE_LIBRARY_PATH


def get_calibre_books():
    """Fetches book metadata from Calibre via command line."""
    if not os.path.exists(CALIBRE_LIBRARY_PATH):
        raise FileNotFoundError(f"Calibre library not found at: {CALIBRE_LIBRARY_PATH}")

    # ✅ FIX: Removed the invalid 'path' field.
    # 'formats' will contain the full file paths when used with --for-machine.
    cmd = [
        "calibredb",
        "list",
        "--library-path",
        CALIBRE_LIBRARY_PATH,
        "--fields",
        "id,title,authors,uuid,formats",
        "--for-machine",
    ]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, check=True, encoding="utf-8"
        )
        books = json.loads(result.stdout)
        return books
    except FileNotFoundError:
        print(
            "Error: 'calibredb' command not found. Make sure Calibre is installed and in your PATH."
        )
        return []
    except subprocess.CalledProcessError as e:
        print(f"Error reading Calibre library: {e.stderr}")
        return []


def get_epub_path(book):
    """Extracts the EPUB file path and stats directly from the 'formats' list."""
    formats = book.get("formats", [])

    # In case Calibre ever returns it as a string, handle it safely
    if isinstance(formats, str):
        formats = formats.split(",")

    for path in formats:
        path = str(path).strip()
        if path.lower().endswith(".epub"):
            if os.path.exists(path):
                stat = os.stat(path)
                return {
                    "absolute_path": path,
                    "file_size": stat.st_size,
                    "file_mtime": stat.st_mtime,
                }
    return None
