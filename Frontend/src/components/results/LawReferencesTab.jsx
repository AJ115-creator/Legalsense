import Card from '../ui/Card'
import Badge from '../ui/Badge'

const BADGE_VARIANTS = {
  primary: 'default',
  procedural: 'warning',
}

const LawReferenceCard = ({ section, description, type }) => (
  <Card glass className="stagger-child flex flex-col sm:flex-row sm:items-center gap-3">
    <Badge variant={BADGE_VARIANTS[type] || 'muted'}>{type}</Badge>
    <div>
      <h4 className="font-serif font-semibold text-sm">{section}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </Card>
)

const LawReferencesTab = ({ references }) => (
  <div className="space-y-3">
    {references.map((ref, i) => (
      <LawReferenceCard key={i} {...ref} />
    ))}
  </div>
)

export default LawReferencesTab
