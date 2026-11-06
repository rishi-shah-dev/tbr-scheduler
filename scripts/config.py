import os

# --- PATHS ---
# Update this to your actual Calibre Library folder
CALIBRE_LIBRARY_PATH = r"D:\Books\Calibre"
# Where the output JSON will be saved (relative to project root)
OUTPUT_JSON_PATH = os.path.join("web", "data", "library.json")

# --- READING DEFAULTS ---
# Used by the frontend later, but we can store them here for reference
DEFAULT_WPM_FICTION = 260
DEFAULT_WPM_NON_FICTION = 238
