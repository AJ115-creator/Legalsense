import * as Sentry from '@sentry/react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { router } from './router'

export default function App() {
  return (
    <Sentry.ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'group bg-background/50 backdrop-blur-2xl border-border/50 shadow-2xl text-foreground rounded-xl !p-4',
            title: 'text-foreground font-medium text-sm',
            description: 'text-muted-foreground text-sm',
            icon: 'group-data-[type=error]:text-destructive group-data-[type=success]:text-green-600 dark:group-data-[type=success]:text-green-500',
            success: '!bg-green-500/10 !border-green-500/20',
            error: '!bg-destructive/10 !border-destructive/20',
          }
        }}
      />
    </Sentry.ErrorBoundary>
  )
}
