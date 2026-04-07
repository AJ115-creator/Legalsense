import { useRef, useCallback } from 'react'
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

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  children,
  ...props
}) {
  const ref = useRef()

  const handleEnter = useCallback(() => {
    if (disabled) return
    gsap.to(ref.current, { scale: 1.02, y: -2, duration: 0.2, ease: 'back.out(1.5)' })
  }, [disabled])

  const handleLeave = useCallback(() => {
    gsap.to(ref.current, { scale: 1, y: 0, duration: 0.15, ease: 'power2.out' })
  }, [])

  return (
    <button
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-sans font-medium
        transition-shadow duration-150 ease-out
        hover:shadow-md
        active:shadow-sm
        disabled:opacity-50 disabled:pointer-events-none
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
