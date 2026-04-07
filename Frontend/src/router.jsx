import { createBrowserRouter } from 'react-router-dom'
import PageLayout from './components/layout/PageLayout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Landing from './pages/Landing'
import SignIn from './pages/SignIn'
import SSOCallback from './pages/SSOCallback'
import Upload from './pages/Upload'
import Results from './pages/Results'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import About from './pages/About'
import NotFound from './pages/NotFound'

export const router = createBrowserRouter([
  {
    element: <PageLayout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/sign-in', element: <SignIn /> },
      { path: '/sign-in/sso-callback', element: <SSOCallback /> },
      { path: '/about', element: <About /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/upload', element: <Upload /> },
          { path: '/results/:id', element: <Results /> },
          { path: '/dashboard', element: <Dashboard /> },
          { path: '/chat/:id', element: <Chat /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
