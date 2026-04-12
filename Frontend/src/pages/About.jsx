import { useScrollFadeIn } from '../hooks/useScrollFadeIn'
import Card from '../components/ui/Card'
import SectionHeading from '../components/ui/SectionHeading'
import ProtectedImage from '../components/ui/ProtectedImage'

const team = [
  { name: 'Ayush', role: 'Founder & Developer', img: '/me.jpeg', protect: true },
]

const audiences = [
  { title: 'Common Citizens', desc: 'People who received an FIR, court summons, or legal notice and feel overwhelmed.' },
  { title: 'Tenants & Landlords', desc: 'Understanding rental agreements, eviction notices, and property disputes.' },
  { title: 'Small Business Owners', desc: 'Navigating compliance notices, contracts, and regulatory documents.' },
  { title: 'Students & Researchers', desc: 'Understanding case law, judgments, and legal precedents for academic work.' },
]

const TeamMemberCard = ({ member }) => (
  <Card glass className="text-center">
    {member.protect ? (
      <ProtectedImage
        src={member.img}
        alt={member.name}
        className="w-20 h-20 rounded-full mx-auto mb-4 ring-2 ring-primary/20"
      />
    ) : (
      <img
        src={member.img}
        alt={member.name}
        className="w-20 h-20 rounded-full mx-auto mb-4 object-cover ring-2 ring-primary/20"
      />
    )}
    <h3 className="font-serif font-semibold">{member.name}</h3>
    <p className="text-sm text-muted-foreground">{member.role}</p>
  </Card>
)

const MissionSection = () => {
  const ref = useScrollFadeIn()
  return (
    <section ref={ref} className="py-20 px-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>
      <div className="max-w-3xl mx-auto text-center">
        <SectionHeading
          title="Why LegalSense Exists"
          subtitle="India has 5.58 crore pending court cases. Millions of people receive legal documents they can't understand. We're changing that."
        />
        <Card glass className="text-left">
          <p className="text-foreground leading-[1.7] mb-4">
            Most Indians dealing with the legal system don't have access to a lawyer who can explain their documents in plain language. They get FIRs, court orders, and legal notices filled with jargon they don't understand.
          </p>
          <p className="text-foreground leading-[1.7] mb-4">
            LegalSense bridges that gap. Upload any legal document, and our AI breaks it down — referencing actual Indian laws (BNS, BNSS, CPC, IPC, specific State Acts) — so you know exactly where you stand.
          </p>
          <p className="text-foreground leading-[1.7] mb-4">
            We don't sugarcoat. If your situation is serious, we'll tell you. If you need a lawyer urgently, we'll say that too.
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            Source:{' '}
            <a href="https://njdg.ecourts.gov.in/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
              National Judicial Data Grid
            </a>
            {' '}&{' '}
            <a href="https://en.wikipedia.org/wiki/Pendency_of_court_cases_in_India" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
              Wikipedia
            </a>
            {' '}(as of April 2026)
          </p>
        </Card>
      </div>
    </section>
  )
}

const AudienceSection = () => {
  const ref = useScrollFadeIn()
  return (
    <section ref={ref} className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <SectionHeading
          title="Who This Is For"
          subtitle="Anyone in India who has received a legal document and doesn't know what to do next."
        />
        <div className="grid md:grid-cols-2 gap-6">
          {audiences.map((item, i) => (
            <Card key={i} glass>
              <h3 className="font-serif text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-[1.7]">{item.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

const TeamSection = () => {
  const ref = useScrollFadeIn()
  return (
    <section ref={ref} className="py-20 px-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
      </div>
      <div className="max-w-4xl mx-auto">
        <SectionHeading
          title="The Team"
          subtitle="A one-person mission — making Indian law accessible."
        />
        <div className="flex justify-center">
          {team.map((member, i) => (
            <div key={i} className="w-full max-w-sm">
              <TeamMemberCard member={member} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const About = () => (
  <div>
    <MissionSection />
    <AudienceSection />
    <TeamSection />
  </div>
)

export default About
