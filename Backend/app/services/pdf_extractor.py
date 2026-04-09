"""PDF text extraction with pypdf fast path and PaddleOCR fallback.

pypdf handles digital PDFs in <500ms. For scanned/image-only PDFs (and Hindi
legal docs from regional registries), we fall back to PaddleOCR PP-OCRv5 mobile
models — lazy-loaded singletons so app boot stays cheap and Railway can
auto-sleep when no scanned uploads have arrived.
"""

import io
import logging
import sys
import types

from pypdf import PdfReader

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shim: paddlex 3.3.13 vs langchain 1.x incompatibility
# ---------------------------------------------------------------------------
# paddlex's OpenAIBotRetriever (loaded as a side-effect of
# `from paddleocr import PaddleOCR` via paddlex's greedy pipeline imports)
# hardcodes `from langchain.docstore.document import Document` — the legacy
# langchain 0.x import path, removed in langchain 1.x. We pin langchain 1.x
# for our actual chat code and can't downgrade. We also never use paddlex's
# retrieval components, but the import must still succeed for paddleocr to
# load at all.
#
# Fix: inject a minimal stub Document class into sys.modules so paddlex's
# import resolves. The stub is never actually instantiated at runtime — no
# OCR code path reaches OpenAIBotRetriever. Remove this block when paddlex
# upgrades to langchain 1.x or we migrate to a different OCR backend.
if "langchain.docstore.document" not in sys.modules:
    class _StubLangchainDocument:
        def __init__(self, page_content: str = "", metadata: dict | None = None):
            self.page_content = page_content
            self.metadata = metadata or {}

    _stub_document_module = types.ModuleType("langchain.docstore.document")
    _stub_document_module.Document = _StubLangchainDocument

    _stub_docstore_module = types.ModuleType("langchain.docstore")
    _stub_docstore_module.document = _stub_document_module

    sys.modules["langchain.docstore"] = _stub_docstore_module
    sys.modules["langchain.docstore.document"] = _stub_document_module

if "langchain.text_splitter" not in sys.modules:
    class _StubRecursiveCharacterTextSplitter:
        """Stub — never instantiated; satisfies paddlex's import only."""
        def __init__(self, *args, **kwargs):
            pass

    _stub_text_splitter_module = types.ModuleType("langchain.text_splitter")
    _stub_text_splitter_module.RecursiveCharacterTextSplitter = (
        _StubRecursiveCharacterTextSplitter
    )
    sys.modules["langchain.text_splitter"] = _stub_text_splitter_module

# Cached PaddleOCR singletons — lazy-loaded on first OCR call.
# Loading these into RAM costs ~600MB (English) + ~80MB (Hindi rec model).
# They are NOT loaded at app boot — only when a real scanned PDF arrives.
_ocr_en = None
_ocr_hi = None

# OCR triggers if pypdf returns less than this many chars
_OCR_FALLBACK_THRESHOLD = 100


def _get_ocr_en():
    """Lazy-init English PaddleOCR singleton (PP-OCRv5 mobile)."""
    global _ocr_en
    if _ocr_en is None:
        from paddleocr import PaddleOCR
        logger.info("[ocr] Lazy-loading PaddleOCR English (PP-OCRv5_mobile)")
        _ocr_en = PaddleOCR(
            lang="en",
            # Aux models off — saves ~150MB RAM + ~100ms latency.
            # Legal PDFs are oriented correctly, no need for orientation/unwarping.
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            cpu_threads=2,
            enable_mkldnn=True,
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="en_PP-OCRv5_mobile_rec",
        )
    return _ocr_en


def _get_ocr_hi():
    """Lazy-init Hindi PaddleOCR singleton (devanagari PP-OCRv5 mobile)."""
    global _ocr_hi
    if _ocr_hi is None:
        from paddleocr import PaddleOCR
        logger.info("[ocr] Lazy-loading PaddleOCR Hindi (devanagari_PP-OCRv5_mobile)")
        _ocr_hi = PaddleOCR(
            lang="hi",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            cpu_threads=2,
            enable_mkldnn=True,
            text_detection_model_name="PP-OCRv5_mobile_det",
            text_recognition_model_name="devanagari_PP-OCRv5_mobile_rec",
        )
    return _ocr_hi


def extract_text(file_bytes: bytes) -> tuple[str, int]:
    """Extract text from PDF bytes — pypdf fast path, OCR fallback if empty.

    Returns (text, page_count). Page count comes from pypdf even when OCR runs.
    """
    # Stage 1 — pypdf fast path (~500ms for digital PDFs)
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = len(reader.pages)
    text = "\n\n".join(page.extract_text() or "" for page in reader.pages).strip()

    if len(text) >= _OCR_FALLBACK_THRESHOLD:
        logger.info(
            f"[ocr] pypdf extracted {len(text)} chars from {pages} pages — no OCR needed"
        )
        return text, pages

    # Stage 2 — OCR fallback for scanned/image-only PDFs
    logger.info(
        f"[ocr] pypdf only got {len(text)} chars — falling back to PaddleOCR"
    )
    ocr_text = _extract_text_ocr(file_bytes)
    return ocr_text, pages


def _extract_text_ocr(file_bytes: bytes) -> str:
    """OCR fallback. English pass first; Hindi pass triggered if Devanagari detected."""
    from pdf2image import convert_from_bytes

    # dpi=200 is the empirical sweet spot for printed legal text — below 150
    # PaddleOCR detection misses small text; above 300 the speedup from MKLDNN
    # doesn't compensate for the 4x larger image.
    images = convert_from_bytes(file_bytes, dpi=200)

    # English pass — covers 99% of digital legal docs and most scanned ones too
    en_text = _ocr_pages(_get_ocr_en(), images)

    # Heuristic: if English pass returned little text OR contains Devanagari
    # unicode chars, also run Hindi recognizer. Devanagari range is U+0900-U+097F.
    has_devanagari = any("\u0900" <= ch <= "\u097f" for ch in en_text)
    if len(en_text.strip()) < 200 or has_devanagari:
        logger.info("[ocr] Triggering Hindi pass (en_text too short or Devanagari detected)")
        hi_text = _ocr_pages(_get_ocr_hi(), images)
        return f"{en_text}\n\n{hi_text}".strip()

    return en_text


def _ocr_pages(ocr_instance, images: list) -> str:
    """Run a PaddleOCR instance over a list of PIL images, return joined text."""
    import numpy as np
    parts = []
    for img in images:
        result = ocr_instance.predict(np.array(img))
        # PaddleOCR 3.x predict() returns a list with one element per image.
        # That element exposes 'rec_texts' (plural) — list of recognized strings.
        if result and len(result) > 0:
            page = result[0]
            rec_texts = page.get("rec_texts") if isinstance(page, dict) else getattr(page, "rec_texts", None)
            if rec_texts:
                parts.append("\n".join(rec_texts))
    return "\n\n".join(parts)
