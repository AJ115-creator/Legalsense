import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser, useClerk } from '@clerk/react'
import Logo from '../ui/Logo'
import ThemeToggle from '../ui/ThemeToggle'
import Button from '../ui/Button'
import NavLink from './NavLink'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/upload', label: 'Upload', auth: true },
  { to: '/dashboard', label: 'Dashboard', auth: true },
  { to: '/about', label: 'About' },
]

const HamburgerIcon = ({ open }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    {open ? (
      <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
    ) : (
      <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
    )}
  </svg>
)

const UserActions = ({ isSignedIn, user, onSignOut }) => {
  if (!isSignedIn) {
    return (
      <Link to="/sign-in" className="hidden md:block">
        <Button variant="primary" size="sm">Sign In</Button>
      </Link>
    )
  }

  return (
    <div className="hidden md:flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {user?.firstName || user?.emailAddresses?.[0]?.emailAddress}
      </span>
      <Button variant="ghost" size="sm" onClick={onSignOut}>Sign Out</Button>
    </div>
  )
}

const MobileMenu = ({ links, isSignedIn, onClose, onSignOut }) => (
  <div className="md:hidden pb-4 space-y-1">
    {links.map(link => (
      <NavLink key={link.to} {...link} block onClick={onClose} />
    ))}
    {isSignedIn ? (
      <button
        onClick={() => { onSignOut(); onClose() }}
        className="block w-full text-left px-3 py-2 text-sm font-medium text-muted-foreground rounded-lg hover:bg-muted/30"
      >
        Sign Out
      </button>
    ) : (
      <NavLink to="/sign-in" label="Sign In" block onClick={onClose} />
    )}
  </div>
)

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const { isSignedIn, user } = useUser()
  const { signOut } = useClerk()

  const visibleLinks = NAV_LINKS.filter(l => !l.auth || isSignedIn)

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-white/10 dark:border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="shrink-0">
            <Logo size="small" animate={false} />
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {visibleLinks.map(link => (
              <NavLink key={link.to} {...link} />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserActions isSignedIn={isSignedIn} user={user} onSignOut={signOut} />
            <button
              onClick={() => setMenuOpen(prev => !prev)}
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Toggle menu"
            >
              <HamburgerIcon open={menuOpen} />
            </button>
          </div>
        </div>

        {menuOpen && (
          <MobileMenu
            links={visibleLinks}
            isSignedIn={isSignedIn}
            onClose={() => setMenuOpen(false)}
            onSignOut={signOut}
          />
        )}
      </div>
    </nav>
  )
}

export default Navbar
