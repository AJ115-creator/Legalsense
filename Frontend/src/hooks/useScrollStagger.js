import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function useScrollStagger(options = {}) {
  const ref = useRef()
  const {
    childSelector = '.stagger-item',
    y = 30,
    duration = 0.5,
    stagger = 0.15,
    parentY = 20,
    parentDuration = 0.4,
  } = options

  useGSAP(() => {
    if (!ref.current) return

    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const children = ref.current.querySelectorAll(childSelector)

      // Parent fade-in
      gsap.from(ref.current, {
        y: parentY,
        opacity: 0,
        duration: parentDuration,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 85%',
          once: true,
        },
      })

      // Children stagger
      if (children.length) {
        gsap.from(children, {
          y,
          opacity: 0,
          duration,
          stagger,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: ref.current,
            start: 'top 80%',
            once: true,
          },
        })
      }
    })
  }, { scope: ref })

  return ref
}
