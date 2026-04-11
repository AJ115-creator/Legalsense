import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function useChatAnimations(containerRef, messages) {
  useEffect(() => {
    if (!containerRef.current || messages.length === 0) return

    const container = containerRef.current
    const bubbles = container.querySelectorAll('.chat-bubble')

    if (bubbles.length === 0) return

    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const userBubbles = container.querySelectorAll('.chat-bubble.user')
      const aiBubbles = container.querySelectorAll('.chat-bubble.ai')

      if (userBubbles.length > 0) {
        gsap.fromTo(
          userBubbles,
          { x: 40, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.08 }
        )
      }

      if (aiBubbles.length > 0) {
        gsap.fromTo(
          aiBubbles,
          { x: -40, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.08 }
        )
      }
    })

    return () => mm.revert()
  }, [messages.length, containerRef])
}

export function useTypingIndicator(dotRefs) {
  useEffect(() => {
    if (!dotRefs || dotRefs.length === 0) return

    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to(dotRefs, {
        scale: 1,
        opacity: 1,
        duration: 0.6,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1,
        stagger: 0.15,
      })
    })

    return () => mm.revert()
  }, [dotRefs])
}