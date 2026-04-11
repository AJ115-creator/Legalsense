import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Button from '../ui/Button'
import AuroraGradient from '../ui/AuroraGradient'

gsap.registerPlugin(ScrollTrigger)

const AuthCTA = ({ isSignedIn }) => {
  if (isSignedIn) {
    return <Link to="/upload"><Button size="lg">Upload Document</Button></Link>
  }
  return <Link to="/sign-in"><Button size="lg">Sign In to Start</Button></Link>
}

const WORDS_LINE1 = ['Your', 'Legal', 'Documents,']
const WORDS_LINE2 = ['Finally', 'Explained']

const HeroSection = () => {
  const { isSignedIn } = useUser()
  const sectionRef = useRef()
  const badgeRef = useRef()
  const subtitleRef = useRef()
  const ctaRef = useRef()
  const auraRef = useRef(null)

  useGSAP(() => {
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({ delay: 0.15, defaults: { ease: 'power3.out' } })

      tl.from(badgeRef.current, {
        opacity: 0,
        y: 16,
        scale: 0.9,
        duration: 0.55,
      })
      .from('.hero-word', {
        y: '108%',
        opacity: 0,
        duration: 0.72,
        stagger: 0.08,
      }, '-=0.2')
      .from(subtitleRef.current, {
        opacity: 0,
        y: 24,
        duration: 0.6,
      }, '-=0.3')
      .from(ctaRef.current.children, {
        opacity: 0,
        y: 20,
        scale: 0.93,
        duration: 0.5,
        stagger: 0.12,
      }, '-=0.35')
    })

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (!auraRef.current) return
      const blobs = auraRef.current.querySelectorAll('.aurora-blob')
      if (!blobs.length) return

      gsap.to(blobs[0], {
        y: 80,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.5,
        },
      })
      if (blobs[1]) {
        gsap.to(blobs[1], {
          y: 50,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.7,
          },
        })
      }
    })

    if (ctaRef.current) {
      const ctaBtn = ctaRef.current.querySelector('a, button')
      if (ctaBtn) {
        gsap.to(ctaBtn, {
          boxShadow: '0 0 20px var(--primary), 0 0 40px var(--primary)',
          duration: 1.5,
          yoyo: true,
          repeat: -1,
          ease: 'power1.inOut',
          delay: 1.5,
        })
      }
    }
  }, { scope: sectionRef })

  return (
    <section ref={sectionRef} className="relative overflow-hidden py-24 md:py-32 px-4">
      <div ref={auraRef}>
        <AuroraGradient variant="hero" />
      </div>
      <div className="max-w-4xl mx-auto text-center">

        <div
          ref={badgeRef}
          className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-sm font-medium"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          AI-Powered Legal Analysis for India
        </div>

        <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-bold tracking-[-0.03em] text-foreground leading-tight">
          {WORDS_LINE1.map((word) => (
            <span key={word} className="inline-block overflow-hidden leading-[1.3] mr-[0.22em]">
              <span className="hero-word inline-block">{word}</span>
            </span>
          ))}
          <span className="text-primary">
            {WORDS_LINE2.map((word) => (
              <span key={word} className="inline-block overflow-hidden leading-[1.3] mr-[0.22em]">
                <span className="hero-word inline-block">{word}</span>
              </span>
            ))}
          </span>
        </h1>

        <p ref={subtitleRef} className="mt-6 text-lg md:text-xl text-muted-foreground leading-[1.7] max-w-2xl mx-auto">
          Upload any Indian legal document and get a plain-language summary with
          actual law references and honest, actionable next steps. No jargon. No sugarcoating.
        </p>

        <div ref={ctaRef} className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <AuthCTA isSignedIn={isSignedIn} />
          <Link to="/about">
            <Button variant="outline" size="lg">Learn More</Button>
          </Link>
        </div>

      </div>
    </section>
  )
}

export default HeroSection