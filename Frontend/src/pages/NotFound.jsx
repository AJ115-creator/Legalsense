import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-serif text-6xl font-bold text-primary/30 mb-4">404</h1>
        <h2 className="font-serif text-2xl font-bold mb-2">Page Not Found</h2>
        <p className="text-muted-foreground mb-8">The page you're looking for doesn't exist.</p>
        <Link to="/"><Button>Go Home</Button></Link>
      </div>
    </div>
  )
}
