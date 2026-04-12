import json
import logging
import sentry_sdk
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.auth import _verify_token
from app.core.ws_rate_limit import check_ws_rate_limit
from app.services.chat_service import stream_chat_response, get_chat_history

logger = logging.getLogger(__name__)

router = APIRouter()


async def _safe_send_and_close(
    websocket: WebSocket, payload: dict, code: int = 4001
) -> None:
    """Best-effort error send + close. Swallow errors — socket may already be dead."""
    try:
        await websocket.send_json(payload)
    except Exception:
        pass
    try:
        await websocket.close(code=code)
    except Exception:
        pass


async def _authenticate_ws(websocket: WebSocket) -> str | None:
    """Authenticate WebSocket via first-frame token (not URL query param)."""
    await websocket.accept()
    try:
        raw = await websocket.receive_text()
    except WebSocketDisconnect:
        return None
    except Exception:
        await _safe_send_and_close(
            websocket, {"type": "auth_error", "detail": "Invalid auth frame"}
        )
        return None

    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        await _safe_send_and_close(
            websocket, {"type": "auth_error", "detail": "Malformed auth frame"}
        )
        return None

    if msg.get("type") != "auth" or not msg.get("token"):
        await _safe_send_and_close(
            websocket, {"type": "auth_error", "detail": "Missing auth frame"}
        )
        return None

    try:
        user_id = await _verify_token(msg["token"])
    except Exception:
        await _safe_send_and_close(
            websocket, {"type": "auth_error", "detail": "Invalid token"}
        )
        return None

    try:
        await websocket.send_json({"type": "auth_ok"})
    except Exception:
        return None
    return user_id


@router.websocket("/{document_id}")
async def chat_websocket(websocket: WebSocket, document_id: str):
    user_id = await _authenticate_ws(websocket)
    if not user_id:
        return

    # Send existing chat history
    history = await get_chat_history(document_id, user_id)
    await websocket.send_json({"type": "history", "messages": history})

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            user_message = msg.get("content", "")

            if not user_message.strip():
                continue

            # WebSocket rate limiting
            if not await check_ws_rate_limit(user_id, document_id):
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": "Rate limit exceeded. Please wait before sending more messages.",
                    }
                )
                continue

            await websocket.send_json({"type": "stream_start"})

            trace_id, token_stream = await stream_chat_response(
                document_id, user_id, user_message
            )

            async for token in token_stream:
                if isinstance(token, dict) and token.get("__trace_id__"):
                    trace_id = token["__trace_id__"]
                else:
                    await websocket.send_json({"type": "token", "content": token})

            await websocket.send_json({"type": "stream_end", "trace_id": trace_id})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception(f"WebSocket error for doc {document_id}: {e}")
        sentry_sdk.capture_exception(e)
        try:
            await websocket.send_json({"type": "error", "detail": str(e)})
            await websocket.close(code=1011)
        except Exception:
            pass
