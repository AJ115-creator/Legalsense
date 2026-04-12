import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import {
  ScaleOfJustice,
  GavelIcon,
  ConstitutionScroll,
  ParagraphSymbol,
  DocumentSeal,
} from './legal-icons'

const HERO_ELEMENTS = [
  { Icon: ScaleOfJustice, size: 64, opacity: 0.18, rotation: -12, position: 'top-8 left-4 md:left-8' },
  { Icon: GavelIcon, size: 56, opacity: 0.15, rotation: 15, position: 'top-12 right-4 md:right-10' },
  { Icon: ParagraphSymbol, size: 48, opacity: 0.22, rotation: 8, position: 'top-1/3 left-2 md:left-6' },
  { Icon: ConstitutionScroll, size: 60, opacity: 0.15, rotation: -6, position: 'top-1/2 right-2 md:right-8' },
  { Icon: DocumentSeal, size: 44, opacity: 0.18, rotation: 10, position: 'bottom-16 left-8 md:left-16' },
  { Icon: ScaleOfJustice, size: 72, opacity: 0.12, rotation: -8, position: 'bottom-8 right-4 md:right-12' },
]

const FloatingLegalArt = ({ variant = 'hero' }) => {
  const ref = useRef()
  const elements = variant === 'hero' ? HERO_ELEMENTS : HERO_ELEMENTS

  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const floats = ref.current.querySelectorAll('.legal-float')
      floats.forEach((el, i) => {
        gsap.to(el, {
          y: `+=${gsap.utils.random(-24, 24)}`,
          x: `+=${gsap.utils.random(-14, 14)}`,
          rotation: `+=${gsap.utils.random(-4, 4)}`,
          duration: gsap.utils.random(12, 20),
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: i * 3,
        })
      })
    })
  }, { scope: ref })

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none overflow-hidden">
      {elements.map((el, i) => (
        <div
          key={i}
          className={`legal-float absolute ${el.position}`}
          style={{
            opacity: el.opacity,
            transform: `rotate(${el.rotation}deg)`,
          }}
        >
          <el.Icon size={el.size} />
        </div>
      ))}
    </div>
  )
}

export default FloatingLegalArt
