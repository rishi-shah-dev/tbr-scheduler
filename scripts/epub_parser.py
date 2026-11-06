import re
import os
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup


def parse_epub(file_path):
    """Reads an EPUB and returns word count and chapter details."""
    chapters_data = []
    total_words = 0

    try:
        book = epub.read_epub(file_path)

        # Iterate through the book's spine (the actual reading order)
        for item_id, linear in book.spine:
            item = book.get_item_with_id(item_id)

            # Skip broken spine references
            if not item:
                continue

            # Skip non-document items (like CSS or images)
            if item.get_type() != ebooklib.ITEM_DOCUMENT:
                continue

            # Extract text using BeautifulSoup
            soup = BeautifulSoup(item.get_content(), "html.parser")
            text = soup.get_text(separator=" ")

            # Count words using regex
            words = len(re.findall(r"\b\w+\b", text))

            if words > 0:
                # Try to find a chapter title, fallback to item file name
                title = item.get_name()
                chapters_data.append({"title": title, "words": words})
                total_words += words

        return {
            "total_words": total_words,
            "chapter_count": len(chapters_data),
            "chapters": chapters_data,
        }

    except Exception as e:
        # Catch any other parsing errors so the whole script doesn't crash
        print(f"  -> Failed to parse {os.path.basename(file_path)}: {e}")
        return None
