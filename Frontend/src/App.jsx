import * as Sentry from '@sentry/react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'

export default function App() {
  return (
    <Sentry.ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <RouterProvider router={router} />
    </Sentry.ErrorBoundary>
  )
}
