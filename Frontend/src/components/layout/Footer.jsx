import { Link } from 'react-router-dom'
import Logo from '../ui/Logo'

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card text-card-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div>
            <Logo size="small" animate={false} />
            <p className="mt-3 text-sm text-muted-foreground leading-[1.7] max-w-xs">
              Making Indian legal documents accessible and understandable for everyone.
            </p>
          </div>
          <div className="flex gap-12">
            <div>
              <h4 className="font-serif font-semibold text-sm mb-3">Product</h4>
              <ul className="space-y-2">
                <li><Link to="/upload" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">Upload</Link></li>
                <li><Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-serif font-semibold text-sm mb-3">Company</h4>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">About</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} LegalSense. Not a substitute for professional legal advice.
        </div>
      </div>
    </footer>
  )
}
