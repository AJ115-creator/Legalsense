import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Card from '../ui/Card'
import SectionHeading from '../ui/SectionHeading'

gsap.registerPlugin(ScrollTrigger)

const steps = [
  { num: '01', title: 'Upload Your PDF', desc: 'Drop your legal document — court order, notice, agreement, anything.' },
  { num: '02', title: 'AI Analyzes It', desc: 'We parse the document and map it to relevant Indian laws and sections.' },
  { num: '03', title: 'Get Clear Results', desc: 'Plain-language summary, referenced laws, and concrete next steps.' },
]

const StepCard = ({ num, title, desc }) => (
  <Card glass className="flex gap-6 items-start step-card">
    <span className="font-serif text-4xl font-bold text-primary/30 shrink-0 leading-none">
      {num}
    </span>
    <div>
      <h3 className="font-serif text-xl font-semibold mb-1">{title}</h3>
      <p className="text-muted-foreground leading-[1.7]">{desc}</p>
    </div>
  </Card>
)

const StepsSection = () => {
  const sectionRef = useRef()
  const headingRef = useRef()
  const listRef = useRef()

  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // Heading
      gsap.from(headingRef.current, {
        y: 28,
        opacity: 0,
        duration: 0.65,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: headingRef.current,
          start: 'top 87%',
          once: true,
        },
      })

      // Step cards slide in from alternating sides
      Array.from(listRef.current.children).forEach((card, i) => {
        gsap.from(card, {
          x: i % 2 === 0 ? -65 : 65,
          opacity: 0,
          scale: 0.97,
          duration: 0.75,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 83%',
            once: true,
          },
        })
      })
    })
  }, { scope: sectionRef })

  return (
    <section ref={sectionRef} className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div ref={headingRef}>
          <SectionHeading
            title="How It Works"
            subtitle="Three simple steps to understand your legal documents."
          />
        </div>
        <div ref={listRef} className="space-y-8">
          {steps.map((step, i) => (
            <StepCard key={i} {...step} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default StepsSection
