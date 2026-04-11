import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useUpload } from '../context/UploadContext'
import { uploadDocument } from '../services/api'
import FileDropzone from '../components/ui/FileDropzone'
import Button from '../components/ui/Button'
import SectionHeading from '../components/ui/SectionHeading'
import AuroraGradient from '../components/ui/AuroraGradient'
import { Spinner } from '../components/ui/icons'

const Upload = () => {
  const [file, setFile] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState(null)
  const { setFile: setContextFile } = useUpload()
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const sectionRef = useRef(null)
  const btnRef = useRef()
  const readyRef = useRef()
  const progressBarRef = useRef(null)

  useGSAP(() => {
    if (!sectionRef.current) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(sectionRef.current,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
      )
    })
  }, { scope: sectionRef })

  useEffect(() => {
    if (!file || !btnRef.current) return

    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(btnRef.current,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.2)' }
      )
      if (readyRef.current) {
        gsap.fromTo(readyRef.current,
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.3, delay: 0.2, ease: 'power2.out' }
        )
      }
    })
  }, [file])

  useEffect(() => {
    if (!analyzing || !progressBarRef.current) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(progressBarRef.current,
        { scaleX: 0 },
        { scaleX: 0.7, duration: 2, ease: 'power1.inOut' }
      )
    })
  }, [analyzing])

  const handleAnalyze = async () => {
    if (!file) return
    setAnalyzing(true)
    setError(null)
    setContextFile(file)

    try {
      const result = await uploadDocument(file, getToken)
      navigate(`/results/${result.id}`)
    } catch (e) {
      setError(e.message || 'Upload failed. Please try again.')
      setAnalyzing(false)
    }
  }

  return (
    <div ref={sectionRef} className="py-16 px-4 relative overflow-hidden">
      <AuroraGradient variant="subtle" />
      <div className="max-w-2xl mx-auto">
        <SectionHeading
          title="Upload Your Document"
          subtitle="Drop your legal PDF below. We'll analyze it and break it down for you."
        />

        <FileDropzone onFileSelect={setFile} className="mb-8" />

        {error && (
          <p className="text-center text-sm text-destructive mb-4">{error}</p>
        )}

        {analyzing && (
          <div className="mb-6">
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                ref={progressBarRef}
                className="h-full bg-primary origin-left rounded-full"
                style={{ transform: 'scaleX(0)' }}
              />
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">Uploading and analyzing your document...</p>
          </div>
        )}

        <div className="text-center" ref={btnRef}>
          <Button size="lg" disabled={!file || analyzing} onClick={handleAnalyze}>
            {analyzing ? (
              <span className="flex items-center gap-2">
                <Spinner className="w-4 h-4 border-primary-foreground border-t-transparent" />
                Uploading & Analyzing...
              </span>
            ) : (
              'Analyze Document'
            )}
          </Button>
        </div>

        {file && !analyzing && (
          <p ref={readyRef} className="text-center text-sm text-muted-foreground mt-4">
            Ready to analyze <span className="font-medium text-foreground">{file.name}</span>
          </p>
        )}
      </div>
    </div>
  )
}

export default Upload