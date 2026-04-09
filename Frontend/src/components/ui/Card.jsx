import { useRef, useCallback, forwardRef } from 'react'
import gsap from 'gsap'

const Card = forwardRef(function Card(
  { glass = false, clickable = false, className = '', children, ...props },
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

  const handleEnter = useCallback(() => {
    if (!clickable) return
    gsap.to(internalRef.current, { y: -4, duration: 0.25, ease: 'power2.out' })
  }, [clickable])

  const handleLeave = useCallback(() => {
    if (!clickable) return
    gsap.to(internalRef.current, { y: 0, duration: 0.2, ease: 'power2.out' })
  }, [clickable])

  return (
    <div
      ref={setRefs}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`rounded-xl shadow-sm text-card-foreground p-6 ${base} ${clickable ? 'cursor-pointer transition-shadow duration-150 ease-out hover:shadow-lg' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
})

export default Card
