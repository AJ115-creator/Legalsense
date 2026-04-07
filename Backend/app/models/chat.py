from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str  # user | assistant
    content: str


class ChatHistory(BaseModel):
    document_id: str
    messages: list[ChatMessage]
