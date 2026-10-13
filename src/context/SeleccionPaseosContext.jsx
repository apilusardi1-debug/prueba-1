import { createContext, useContext, useEffect, useState } from 'react'

// "Mi selección" de paseos del sitio público: el cliente va agregando los que
// le interesan (desde el catálogo o el detalle) y al final los manda todos
// juntos por WhatsApp — la reserva se cierra por ahí, no en el sitio.
// Se guarda en el navegador para que no se pierda al recargar o volver otro día.
const CLAVE = 'dreamtours_seleccion_paseos'

const SeleccionPaseosContext = createContext(null)

function leerGuardado() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    const lista = crudo ? JSON.parse(crudo) : []
    return Array.isArray(lista) ? lista : []
  } catch (_) {
    return []
  }
}

export function SeleccionPaseosProvider({ children }) {
  const [paseos, setPaseos] = useState(leerGuardado)
  const [abierta, setAbierta] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify(paseos)) } catch (_) {}
  }, [paseos])

  // Solo se guarda lo que hace falta para mostrar la lista y armar el mensaje
  function agregar(ex) {
    setPaseos(prev => prev.some(p => p.id === ex.id) ? prev : [...prev, {
      id: ex.id,
      nombre: ex.nombre,
      destino: ex.destino || '',
      imagen: ex.imagen || '',
      precio: ex.precio,
      moneda: ex.moneda,
      precioUnidad: ex.precioUnidad,
    }])
  }

  function quitar(id) {
    setPaseos(prev => prev.filter(p => p.id !== id))
  }

  const tiene = (id) => paseos.some(p => p.id === id)

  return (
    <SeleccionPaseosContext.Provider value={{
      paseos, agregar, quitar, tiene, vaciar: () => setPaseos([]),
      abierta, abrir: () => setAbierta(true), cerrar: () => setAbierta(false),
    }}>
      {children}
    </SeleccionPaseosContext.Provider>
  )
}

export function useSeleccionPaseos() {
  return useContext(SeleccionPaseosContext)
}
