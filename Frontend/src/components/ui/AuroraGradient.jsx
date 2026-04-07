import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

const variantPresets = {
  hero: [
    { x: 'right-1/4', y: 'top-0', size: 500, color: 'var(--primary)', opacity: 0.15, drift: 150 },
    { x: 'left-1/4', y: 'bottom-0', size: 400, color: 'var(--secondary)', opacity: 0.15, drift: 120 },
    { x: 'right-1/3', y: 'top-1/3', size: 300, color: 'var(--accent)', opacity: 0.1, drift: 100 },
  ],
  centered: [
    { x: 'left-1/2', y: 'top-1/2', size: 600, color: 'var(--primary)', opacity: 0.08, drift: 80, centered: true },
  ],
  signin: [
    { x: 'left-1/4', y: 'top-1/4', size: 384, color: 'var(--primary)', opacity: 0.2, drift: 120 },
    { x: 'right-1/4', y: 'bottom-1/4', size: 320, color: 'var(--secondary)', opacity: 0.2, drift: 100 },
    { x: 'left-1/2', y: 'top-1/2', size: 256, color: 'var(--accent)', opacity: 0.15, drift: 90, centered: true },
  ],
  subtle: [
    { x: 'right-1/4', y: 'top-1/4', size: 320, color: 'var(--primary)', opacity: 0.1, drift: 60 },
    { x: 'left-1/3', y: 'bottom-1/4', size: 256, color: 'var(--secondary)', opacity: 0.1, drift: 50 },
  ],
}

const randomRange = (min, max) => Math.random() * (max - min) + min

const AuroraGradient = ({ variant = 'hero', blobs: customBlobs, className = '' }) => {
  const containerRef = useRef()
  const items = customBlobs || variantPresets[variant] || variantPresets.hero

  useGSAP(() => {
    const blobEls = containerRef.current.querySelectorAll('.aurora-blob')
    if (!blobEls.length) return

    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      blobEls.forEach((blob, i) => {
        gsap.set(blob, { willChange: 'transform' })

        const drift = items[i]?.drift || 100
        const duration = randomRange(22, 30)

        gsap.to(blob, {
          x: `+=${randomRange(-drift, drift)}`,
          y: `+=${randomRange(-drift * 0.6, drift * 0.6)}`,
          scale: randomRange(0.95, 1.05),
          duration,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: i * 4,
        })
      })

      return () => {
        blobEls.forEach(blob => gsap.set(blob, { willChange: 'auto' }))
      }
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className={`absolute inset-0 -z-10 overflow-hidden ${className}`}>
      {items.map((blob, i) => (
        <div
          key={i}
          className={`aurora-blob absolute ${blob.x} ${blob.y}`}
          style={{
            width: blob.size,
            height: blob.size,
            backgroundColor: blob.color,
            opacity: blob.opacity,
            ...(blob.centered && { transform: 'translate(-50%, -50%)' }),
          }}
        />
      ))}
    </div>
  )
}

export default AuroraGradient
