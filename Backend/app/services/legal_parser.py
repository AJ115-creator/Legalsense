"""Legal document parser for Indian law PDFs.

Splits legal text by sections/articles, preserving metadata for precise citation.
Falls back to recursive chunking for unstructured docs.
"""

import re
from langchain_text_splitters import RecursiveCharacterTextSplitter

CHUNK_SIZE = 2000
CHUNK_OVERLAP = 400

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n\n", "\n\n", "\n", ". ", " ", ""],
    length_function=len,
)

# Patterns for Indian legal documents
_SECTION_PATTERN = re.compile(
    r"(?:^|\n)"  # start of line
    r"(\d+)\.\s+"  # "103. " numbered section
    r"([^\n]+)",  # section title on same line
    re.MULTILINE,
)

_ARTICLE_PATTERN = re.compile(
    r"(?:^|\n)"
    r"(?:Article|Art\.?)\s+(\d+[A-Z]?)\.\s*"  # "Article 21." or "Art. 21A."
    r"([^\n]*)",
    re.MULTILINE | re.IGNORECASE,
)

_CHAPTER_PATTERN = re.compile(
    r"(?:^|\n)"
    r"CHAPTER\s+([IVXLCDM]+|[\d]+)"  # "CHAPTER IV" or "CHAPTER 4"
    r"[.\s]*([^\n]*)",
    re.MULTILINE | re.IGNORECASE,
)


def parse_act_sections(text: str, act_name: str) -> list[dict]:
    """Parse legal act text into section-based chunks with metadata.

    Returns list of dicts: {text, act_name, section, chapter}
    """
    # Detect chapter boundaries
    chapters = list(_CHAPTER_PATTERN.finditer(text))
    chapter_map = _build_chapter_map(chapters, len(text))

    # Try section-based splitting first (BNS, BNSS, BSA, ICA, CPC)
    sections = list(_SECTION_PATTERN.finditer(text))

    # Try article-based splitting (Constitution)
    if len(sections) < 3:
        sections = list(_ARTICLE_PATTERN.finditer(text))

    if len(sections) < 3:
        # Unstructured doc — fall back to recursive chunking
        return _chunk_generic(text, act_name)

    results = []
    for i, match in enumerate(sections):
        section_num = match.group(1)
        section_title = match.group(2).strip()

        # Extract section body: text from this match to next match
        start = match.start()
        end = sections[i + 1].start() if i + 1 < len(sections) else len(text)
        section_text = text[start:end].strip()

        # Find which chapter this section belongs to
        chapter = _find_chapter(match.start(), chapter_map)

        # Sub-chunk if section is too long
        if len(section_text) > CHUNK_SIZE:
            sub_chunks = _splitter.split_text(section_text)
            for j, chunk in enumerate(sub_chunks):
                results.append({
                    "text": chunk,
                    "act_name": act_name,
                    "section": f"Section {section_num}" if not section_title.startswith("Art") else f"Article {section_num}",
                    "section_title": section_title,
                    "chapter": chapter,
                    "sub_chunk": j,
                })
        else:
            results.append({
                "text": section_text,
                "act_name": act_name,
                "section": f"Section {section_num}" if not section_title.startswith("Art") else f"Article {section_num}",
                "section_title": section_title,
                "chapter": chapter,
                "sub_chunk": 0,
            })

    return results


def _chunk_generic(text: str, act_name: str) -> list[dict]:
    """Fallback: recursive character splitting for unstructured docs."""
    chunks = _splitter.split_text(text)
    return [
        {
            "text": chunk,
            "act_name": act_name,
            "section": "",
            "section_title": "",
            "chapter": "",
            "sub_chunk": i,
        }
        for i, chunk in enumerate(chunks)
    ]


def _build_chapter_map(chapters: list, text_len: int) -> list[tuple[int, int, str]]:
    """Build (start, end, chapter_name) ranges from chapter matches."""
    if not chapters:
        return []
    result = []
    for i, ch in enumerate(chapters):
        start = ch.start()
        end = chapters[i + 1].start() if i + 1 < len(chapters) else text_len
        name = f"Chapter {ch.group(1)}"
        title = ch.group(2).strip()
        if title:
            name += f" - {title}"
        result.append((start, end, name))
    return result


def _find_chapter(pos: int, chapter_map: list[tuple[int, int, str]]) -> str:
    """Find which chapter a text position belongs to."""
    for start, end, name in chapter_map:
        if start <= pos < end:
            return name
    return ""
