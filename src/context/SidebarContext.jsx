import { createContext, useContext, useState, useEffect } from 'react'

const SidebarContext = createContext(undefined)

export const useSidebar = () => {
  const context = useContext(SidebarContext)
  if (!context) throw new Error('useSidebar must be used within SidebarProvider')
  return context
}

export function SidebarProvider({ children }) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      if (!mobile) setIsMobileOpen(false)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <SidebarContext.Provider value={{
      isExpanded: isMobile ? false : isExpanded,
      isMobileOpen,
      isHovered,
      toggleSidebar: () => setIsExpanded(p => !p),
      toggleMobileSidebar: () => setIsMobileOpen(p => !p),
      setIsHovered,
    }}>
      {children}
    </SidebarContext.Provider>
  )
}
