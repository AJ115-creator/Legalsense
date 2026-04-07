import { useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import Navbar from './Navbar'
import Footer from './Footer'

export default function PageLayout() {
  const mainRef = useRef()

  useGSAP(() => {
    gsap.from(mainRef.current, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.out',
    })
  }, { scope: mainRef })

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main ref={mainRef} className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
