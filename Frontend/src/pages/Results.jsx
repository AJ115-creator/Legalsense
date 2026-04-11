import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { apiFetch } from '../services/api'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Tabs from '../components/ui/Tabs'
import AuroraGradient from '../components/ui/AuroraGradient'
import { ChevronLeftIcon, Spinner } from '../components/ui/icons'
import SummaryTab from '../components/results/SummaryTab'
import LawReferencesTab from '../components/results/LawReferencesTab'
import SuggestionsTab from '../components/results/SuggestionsTab'

const DocumentHeader = ({ data }) => (
  <div className="mb-8">
    <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 mb-4 inline-flex items-center gap-1">
      <ChevronLeftIcon /> Back to Dashboard
    </Link>
    <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-[-0.03em] mt-2">{data.title}</h1>
    <div className="flex flex-wrap gap-2 mt-3">
      <Badge>{data.type}</Badge>
      <Badge variant="muted">{data.pages} pages</Badge>
      <Badge variant="muted">{data.date}</Badge>
    </div>
  </div>
)

const Results = () => {
  const { id } = useParams()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const skeletonRef = useRef(null)
  const ctaBtnRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let timer = null

    const poll = async () => {
      try {
        const result = await apiFetch(`/documents/${id}`, {}, getToken)
        if (cancelled) return

        if (result.status === 'pending') {
          setPending(true)
          setLoading(false)
          timer = setTimeout(poll, 3000)
        } else if (result.status === 'error') {
          setError(result.message || 'Analysis failed')
          setPending(false)
          setLoading(false)
        } else {
          setData(result)
          setPending(false)
          setLoading(false)
        }
      } catch (e) {
        if (cancelled) return
        setError(e.message)
        setLoading(false)
      }
    }

    poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [id, getToken])

  useGSAP(() => {
    if (!skeletonRef.current) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to(skeletonRef.current, {
        opacity: 0.4,
        duration: 0.8,
        yoyo: true,
        repeat: -1,
        ease: 'power1.inOut',
      })
    })
  }, { scope: skeletonRef })

  useEffect(() => {
    if (!data || !ctaBtnRef.current) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(ctaBtnRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.45, delay: 0.2, ease: 'power2.out' }
      )
    })
  }, [data])

  const handleDeleteAndRetry = async () => {
    setDeleting(true)
    try {
      await apiFetch(`/documents/${id}`, { method: 'DELETE' }, getToken)
      navigate('/upload')
    } catch (e) {
      setError(e.message || 'Delete failed')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (pending) {
    return (
      <div className="py-20 text-center">
        <div ref={skeletonRef} className="w-16 h-16 rounded-full bg-muted mx-auto mb-4" />
        <h2 className="font-serif text-2xl font-bold mb-2">Analyzing Your Document</h2>
        <p className="text-muted-foreground">Our AI is reading and analyzing your legal document. This usually takes 15-30 seconds.</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-serif text-2xl font-bold mb-4">Analysis Failed</h2>
        <p className="text-muted-foreground mb-6">{error || "We couldn't load analysis results for this document."}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/dashboard"><Button variant="secondary">Back to Dashboard</Button></Link>
          <Button onClick={handleDeleteAndRetry} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete and try again'}
          </Button>
        </div>
      </div>
    )
  }

  const tabs = [
    { label: 'Summary', content: <SummaryTab summary={data.summary} /> },
    { label: 'Law References', content: <LawReferencesTab references={data.lawReferences} /> },
    { label: 'Suggestions', content: <SuggestionsTab suggestions={data.suggestions} /> },
  ]

  return (
    <div className="py-16 px-4 relative overflow-hidden">
      <AuroraGradient blobs={[{ pos: 'top-1/4 right-1/3', size: 'w-72 h-72', color: 'bg-primary/8' }]} />
      <div className="max-w-3xl mx-auto">
        <DocumentHeader data={data} />
        <Tabs tabs={tabs} />

        <div ref={ctaBtnRef} className="mt-10 text-center opacity-0">
          <Link to={`/chat/${id}`}>
            <Button size="lg">
              <span className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Discuss with AI Assistant
              </span>
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-2">Ask questions about this document and get instant answers.</p>
        </div>
      </div>
    </div>
  )
}

export default Results