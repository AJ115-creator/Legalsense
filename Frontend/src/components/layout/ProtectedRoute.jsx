import { useEffect, useRef } from 'react'
import { useUser } from '@clerk/react'
import { Navigate, Outlet } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { Spinner } from '../ui/icons'

const ProtectedRoute = () => {
  const { user, isSignedIn, isLoaded } = useUser()
  const widgetRef = useRef(null)

  useEffect(() => {
    if (!isSignedIn) return

    // Set Sentry user context for feedback
    Sentry.setUser({
      email: user?.primaryEmailAddress?.emailAddress,
      username: user?.firstName || user?.username,
    })

    // Mount feedback widget
    const feedback = Sentry.getFeedback()
    if (feedback && !widgetRef.current) {
      widgetRef.current = feedback.createWidget()
    }

    return () => {
      if (widgetRef.current) {
        widgetRef.current.removeFromDom()
        widgetRef.current = null
      }
    }
  }, [isSignedIn, user])

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner />
      </div>
    )
  }

  if (!isSignedIn) return <Navigate to="/sign-in" replace />

  return <Outlet />
}

export default ProtectedRoute
