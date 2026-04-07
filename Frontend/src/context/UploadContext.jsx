import { createContext, useContext, useState } from 'react'

const UploadContext = createContext()

export function UploadProvider({ children }) {
  const [uploadedFile, setUploadedFile] = useState(null)

  const setFile = (file) => {
    setUploadedFile(file ? { name: file.name, size: file.size, type: file.type } : null)
  }

  const clearFile = () => setUploadedFile(null)

  return (
    <UploadContext.Provider value={{ uploadedFile, setFile, clearFile }}>
      {children}
    </UploadContext.Provider>
  )
}

export function useUpload() {
  const ctx = useContext(UploadContext)
  if (!ctx) throw new Error('useUpload must be used within UploadProvider')
  return ctx
}
