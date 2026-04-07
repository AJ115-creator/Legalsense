import json
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from app.core.config import settings

llm = ChatGroq(
    model=settings.GROQ_MODEL,
    api_key=settings.GROQ_API_KEY,
    temperature=0.1,
)

ANALYSIS_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "You are an expert Indian legal document analyst. "
        "Analyze the document and return ONLY valid JSON (no markdown fencing) with this exact structure:\n"
        '{{\n'
        '  "title": "document title inferred from content",\n'
        '  "type": "document type (FIR, Bail Application, Rental Agreement, Court Order, Legal Notice, Contract, etc.)",\n'
        '  "summary": "multi-paragraph summary separated by \\n\\n. Be thorough — cover key facts, parties, dates, and legal implications.",\n'
        '  "lawReferences": [\n'
        '    {{"section": "Section X of Act", "description": "what this section covers", "type": "primary|related|procedural"}}\n'
        '  ],\n'
        '  "suggestions": ["actionable suggestion 1", "suggestion 2", ...]\n'
        '}}\n'
        "Include at least 3-5 law references and 4-6 suggestions. "
        "Focus on Indian law (BNS, BNSS, CPC, specific Acts). "
        "Return ONLY the JSON.",
    ),
    ("human", "Analyze this legal document:\n\n{text}"),
])


async def analyze_document(text: str, pages: int, upload_date: str) -> dict:
    """Run AI analysis on document text. Returns dict matching DocumentAnalysis schema."""
    chain = ANALYSIS_PROMPT | llm
    response = await chain.ainvoke({"text": text[:15000]})
    result = json.loads(response.content)
    result["pages"] = pages
    result["date"] = upload_date
    return result
