import { useState, useRef, useCallback } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

export default function Tabs({ tabs, defaultTab = 0, className = '' }) {
  const [active, setActive] = useState(defaultTab)
  const [displayed, setDisplayed] = useState(defaultTab)
  const [animating, setAnimating] = useState(false)
  const contentRef = useRef()

  useGSAP(() => {
    // scope setup for cleanup
  }, { scope: contentRef })

  const animateIn = useCallback(() => {
    if (!contentRef.current) return
    const staggerChildren = contentRef.current.querySelectorAll('.stagger-child')

    gsap.fromTo(contentRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
    )

    if (staggerChildren.length) {
      gsap.fromTo(staggerChildren,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.06, ease: 'power2.out', delay: 0.1 }
      )
    }
  }, [])

  const switchTab = useCallback((newIndex) => {
    if (animating || newIndex === active) return
    setAnimating(true)
    setActive(newIndex)

    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to(contentRef.current, {
        opacity: 0,
        y: -8,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          setDisplayed(newIndex)
          setAnimating(false)
          requestAnimationFrame(animateIn)
        },
      })
    })

    // Instant switch for reduced-motion
    mm.add('(prefers-reduced-motion: reduce)', () => {
      setDisplayed(newIndex)
      setAnimating(false)
    })
  }, [animating, active, animateIn])

  return (
    <div className={className}>
      <div className="flex gap-1 p-1 rounded-xl backdrop-blur-xl bg-card/60 dark:bg-card/40 border border-white/20 dark:border-white/5 ring-1 ring-white/10 mb-6">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => switchTab(i)}
            className={`
              flex-1 px-4 py-2.5 text-sm font-medium rounded-lg
              transition-[background-color,color,box-shadow] duration-150 ease-out
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              ${active === i
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div ref={contentRef}>{tabs[displayed]?.content}</div>
    </div>
  )
}
