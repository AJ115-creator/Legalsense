import { Link, useLocation } from 'react-router-dom'

const navLinkBase = 'px-3 py-2 text-sm font-medium rounded-lg transition-[background-color,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const NavLink = ({ to, label, block = false, onClick }) => {
  const { pathname } = useLocation()
  const isActive = pathname === to

  const activeClass = 'text-foreground bg-muted/50'
  const inactiveClass = 'text-muted-foreground hover:text-foreground hover:bg-muted/30'

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`${block ? 'block' : ''} ${navLinkBase} ${isActive ? activeClass : inactiveClass}`}
    >
      {label}
    </Link>
  )
}

export default NavLink
