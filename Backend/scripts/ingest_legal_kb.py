"""Ingest Indian legal PDFs into Pinecone legal-kb.

Usage (from Backend/):
    python -m scripts.ingest_legal_kb
    python -m scripts.ingest_legal_kb --act BNS  # single act
"""

import argparse
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.pdf_extractor import extract_text
from app.services.legal_parser import parse_act_sections
from app.services import pinecone_service

LEGAL_DOCS = {
    "BNS": ("BNS_2023.pdf", "Bharatiya Nyaya Sanhita 2023"),
    "BNSS": ("BNSS_2023.pdf", "Bharatiya Nagarik Suraksha Sanhita 2023"),
    "BSA": ("BSA_2023.pdf", "Bharatiya Sakshya Adhiniyam 2023"),
    "COI": ("COI.pdf", "Constitution of India"),
    "ICA": ("ICA_1872.pdf", "Indian Contract Act 1872"),
    "CPC": ("Code-of-civil-procedure.pdf", "Code of Civil Procedure"),
}

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _make_id(act_key: str, index: int) -> str:
    """Deterministic ID for legal KB records: legal_bns_42"""
    return f"legal_{act_key.lower()}_{index}"


def ingest_act(act_key: str, filename: str, act_name: str) -> int:
    """Ingest a single legal act PDF."""
    filepath = DATA_DIR / filename
    if not filepath.exists():
        print(f"  SKIP: {filepath} not found")
        return 0

    print(f"  Reading {filename}...")
    pdf_bytes = filepath.read_bytes()
    text, pages = extract_text(pdf_bytes)
    print(f"  Extracted {len(text)} chars from {pages} pages")

    if len(text) < 100:
        print("  SKIP: Too little text extracted (likely scanned PDF)")
        return 0

    print("  Parsing sections...")
    sections = parse_act_sections(text, act_name)
    print(f"  Found {len(sections)} chunks")

    # Build Pinecone records
    records = []
    for i, sec in enumerate(sections):
        records.append({
            "_id": _make_id(act_key, i),
            "text": sec["text"],  # field_map: auto-embedded
            "source": "legal-kb",
            "act_name": sec["act_name"],
            "section": sec["section"],
            "section_title": sec.get("section_title", ""),
            "chapter": sec.get("chapter", ""),
        })

    print(f"  Upserting {len(records)} records...")
    count = pinecone_service.upsert_records(records)
    print(f"  Done: {count} records upserted for {act_name}")
    return count


def main():
    parser = argparse.ArgumentParser(description="Ingest legal PDFs into Pinecone")
    parser.add_argument("--act", type=str, help="Single act key (BNS, BNSS, BSA, COI, ICA, CPC)")
    args = parser.parse_args()

    if args.act:
        if args.act.upper() not in LEGAL_DOCS:
            print(f"Unknown act: {args.act}. Available: {', '.join(LEGAL_DOCS.keys())}")
            sys.exit(1)
        acts = {args.act.upper(): LEGAL_DOCS[args.act.upper()]}
    else:
        acts = LEGAL_DOCS

    total = 0
    for act_key, (filename, act_name) in acts.items():
        print(f"\n{'='*60}")
        print(f"Processing: {act_name} ({act_key})")
        print(f"{'='*60}")
        count = ingest_act(act_key, filename, act_name)
        total += count

    print(f"\n{'='*60}")
    print(f"TOTAL: {total} records ingested")
    stats = pinecone_service.get_stats()
    print(f"Index stats: {stats}")


if __name__ == "__main__":
    main()
