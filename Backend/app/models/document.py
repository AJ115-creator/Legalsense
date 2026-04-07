from pydantic import BaseModel


class LawReference(BaseModel):
    section: str
    description: str
    type: str  # primary | related | procedural


class DocumentListItem(BaseModel):
    """Matches frontend dashboard card shape."""
    id: str
    title: str
    type: str
    date: str
    status: str  # pending | analyzed
    pages: int


class DocumentAnalysis(BaseModel):
    """Matches frontend results page shape."""
    title: str
    type: str
    date: str
    pages: int
    summary: str
    lawReferences: list[LawReference]
    suggestions: list[str]


class UploadResponse(BaseModel):
    id: str
    status: str
    message: str
