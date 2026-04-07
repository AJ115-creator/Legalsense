import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Card from '../ui/Card'
import SectionHeading from '../ui/SectionHeading'
import AuroraGradient from '../ui/AuroraGradient'
import { DocumentIcon, AnalysisIcon, ShieldCheckIcon } from '../ui/icons'

gsap.registerPlugin(ScrollTrigger)

const features = [
  { icon: <DocumentIcon />, title: 'Upload Any Legal Document', desc: 'Supports court orders, FIRs, bail applications, rental agreements, legal notices, and more.' },
  { icon: <AnalysisIcon />, title: 'AI-Powered Analysis', desc: 'Our AI reads your document, identifies key legal provisions under Indian law, and breaks it all down.' },
  { icon: <ShieldCheckIcon />, title: 'Honest, Actionable Advice', desc: 'No sugarcoating. Get genuine suggestions on what you should do next, with full Indian law references.' },
]

const FeatureCard = ({ icon, title, desc }) => (
  <Card glass clickable className="text-center feature-card">
    <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary mb-4">
      {icon}
    </div>
    <h3 className="font-serif text-lg font-semibold mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground leading-[1.7]">{desc}</p>
  </Card>
)

const FeaturesSection = () => {
  const sectionRef = useRef()
  const headingRef = useRef()
  const gridRef = useRef()

  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // Section heading slides up
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

      // Cards: 3D flip-from-below with stagger
      gsap.from(gridRef.current.children, {
        y: 55,
        opacity: 0,
        rotateX: 22,
        scale: 0.94,
        transformPerspective: 700,
        duration: 0.75,
        stagger: 0.16,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: gridRef.current,
          start: 'top 83%',
          once: true,
        },
      })
    })
  }, { scope: sectionRef })

  return (
    <section ref={sectionRef} className="py-20 px-4 relative">
      <AuroraGradient variant="centered" />
      <div className="max-w-6xl mx-auto">
        <div ref={headingRef}>
          <SectionHeading
            title="Built for Real People"
            subtitle="Whether you're dealing with a court case, rental dispute, or legal notice — we help you understand what's happening."
          />
        </div>
        <div ref={gridRef} className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection
