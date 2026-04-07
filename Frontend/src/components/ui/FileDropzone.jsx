import { useState, useRef, useCallback } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { UploadIcon, CheckDocIcon } from './icons'

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const isPdf = (file) => file?.type === 'application/pdf' || file?.name?.endsWith('.pdf')

const FileDropzone = ({ onFileSelect, className = '' }) => {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef()
  const zoneRef = useRef()
  const contentRef = useRef()

  useGSAP(() => {
    // Initial setup — nothing to animate yet
  }, { scope: zoneRef })

  const animateDragEnter = useCallback(() => {
    if (!zoneRef.current) return
    gsap.to(zoneRef.current, {
      scale: 1.02,
      duration: 0.3,
      ease: 'back.out(1.5)',
    })
  }, [])

  const animateDragLeave = useCallback(() => {
    if (!zoneRef.current) return
    gsap.to(zoneRef.current, {
      scale: 1,
      duration: 0.2,
      ease: 'power2.out',
    })
  }, [])

  const animateFileSelected = useCallback(() => {
    if (!contentRef.current) return
    const children = contentRef.current.children
    gsap.fromTo(children,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.08, ease: 'power2.out' }
    )
  }, [])

  const selectFile = (file) => {
    if (!isPdf(file)) {
      setError('Please select a PDF file')
      return
    }
    setError(null)
    setSelectedFile(file)
    onFileSelect?.(file)
    requestAnimationFrame(animateFileSelected)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    if (!dragOver) {
      setDragOver(true)
      animateDragEnter()
    }
  }

  const handleDragLeave = () => {
    setDragOver(false)
    animateDragLeave()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    animateDragLeave()
    selectFile(e.dataTransfer.files[0])
  }

  const handleChange = (e) => {
    if (e.target.files[0]) selectFile(e.target.files[0])
  }

  return (
    <div className={className}>
      <div
        ref={zoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed p-12 text-center
          backdrop-blur-xl bg-card/40 dark:bg-card/30 ring-1 ring-white/10
          transition-[border-color,background-color] duration-150 ease-out
          ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-card/60'}
        `}
      >
        <input ref={inputRef} type="file" accept=".pdf" onChange={handleChange} className="hidden" />
        <div ref={contentRef}>
          {selectedFile ? (
            <>
              <div className="mx-auto w-12 h-12 text-primary"><CheckDocIcon size={48} /></div>
              <p className="font-medium text-foreground mt-2">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground mt-1">{formatFileSize(selectedFile.size)}</p>
              <p className="text-xs text-primary mt-1">Click or drop to replace</p>
            </>
          ) : (
            <>
              <div className="mx-auto w-12 h-12 text-muted-foreground"><UploadIcon size={48} /></div>
              <p className="font-medium text-foreground mt-3">Drop your PDF here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <p className="text-xs text-muted-foreground mt-3">PDF files only</p>
            </>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  )
}

export default FileDropzone
