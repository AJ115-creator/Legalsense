import { useUser } from '@clerk/react'
import { Navigate, Outlet } from 'react-router-dom'
import { Spinner } from '../ui/icons'

const ProtectedRoute = () => {
  const { isSignedIn, isLoaded } = useUser()

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
