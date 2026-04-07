import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

export default function Logo({ size = 'default', animate = true, className = '' }) {
  const containerRef = useRef()
  const iconRef = useRef()
  const textRef = useRef()

  const sizes = {
    small: { icon: 28, text: 'text-lg' },
    default: { icon: 36, text: 'text-xl' },
    large: { icon: 56, text: 'text-3xl' },
  }

  const s = sizes[size] || sizes.default

  useGSAP(() => {
    if (!animate) return
    const paths = iconRef.current?.querySelectorAll('.logo-path')
    if (!paths?.length) return

    const tl = gsap.timeline()

    paths.forEach(path => {
      const length = path.getTotalLength()
      gsap.set(path, { strokeDasharray: length, strokeDashoffset: length })
    })
    gsap.set(textRef.current, { opacity: 0, x: -8 })

    tl.to(iconRef.current?.querySelectorAll('.logo-path'), {
      strokeDashoffset: 0,
      duration: 1.2,
      ease: 'power2.inOut',
      stagger: 0.15,
    })
    .to(textRef.current, {
      opacity: 1,
      x: 0,
      duration: 0.5,
      ease: 'power2.out',
    }, '-=0.4')
  }, { scope: containerRef })

  return (
    <div
      ref={containerRef}
      className={`flex items-center gap-2 group ${className}`}
    >
      <svg
        ref={iconRef}
        width={s.icon}
        height={s.icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform duration-150 group-hover:scale-[1.03]"
      >
        {/* Balance scale base */}
        <path
          className="logo-path"
          d="M24 6V42"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          className="logo-path"
          d="M16 42H32"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Balance beam */}
        <path
          className="logo-path"
          d="M8 16L24 10L40 16"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Left scale pan */}
        <path
          className="logo-path"
          d="M4 16C4 16 6 26 12 26C18 26 20 16 20 16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Right scale pan */}
        <path
          className="logo-path"
          d="M28 16C28 16 30 26 36 26C42 26 44 16 44 16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Digital accent dots */}
        <circle className="logo-path" cx="12" cy="20" r="1" fill="currentColor" stroke="currentColor" strokeWidth="0.5" />
        <circle className="logo-path" cx="36" cy="20" r="1" fill="currentColor" stroke="currentColor" strokeWidth="0.5" />
        <circle className="logo-path" cx="24" cy="8" r="1.5" fill="currentColor" stroke="currentColor" strokeWidth="0.5" />
      </svg>
      <span
        ref={textRef}
        className={`font-serif font-bold tracking-tight ${s.text}`}
      >
        Legal<span className="text-primary">Sense</span>
      </span>
    </div>
  )
}
