import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function useScrollFadeIn(options = {}) {
  const ref = useRef()
  const { y = 30, duration = 0.6, delay = 0 } = options

  useGSAP(() => {
    if (!ref.current) return
    gsap.from(ref.current, {
      y,
      opacity: 0,
      duration,
      delay,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: ref.current,
        start: 'top 85%',
        once: true,
      },
    })
  }, { scope: ref })

  return ref
}
