import { useUser } from '@clerk/react'
import { useScrollStagger } from '../../hooks/useScrollStagger'
import Button from '../ui/Button'
import Card from '../ui/Card'
import AuroraGradient from '../ui/AuroraGradient'

const CTASection = () => {
  const { isSignedIn } = useUser()
  const ref = useScrollStagger({ childSelector: '.stagger-item', stagger: 0.12 })

  const ctaLink = isSignedIn ? '/upload' : '/sign-in'
  const ctaText = isSignedIn ? 'Upload Your First Document' : 'Get Started Free'

  return (
    <section ref={ref} className="py-20 px-4 relative overflow-hidden">
      <AuroraGradient variant="subtle" />
      <div className="max-w-3xl mx-auto text-center">
        <Card glass className="p-12">
          <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-[-0.03em] mb-4 stagger-item">
            Stop Guessing. Start Understanding.
          </h2>
          <p className="text-muted-foreground leading-[1.7] mb-8 max-w-xl mx-auto stagger-item">
            Your legal documents contain critical information about your rights and obligations.
            Don't leave it to chance.
          </p>
          <Button to={ctaLink} size="lg" className="stagger-item">
            {ctaText}
          </Button>
        </Card>
      </div>
    </section>
  )
}

export default CTASection
