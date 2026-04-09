import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { apiFetch } from '../services/api'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import AuroraGradient from '../components/ui/AuroraGradient'
import { DocumentIcon, ChevronRightIcon, Spinner } from '../components/ui/icons'

const DocumentCard = ({ doc }) => (
  <Link to={`/results/${doc.id}`}>
    <Card glass clickable className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
        <Badge variant={
          doc.status === 'analyzed' ? 'success' :
          doc.status === 'error'    ? 'destructive' :
                                      'warning'
        }>
          {doc.status === 'analyzed' ? 'Analyzed' :
           doc.status === 'error'    ? 'Failed' :
                                       'Pending'}
        </Badge>
        <ChevronRightIcon size={16} />
      </div>
    </Card>
  </Link>
)

const EmptyState = () => (
  <div className="text-center py-20">
    <div className="mx-auto w-16 h-16 text-muted-foreground/50 mb-4">
      <DocumentIcon size={64} />
    </div>
    <h3 className="font-serif text-xl font-semibold mb-2">No documents yet</h3>
    <p className="text-muted-foreground mb-6">Upload your first legal document to get started.</p>
    <Link to="/upload"><Button>Upload Document</Button></Link>
  </div>
)

const Dashboard = () => {
  const { getToken } = useAuth()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiFetch('/documents/', {}, getToken)
      .then(setDocuments)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [getToken])

  return (
    <div className="py-16 px-4 relative overflow-hidden">
      <AuroraGradient blobs={[{ pos: 'top-1/3 left-1/4', size: 'w-80 h-80', color: 'bg-primary/8' }]} />
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-[-0.03em]">Your Documents</h1>
            <p className="text-muted-foreground mt-1">All your uploaded legal documents in one place.</p>
          </div>
          <Link to="/upload"><Button>Upload New</Button></Link>
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
          <div className="grid gap-4">
            {documents.map(doc => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
