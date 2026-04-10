from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from app.core.auth import get_current_user
from app.core.config import settings
from app.core.rate_limiter import limiter

router = APIRouter()

llm = ChatGroq(
    model=settings.GROQ_MODEL,
    api_key=settings.GROQ_API_KEY,
    temperature=0.1,
)

TRANSLATE_PROMPT = (
    "You are a professional legal translator. Translate the following text from its "
    "original language to clear, natural English. This is a legal document so:\n"
    "- Preserve legal terminology accurately\n"
    "- Keep proper nouns (names, places) as-is\n"
    "- Maintain the structure and paragraph breaks\n"
    "- Make the translation readable and understandable, not just word-for-word\n"
    "- Keep legal citations (Act names, Section numbers) in their standard English form\n"
    "- Output ONLY the translated text, no explanations or notes"
)


SUPPORTED_LANGUAGES = {"Hindi"}

class TranslateRequest(BaseModel):
    text: str
    target_lang: str = "English"


@router.post("/")
@limiter.limit("10/minute")
async def translate_text(
    request: Request,
    body: TranslateRequest,
    user_id: str = Depends(get_current_user),
):
    if body.target_lang not in SUPPORTED_LANGUAGES and body.target_lang != "English":
        return {"error": f"Unsupported language: {body.target_lang}"}

    prompt = TRANSLATE_PROMPT.replace(
        "to clear, natural English",
        f"to clear, natural {body.target_lang}",
    )
    messages = [
        SystemMessage(content=prompt),
        HumanMessage(content=body.text),
    ]
    response = await llm.ainvoke(messages)
    return {"translated": response.content}
