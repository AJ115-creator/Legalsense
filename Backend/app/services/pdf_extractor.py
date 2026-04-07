import io
from pypdf import PdfReader


def extract_text(file_bytes: bytes) -> tuple[str, int]:
    """Extract text from PDF bytes. Returns (text, page_count)."""
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = len(reader.pages)
    text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    return text.strip(), pages
