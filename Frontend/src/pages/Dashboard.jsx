import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { toast } from 'sonner'
import { apiFetch } from '../services/api'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import AuroraGradient from '../components/ui/AuroraGradient'
import { DocumentIcon, ChevronRightIcon, TrashIcon, Spinner } from '../components/ui/icons'

const DeleteModal = ({ docTitle, onConfirm, onCancel, deleting }) => {
  const backdropRef = useRef(null)
  const dialogRef = useRef(null)

  useGSAP(() => {
    if (!backdropRef.current || !dialogRef.current) return
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 })
    gsap.fromTo(dialogRef.current, { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(1.2)' })
  }, { scope: { backdrop: backdropRef, dialog: dialogRef } })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div ref={backdropRef} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div ref={dialogRef} className="relative bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <h3 className="font-serif text-lg font-semibold mb-2">Delete Document</h3>
        <p className="text-sm text-muted-foreground mb-1">
          Are you sure you want to delete <strong className="text-foreground">{docTitle}</strong>?
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          This will permanently remove the document, its analysis, chat history, and all associated data. This action cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={deleting}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            className="!bg-destructive !text-destructive-foreground hover:!brightness-110"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}

const DocumentCard = ({ doc, onDelete }) => {
  const cardRef = useRef(null)

  const handleMouseEnter = useCallback(() => {
    if (!cardRef.current) return
    gsap.to(cardRef.current, {
      y: -4,
      scale: 1.02,
      boxShadow: '0 8px 24px var(--border)',
      duration: 0.2,
      ease: 'power2.out',
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (!cardRef.current) return
    gsap.to(cardRef.current, {
      y: 0,
      scale: 1,
      boxShadow: 'var(--shadow)',
      duration: 0.2,
      ease: 'power2.out',
    })
  }, [])

  const handleDeleteClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete(doc)
  }

  return (
    <Card
      to={`/results/${doc.id}`}
      ref={cardRef}
      glass
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 stagger-item"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <DocumentIcon size={20} />
        </div>
        <div>
          <h3 className="font-medium text-foreground">{doc.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{doc.pages} pages &middot; {doc.date}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={doc.status === 'analyzed' ? 'success' : doc.status === 'error' ? 'destructive' : 'warning'}>
          {doc.status === 'analyzed' ? 'Analyzed' : doc.status === 'error' ? 'Failed' : 'Pending'}
        </Badge>
        <button
          onClick={handleDeleteClick}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 relative z-10"
          aria-label={`Delete ${doc.title}`}
          title="Delete document"
        >
          <TrashIcon size={16} />
        </button>
        <ChevronRightIcon size={16} />
      </div>
    </Card>
  )
}

const EmptyState = () => (
  <div className="text-center py-20">
    <div className="mx-auto w-16 h-16 text-muted-foreground/50 mb-4">
      <DocumentIcon size={64} />
    </div>
    <h3 className="font-serif text-xl font-semibold mb-2">No documents yet</h3>
    <p className="text-muted-foreground mb-6">Upload your first legal document to get started.</p>
    <Button to="/upload">Upload Document</Button>
  </div>
)

const Dashboard = () => {
  const { getToken } = useAuth()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const gridRef = useRef(null)

  useEffect(() => {
    apiFetch('/documents/', {}, getToken)
      .then(setDocuments)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [getToken])

  useGSAP(() => {
    if (!gridRef.current) return
    const children = gridRef.current.querySelectorAll('.stagger-item')
    if (children.length === 0) return

    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from(gridRef.current, {
        y: 20,
        opacity: 0,
        duration: 0.4,
        ease: 'power2.out',
      })
      gsap.from(children, {
        y: 30,
        opacity: 0,
        duration: 0.5,
        stagger: 0.15,
        ease: 'power2.out',
      })
    })
  }, { scope: gridRef })

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const docId = deleteTarget.id
    const docTitle = deleteTarget.title

    setDocuments(prev => prev.filter(d => d.id !== docId))
    setDeleteTarget(null)

    try {
      await apiFetch(`/documents/${docId}`, { method: 'DELETE' }, getToken)
      toast.success(`"${docTitle}" deleted successfully`)
    } catch {
      toast.error(`Failed to delete "${docTitle}"`)
      try {
        const fresh = await apiFetch('/documents/', {}, getToken)
        setDocuments(fresh)
      } catch { /* best effort */ }
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, getToken])

  return (
    <div className="py-16 px-4 relative overflow-hidden">
      <AuroraGradient blobs={[{ pos: 'top-1/3 left-1/4', size: 'w-80 h-80', color: 'bg-primary/8' }]} />
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-[-0.03em]">Your Documents</h1>
            <p className="text-muted-foreground mt-1">All your uploaded legal documents in one place.</p>
          </div>
          <Button to="/upload">Upload New</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        ) : documents.length === 0 ? (
          <EmptyState />
        ) : (
          <div ref={gridRef} className="grid gap-4">
            {documents.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteModal
          docTitle={deleteTarget.title}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  )
}

export default Dashboard