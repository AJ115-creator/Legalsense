import { AuthenticateWithRedirectCallback } from '@clerk/react'

export default function SSOCallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <AuthenticateWithRedirectCallback />
    </div>
  )
}
