import { useRef, useCallback, forwardRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'

const variants = {
  primary: 'bg-primary text-primary-foreground hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  secondary: 'bg-secondary text-secondary-foreground hover:brightness-110 active:brightness-95 focus-visible:ring-2 focus-visible:ring-ring',
  ghost: 'bg-transparent text-foreground hover:bg-muted/50 active:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
  outline: 'bg-transparent text-foreground border border-border hover:bg-muted/30 active:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-7 py-3.5 text-lg',
}

const Button = forwardRef(function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  to,
  href,
  children,
  ...props
}, forwardedRef) {
  const internalRef = useRef()

  const setRefs = useCallback(
    (node) => {
      internalRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef],
  )

  const handleEnter = useCallback(() => {
    if (disabled) return
    gsap.to(internalRef.current, { scale: 1.02, y: -2, duration: 0.2, ease: 'back.out(1.5)' })
  }, [disabled])

  const handleLeave = useCallback(() => {
    gsap.to(internalRef.current, { scale: 1, y: 0, duration: 0.15, ease: 'power2.out' })
  }, [])

  const baseClasses = `
    inline-flex items-center justify-center gap-2 rounded-lg font-sans font-medium
    transition-shadow duration-150 ease-out inline-block
    hover:shadow-md
    active:shadow-sm
    ${disabled ? 'opacity-50 pointer-events-none' : ''}
    ${variants[variant]} ${sizes[size]} ${className}
  `.replace(/\s+/g, ' ').trim()

  if (to) {
    return (
      <Link
        to={to}
        ref={setRefs}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={baseClasses}
        {...props}
      >
        {children}
      </Link>
    )
  }

  if (href) {
    return (
      <a
        href={href}
        ref={setRefs}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={baseClasses}
        {...props}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      ref={setRefs}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={baseClasses}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
})

export default Button
