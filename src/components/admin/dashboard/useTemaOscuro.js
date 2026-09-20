import { useState, useEffect } from 'react'

// Los gráficos de recharts pintan con colores en atributos SVG (no con clases
// de Tailwind), así que necesitan saber en qué tema está el panel. El botón de
// tema agrega o saca la clase "dark" del <html> sin re-renderizar la página.
export function useTemaOscuro() {
  const leer = () => document.documentElement.classList.contains('dark')
  const [oscuro, setOscuro] = useState(leer)
  useEffect(() => {
    const obs = new MutationObserver(() => setOscuro(leer()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return oscuro
}
