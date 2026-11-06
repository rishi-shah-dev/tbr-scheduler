import time
import os
import shutil
from .calibre_client import get_calibre_books, get_epub_path
from .epub_parser import parse_epub
from .library_store import load_existing_library, save_library


def main():
    print("🚀 Starting library scan...")
    start_time = time.time()

    existing_books = load_existing_library()
    print(f"Loaded {len(existing_books)} existing books from JSON.")

    calibre_books = get_calibre_books()
    if not calibre_books:
        print("No books found in Calibre. Exiting.")
        return

    print(f"Found {len(calibre_books)} total books in Calibre.")

    updated_books = {}
    new_count = 0
    skipped_count = 0
    failed_count = 0
    missing_epub_count = 0  # <-- NEW COUNTER
    processed_count = 0

    # Make sure the covers directory exists
    covers_dir = os.path.join("web", "data", "covers")
    os.makedirs(covers_dir, exist_ok=True)

    try:
        for book in calibre_books:
            uuid = book.get("uuid")
            if not uuid:
                continue

            epub_info = get_epub_path(book)

            # ✅ Track books that don't have an EPUB file
            if not epub_info:
                missing_epub_count += 1
                continue

            existing = existing_books.get(uuid)
            if (
                existing
                and existing.get("file_mtime") == epub_info["file_mtime"]
                and existing.get("file_size") == epub_info["file_size"]
            ):
                updated_books[uuid] = existing
                skipped_count += 1
                continue

            print(f"  -> Parsing: {book.get('title')}")
            parsed_data = parse_epub(epub_info["absolute_path"])

            # ✅ NEW: Extract and copy the cover image
            epub_dir = os.path.dirname(epub_info["absolute_path"])
            cover_src = os.path.join(epub_dir, "cover.jpg")
            cover_dest_rel = ""  # Relative path for the frontend

            if os.path.exists(cover_src):
                cover_filename = f"{uuid}.jpg"
                cover_dest = os.path.join(covers_dir, cover_filename)
                try:
                    shutil.copy2(cover_src, cover_dest)
                    cover_dest_rel = f"data/covers/{cover_filename}"
                except Exception as e:
                    print(f"     -> Could not copy cover: {e}")

            if parsed_data:
                updated_books[uuid] = {
                    "calibre_id": book.get("id"),
                    "uuid": uuid,
                    "title": book.get("title"),
                    "authors": book.get("authors", "").split(" & "),
                    "file_mtime": epub_info["file_mtime"],
                    "file_size": epub_info["file_size"],
                    "cover_path": cover_dest_rel,  # <-- NEW
                    **parsed_data,
                }
                new_count += 1
            else:
                failed_count += 1

            processed_count += 1
            if processed_count % 10 == 0:
                save_library(updated_books)
                print(f"     [Checkpoint] Saved progress...")

    except KeyboardInterrupt:
        print("\n⚠️ Interrupted by user! Saving current progress before exiting...")
    finally:
        save_library(updated_books)

        elapsed = time.time() - start_time
        print(f"\n📊 Scan complete in {elapsed:.1f} seconds:")
        print(f"   - New/Updated: {new_count}")
        print(f"   - Skipped (cached): {skipped_count}")
        print(f"   - Failed to parse: {failed_count}")
        print(f"   - Missing EPUB format: {missing_epub_count}")
        print(f"   - Total in JSON: {len(updated_books)}")


if __name__ == "__main__":
    main()
