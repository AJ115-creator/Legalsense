import { useState, useRef } from 'react'
import { useSignIn, useUser } from '@clerk/react'
import { Navigate } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import Logo from '../components/ui/Logo'
import Button from '../components/ui/Button'
import AuroraGradient from '../components/ui/AuroraGradient'

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

const GitHubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
)

// Floating legal document fragment decorations for background atmosphere
const FloatingDocFragments = () => {
  const ref = useRef()

  useGSAP(() => {
    const frags = ref.current.querySelectorAll('.float-frag')
    frags.forEach((el, i) => {
      gsap.to(el, {
        y: `+=${gsap.utils.random(-28, 28)}`,
        x: `+=${gsap.utils.random(-16, 16)}`,
        rotation: `+=${gsap.utils.random(-5, 5)}`,
        duration: gsap.utils.random(10, 18),
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        delay: i * 2.5,
      })
    })
  }, { scope: ref })

  const DocLines = ({ count, widths }) =>
    Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        className="h-1.5 rounded-full bg-primary/20"
        style={{ width: widths?.[i] ?? (i === 0 ? '68%' : i % 3 === 0 ? '52%' : '100%') }}
      />
    ))

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Top-left fragment */}
      <div className="float-frag absolute -top-4 -left-12 w-36 h-48 rounded-2xl border border-primary/15 bg-primary/3 rotate-[-13deg]">
        <div className="p-4 mt-2 space-y-2">
          <DocLines count={7} />
        </div>
      </div>

      {/* Top-right fragment */}
      <div className="float-frag absolute -top-2 -right-10 w-32 h-44 rounded-2xl border border-secondary/15 bg-secondary/3 rotate-17">
        <div className="p-3 mt-2 space-y-2">
          <DocLines count={6} widths={[60, 100, 78, 100, 50, 100]} />
        </div>
      </div>

      {/* Mid-left fragment */}
      <div className="float-frag absolute top-1/2 -left-16 w-28 h-36 rounded-2xl border border-primary/10 bg-primary/2.5 rotate-[8deg]">
        <div className="p-3 mt-2 space-y-2">
          <DocLines count={5} />
        </div>
      </div>

      {/* Bottom-right fragment */}
      <div className="float-frag absolute -bottom-10 -right-8 w-44 h-56 rounded-2xl border border-foreground/8 bg-foreground/2 rotate-[-8deg]">
        <div className="p-4 mt-3 space-y-2">
          <DocLines count={8} widths={[100, 72, 100, 58, 100, 84, 50, 100]} />
        </div>
      </div>

      {/* Bottom-left fragment */}
      <div className="float-frag absolute -bottom-4 -left-6 w-24 h-32 rounded-2xl border border-secondary/10 bg-secondary/2 rotate-11">
        <div className="p-3 mt-2 space-y-2">
          <DocLines count={4} />
        </div>
      </div>
    </div>
  )
}

const SignIn = () => {
  const { signIn } = useSignIn()
  const { isSignedIn } = useUser()
  const [error, setError] = useState(null)
  const wrapperRef = useRef()
  const cardRef = useRef()
  const taglineRef = useRef()
  const buttonsRef = useRef()
  const footerRef = useRef()

  useGSAP(() => {
    if (!cardRef.current || !wrapperRef.current) return

    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // Entrance: 3D flip-from-below with scale
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.from(cardRef.current, {
        y: 70,
        opacity: 0,
        scale: 0.91,
        rotationX: 12,
        transformPerspective: 900,
        duration: 1.0,
      })
        .from(taglineRef.current, { opacity: 0, y: 14, duration: 0.55 }, '-=0.45')
        .from(buttonsRef.current.children, {
          opacity: 0,
          y: 18,
          duration: 0.45,
          stagger: 0.13,
        }, '-=0.32')
        .from(footerRef.current, { opacity: 0, duration: 0.4 }, '-=0.15')

      // 3D mouse-tilt on wrapper
      const onMove = (e) => {
        const { left, top, width, height } = wrapperRef.current.getBoundingClientRect()
        const dx = (e.clientX - left - width / 2) / (width / 2)
        const dy = (e.clientY - top - height / 2) / (height / 2)
        gsap.to(cardRef.current, {
          rotationY: dx * 9,
          rotationX: -dy * 6,
          transformPerspective: 900,
          duration: 0.45,
          ease: 'power2.out',
          overwrite: 'auto',
        })
      }

      const onLeave = () => {
        gsap.to(cardRef.current, {
          rotationY: 0,
          rotationX: 0,
          duration: 1.1,
          ease: 'power3.out',
          overwrite: 'auto',
        })
      }

      wrapperRef.current.addEventListener('mousemove', onMove)
      wrapperRef.current.addEventListener('mouseleave', onLeave)
      return () => {
        wrapperRef.current?.removeEventListener('mousemove', onMove)
        wrapperRef.current?.removeEventListener('mouseleave', onLeave)
      }
    })
  }, { scope: wrapperRef })

  if (isSignedIn) return <Navigate to="/dashboard" replace />

  const signInWith = async (strategy) => {
    if (!signIn) return
    setError(null)
    try {
      await signIn.sso({
        strategy,
        redirectUrl: '/dashboard',
        redirectCallbackUrl: '/sign-in/sso-callback',
      })
    } catch (err) {
      setError(err?.errors?.[0]?.longMessage || 'Sign in failed. Please try again.')
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="min-h-[80vh] flex items-center justify-center px-4 relative overflow-hidden"
    >
      <AuroraGradient variant="signin" />
      <FloatingDocFragments />

      <div
        ref={cardRef}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative z-10 w-full max-w-md backdrop-blur-xl bg-card/60 dark:bg-card/40 border border-white/20 dark:border-white/5 ring-1 ring-white/10 rounded-2xl shadow-2xl p-8 text-center"
      >
        <div className="flex justify-center mb-6">
          <Logo size="large" animate={true} />
        </div>

        <p ref={taglineRef} className="text-muted-foreground leading-[1.7] mb-8">
          Understand your legal documents with clarity and confidence
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div ref={buttonsRef} className="space-y-3">
          <Button
            variant="outline"
            size="lg"
            className="w-full justify-center"
            onClick={() => signInWith('oauth_google')}
            disabled={!signIn}
          >
            <GoogleIcon /> Continue with Google
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full justify-center"
            onClick={() => signInWith('oauth_github')}
            disabled={!signIn}
          >
            <GitHubIcon /> Continue with GitHub
          </Button>
        </div>

        <p ref={footerRef} className="mt-6 text-xs text-muted-foreground">
          By signing in, you agree to our terms of service
        </p>
      </div>
    </div>
  )
}

export default SignIn
