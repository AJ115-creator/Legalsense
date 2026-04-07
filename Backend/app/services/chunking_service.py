"""Document chunking service for user-uploaded PDFs.

Splits text into overlapping chunks for Pinecone upsert.
Uses RecursiveCharacterTextSplitter for semantic boundaries.
"""

from langchain_text_splitters import RecursiveCharacterTextSplitter

CHUNK_SIZE = 2000
CHUNK_OVERLAP = 400

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n\n", "\n\n", "\n", ". ", " ", ""],
    length_function=len,
)


def chunk_document(text: str) -> list[str]:
    """Split document text into overlapping chunks."""
    if not text or len(text) < 50:
        return []
    return _splitter.split_text(text)


def build_records(doc_id: str, user_id: str, chunks: list[str]) -> list[dict]:
    """Build Pinecone records from chunks with user-doc metadata.

    ID format: {doc_id}_{chunk_index} — enables prefix-based deletion.
    """
    return [
        {
            "_id": f"{doc_id}_{i}",
            "text": chunk,  # field_map: auto-embedded by Pinecone
            "source": "user-doc",
            "doc_id": doc_id,
            "user_id": user_id,
            "chunk_index": i,
        }
        for i, chunk in enumerate(chunks)
    ]
