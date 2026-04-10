import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { LangfuseClient } from '@langfuse/client'
import { createChatSocket } from '../services/api'
import Card from '../components/ui/Card'
import AuroraGradient from '../components/ui/AuroraGradient'
import { ChevronLeftIcon, Spinner } from '../components/ui/icons'

const langfuse = new LangfuseClient({
  publicKey: import.meta.env.VITE_LANGFUSE_PUBLIC_KEY,
  baseUrl: import.meta.env.VITE_LANGFUSE_BASE_URL,
})

const ThumbUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 1 1-2.5 0v-7.5ZM6 7.082V16.5a1.5 1.5 0 0 0 1.235 1.476 5.75 5.75 0 0 0 3.453-.196l.174-.082a5.75 5.75 0 0 0 2.576-2.576l2.348-4.696A1.25 1.25 0 0 0 14.668 9H11.5a.75.75 0 0 1-.75-.75c0-1.034.212-2.236.58-3.184.204-.527.455-.994.756-1.373.155-.195.287-.332.386-.42A1.25 1.25 0 0 0 11.5 1.5a2.75 2.75 0 0 0-2.75 2.75c0 .573-.109 1.182-.326 1.77A4.952 4.952 0 0 1 7.5 7.5H6.082Z" />
  </svg>
)

const ThumbDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path d="M19 11.75a1.25 1.25 0 1 1-2.5 0v-7.5a1.25 1.25 0 1 1 2.5 0v7.5ZM14 12.918V3.5a1.5 1.5 0 0 0-1.235-1.476 5.75 5.75 0 0 0-3.453.196l-.174.082a5.75 5.75 0 0 0-2.576 2.576l-2.348 4.696A1.25 1.25 0 0 0 5.332 11H8.5a.75.75 0 0 1 .75.75c0 1.034-.212 2.236-.58 3.184-.204.527-.455.994-.756 1.373a3.528 3.528 0 0 1-.386.42A1.25 1.25 0 0 0 8.5 18.5a2.75 2.75 0 0 0 2.75-2.75c0-.573.109-1.182.326-1.77A4.952 4.952 0 0 1 12.5 12.5h1.418Z" />
  </svg>
)

