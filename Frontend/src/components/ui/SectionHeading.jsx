export default function SectionHeading({ title, subtitle, centered = true, className = '' }) {
  return (
    <div className={`mb-12 ${centered ? 'text-center' : ''} ${className}`}>
      <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-[-0.03em] text-foreground">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-lg text-muted-foreground leading-[1.7] max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  )
}
