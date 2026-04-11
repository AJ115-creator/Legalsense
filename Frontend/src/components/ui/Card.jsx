import { useRef, useCallback, forwardRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'

const Card = forwardRef(function Card(
  { glass = false, clickable = false, className = '', to, href, children, ...props },
  forwardedRef,
) {
  const internalRef = useRef()

  // Merge forwarded ref + internal ref so both GSAP hover and external scroll work
  const setRefs = useCallback(
    (node) => {
      internalRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef],
  )

  const base = glass
    ? 'backdrop-blur-xl bg-card/60 dark:bg-card/40 border border-white/20 dark:border-white/5 ring-1 ring-white/10'
    : 'bg-card border border-border'

  const isInteractive = clickable || to || href

  const handleEnter = useCallback(() => {
    if (!isInteractive) return
    gsap.to(internalRef.current, { y: -4, duration: 0.25, ease: 'power2.out' })
  }, [isInteractive])

  const handleLeave = useCallback(() => {
    if (!isInteractive) return
    gsap.to(internalRef.current, { y: 0, duration: 0.2, ease: 'power2.out' })
  }, [isInteractive])

  const classes = `rounded-xl shadow-sm text-card-foreground p-6 ${base} ${isInteractive ? 'cursor-pointer transition-shadow duration-150 ease-out hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none block' : ''} ${className}`.replace(/\s+/g, ' ').trim()

  if (to) {
    return (
      <Link to={to} ref={setRefs} onMouseEnter={handleEnter} onMouseLeave={handleLeave} className={classes} {...props}>
        {children}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} ref={setRefs} onMouseEnter={handleEnter} onMouseLeave={handleLeave} className={classes} {...props}>
        {children}
      </a>
    )
  }

  return (
    <div
      ref={setRefs}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={classes}
      {...props}
    >
      {children}
    </div>
  )
})

export default Card