const ChatBubble = ({ message }) => {
  const isUser = message.role === 'user'
  const parts = message.content.split('\n\n---\n')
  const mainContent = parts[0]
  const disclaimer = parts.length > 1 ? parts.slice(1).join('\n\n---\n') : null
  const [feedback, setFeedback] = useState(null)

  const handleFeedback = async (score) => {
    if (feedback !== null) return
    setFeedback(score)
    try {
      langfuse.score.create({
        traceId: message.traceId,
        name: 'user-feedback',
        value: Number(score),
        dataType: 'BOOLEAN',
      })
      await langfuse.flush()
    } catch (err) {
      console.error('Feedback failed:', err)
    }
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[80%]">
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-md'
              : 'bg-muted text-foreground rounded-bl-md'
          }`}
        >
          {mainContent}
          {disclaimer && (
            <>
              <hr className="my-2 border-current opacity-20" />
              <p className="font-bold text-xs mt-1">{disclaimer.trim()}</p>
            </>
          )}
        </div>
        {!isUser && message.traceId && (
          <div className="flex items-center gap-1 mt-1 ml-1">
            {feedback !== null ? (
              <span className="text-xs text-muted-foreground">Thanks!</span>
            ) : (
              <>
                <button
                  onClick={() => handleFeedback(1)}
                  className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                  aria-label="Thumbs up"
                >
                  <ThumbUpIcon />
                </button>
                <button
                  onClick={() => handleFeedback(0)}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                  aria-label="Thumbs down"
                >
                  <ThumbDownIcon />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const Chat = () => {
  const { id } = useParams()
  const { getToken } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const streamBufferRef = useRef('')
  const chatContainerRef = useRef(null)
  const lastUserMsgRef = useRef(null)
  const shouldAutoScrollRef = useRef(true)

  // Check if user is near the bottom of the chat container
  const isNearBottom = () => {
    const el = chatContainerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150
  }

  // When user sends a message, scroll their message into view
  useEffect(() => {
    if (lastUserMsgRef.current) {
      lastUserMsgRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages.length]) // only on new message count changes

  // During streaming tokens, only auto-scroll if user is already near bottom
  useEffect(() => {
    if (streaming && shouldAutoScrollRef.current) {
      const el = chatContainerRef.current
      if (el) {
        el.scrollTop = el.scrollHeight
      }
    }
  }, [messages, streaming])

  useEffect(() => {
    let ws
    let closed = false
    let retries = 0
    let retryTimer = null
    const MAX_RETRIES = 5

    const connect = async () => {
      if (closed) return
      try {
        const token = await getToken()
        ws = createChatSocket(id)
        wsRef.current = ws

        ws.onopen = () => {
          // Send token as first frame (not in URL)
          ws.send(JSON.stringify({ type: 'auth', token }))
        }

        ws.onclose = () => {
          if (closed) return
          setConnected(false)
          // Auto-reconnect with exponential backoff
          if (retries < MAX_RETRIES) {
            const delay = Math.min(1000 * Math.pow(2, retries), 16000)
            retryTimer = setTimeout(() => { retries++; connect() }, delay)
          }
        }

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)
          switch (data.type) {
            case 'auth_ok':
              if (!closed) { setConnected(true); retries = 0 }
              break
            case 'auth_error':
              ws.close()
              break
            case 'history':
              setMessages(data.messages.map(m => ({ role: m.role, content: m.content })))
              break
            case 'stream_start':
              setStreaming(true)
              streamBufferRef.current = ''
              shouldAutoScrollRef.current = isNearBottom()
              setMessages(prev => [...prev, { role: 'assistant', content: '' }])
              break
            case 'token':
              streamBufferRef.current += data.content
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: streamBufferRef.current,
                }
                return updated
              })
              break
            case 'stream_end':
              setStreaming(false)
              if (data.trace_id) {
                setMessages(prev => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = { ...last, traceId: data.trace_id }
                  }
                  return updated
                })
              }
              break
            case 'error':
              setStreaming(false)
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.detail || 'An error occurred.',
              }])
              break
          }
        }
      } catch {
        if (!closed && retries < MAX_RETRIES) {
          retryTimer = setTimeout(() => { retries++; connect() }, 2000)
        }
      }
    }

    connect()
    return () => {
      closed = true
      if (retryTimer) clearTimeout(retryTimer)
      ws?.close()
    }
  }, [id, getToken])

  const sendMessage = (e) => {
    e.preventDefault()
    if (!input.trim() || streaming || !connected) return
    const content = input.trim()
    setMessages(prev => [...prev, { role: 'user', content }])
    wsRef.current?.send(JSON.stringify({ content }))
    setInput('')
  }

  return (
    <div className="py-8 px-4 relative overflow-hidden h-[calc(100vh-4rem)] flex flex-col">
      <AuroraGradient blobs={[{ pos: 'top-1/4 left-1/3', size: 'w-64 h-64', color: 'bg-primary/5' }]} />
      <div className="max-w-5xl mx-auto w-full flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            to={`/results/${id}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 inline-flex items-center gap-1"
          >
            <ChevronLeftIcon /> Back to Analysis
          </Link>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-muted-foreground">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        {/* Messages */}
        <Card glass className="flex-1 min-h-0 overflow-y-auto p-4 mb-4" ref={chatContainerRef}>
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Ask a question about your document to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => {
                const isLastUser = msg.role === 'user' && !messages.slice(i + 1).some(m => m.role === 'user')
                return (
                  <div key={i} ref={isLastUser ? lastUserMsgRef : null}>
                    <ChatBubble message={msg} />
                  </div>
                )
              })}
              {streaming && (
                <div className="flex justify-start">
                  <Spinner className="w-4 h-4" />
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Input */}
        <form onSubmit={sendMessage} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={connected ? 'Ask about your document...' : 'Connecting...'}
            disabled={!connected || streaming}
            className="flex-1 rounded-xl border border-border bg-card/60 backdrop-blur-sm px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming || !connected}
            className="rounded-xl bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

export default Chat
