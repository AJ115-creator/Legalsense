"""Ingest HuggingFace legal datasets into Pinecone legal-kb.

Usage (from Backend/):
    python -m scripts.ingest_hf_datasets
    python -m scripts.ingest_hf_datasets --dataset constitution
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datasets import load_dataset
from app.services import pinecone_service
from app.services.pdf_extractor import extract_text
from app.services.legal_parser import parse_act_sections

DATASETS = {
    "constitution": {
        "name": "nisaar/Constitution_of_India",
        "act_name": "Constitution of India (QA)",
        "id_prefix": "hf_coi",
    },
    "ipc": {
        "name": "harshitv804/Indian_Penal_Code",
        "act_name": "Indian Penal Code",
        "id_prefix": "hf_ipc",
    },
}


def ingest_constitution_qa(ds_config: dict) -> int:
    """Ingest Constitution QA dataset (question + answer columns)."""
    print(f"  Loading {ds_config['name']}...")
    ds = load_dataset(ds_config["name"], split="train")
    print(f"  Loaded {len(ds)} rows")

    records = []
    for i, row in enumerate(ds):
        question = row.get("question", "")
        answer = row.get("answer", "")
        if not answer:
            continue

        text = f"Q: {question}\nA: {answer}" if question else answer
        records.append({
            "_id": f"{ds_config['id_prefix']}_{i}",
            "text": text,
            "source": "legal-kb",
            "act_name": ds_config["act_name"],
            "section": "",
            "section_title": question[:100] if question else "",
            "chapter": "",
        })

    print(f"  Upserting {len(records)} records...")
    count = pinecone_service.upsert_records(records)
    print(f"  Done: {count} records")
    return count


def _ingest_pdf_column(ds, ds_config: dict) -> int:
    """Extract text from dataset rows with a 'pdf' binary column."""
    records = []
    chunk_idx = 0
    for row_i, row in enumerate(ds):
        pdf_data = row.get("pdf")
        if pdf_data is None:
            continue

        # pdf column may be bytes directly or a dict with 'bytes' key
        if isinstance(pdf_data, dict):
            pdf_bytes = pdf_data.get("bytes") or pdf_data.get("path")
        else:
            pdf_bytes = pdf_data

        # HF datasets auto-decodes pdf column as pdfplumber.PDF object
        import pdfplumber
        if isinstance(pdf_bytes, pdfplumber.PDF):
            print(f"  Extracting text from pdfplumber PDF row {row_i}...")
            page_texts = []
            for page in pdf_bytes.pages:
                t = page.extract_text()
                if t:
                    page_texts.append(t)
            text = "\n\n".join(page_texts)
            pages = len(pdf_bytes.pages)
        elif isinstance(pdf_bytes, bytes):
            print(f"  Extracting text from PDF bytes row {row_i} ({len(pdf_bytes)//1024}KB)...")
            text, pages = extract_text(pdf_bytes)
        else:
            print(f"  Row {row_i}: unexpected pdf type {type(pdf_bytes)}, skipping")
            continue
        print(f"  Extracted {len(text)} chars from {pages} pages")

        if len(text) < 100:
            print(f"  Row {row_i}: too little text, skipping")
            continue

        sections = parse_act_sections(text, ds_config["act_name"])
        print(f"  Parsed {len(sections)} sections")

        for sec in sections:
            records.append({
                "_id": f"{ds_config['id_prefix']}_{chunk_idx}",
                "text": sec["text"],
                "source": "legal-kb",
                "act_name": sec["act_name"],
                "section": sec["section"],
                "section_title": sec.get("section_title", ""),
                "chapter": sec.get("chapter", ""),
            })
            chunk_idx += 1

    if not records:
        print("  SKIP: No records extracted from pdf column")
        return 0

    print(f"  Upserting {len(records)} records...")
    count = pinecone_service.upsert_records(records)
    print(f"  Done: {count} records")
    return count


def ingest_generic(ds_config: dict) -> int:
    """Attempt generic ingestion — inspect columns and adapt."""
    print(f"  Loading {ds_config['name']}...")
    try:
        ds = load_dataset(ds_config["name"], split="train")
    except Exception as e:
        print(f"  SKIP: Failed to load dataset: {e}")
        return 0

    print(f"  Columns: {ds.column_names}")
    print(f"  Rows: {len(ds)}")

    # Handle PDF column — extract text and parse sections
    if "pdf" in ds.column_names:
        return _ingest_pdf_column(ds, ds_config)

    # Try common text column names
    text_col = None
    for col in ["text", "content", "section_text", "passage", "answer", "document"]:
        if col in ds.column_names:
            text_col = col
            break

    if not text_col:
        print(f"  SKIP: No recognized text column. Columns: {ds.column_names}")
        return 0

    records = []
    for i, row in enumerate(ds):
        text = row.get(text_col, "")
        if not text or len(text) < 50:
            continue

        # Truncate to ~2000 chars to stay within embedding limit
        if len(text) > 2000:
            text = text[:2000]

        records.append({
            "_id": f"{ds_config['id_prefix']}_{i}",
            "text": text,
            "source": "legal-kb",
            "act_name": ds_config["act_name"],
            "section": row.get("section", row.get("title", "")),
            "section_title": "",
            "chapter": row.get("chapter", ""),
        })

    if not records:
        print("  SKIP: No valid records extracted")
        return 0

    print(f"  Upserting {len(records)} records...")
    count = pinecone_service.upsert_records(records)
    print(f"  Done: {count} records")
    return count


def main():
    parser = argparse.ArgumentParser(description="Ingest HuggingFace datasets into Pinecone")
    parser.add_argument("--dataset", type=str, help="Dataset key (constitution, ipc)")
    args = parser.parse_args()

    if args.dataset:
        key = args.dataset.lower()
        if key not in DATASETS:
            print(f"Unknown dataset: {key}. Available: {', '.join(DATASETS.keys())}")
            sys.exit(1)
        targets = {key: DATASETS[key]}
    else:
        targets = DATASETS

    total = 0
    for key, config in targets.items():
        print(f"\n{'='*60}")
        print(f"Processing: {config['act_name']} ({config['name']})")
        print(f"{'='*60}")

        if key == "constitution":
            count = ingest_constitution_qa(config)
        else:
            count = ingest_generic(config)
        total += count

    print(f"\n{'='*60}")
    print(f"TOTAL: {total} records ingested from HuggingFace")
    stats = pinecone_service.get_stats()
    print(f"Index stats: {stats}")


if __name__ == "__main__":
    main()
