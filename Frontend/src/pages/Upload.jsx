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
  const btnRef = useRef()
  const readyRef = useRef()

  useGSAP(() => {
    // scope setup
  }, { scope: btnRef })

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
    <div className="py-16 px-4 relative overflow-hidden">
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
