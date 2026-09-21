import { useCallback, useEffect, useState } from 'react'
import { embudoApi } from './supabase.js'

// Etapas que se usan mientras no se cargan las de la base (o si todavía no se
// corrió la migración): las cuatro de siempre.
export const ETAPAS_POR_DEFECTO = [
  { clave: 'nuevo', nombre: 'Nueva consulta', orden: 1, color: '#8b8fe8', tipo: 'abierta' },
  { clave: 'contactado', nombre: 'Filtrado', orden: 2, color: '#7ec4f2', tipo: 'abierta' },
  { clave: 'reservado', nombre: 'Ya pagó, reserva confirmada', orden: 3, color: '#34c38f', tipo: 'ganada' },
  { clave: 'perdido', nombre: 'Perdido', orden: 4, color: '#9ca3af', tipo: 'perdida' },
]

// Etapas que el sistema usa por su nombre interno y no se pueden borrar:
// 'nuevo' es donde entran los leads (WhatsApp, formulario, "lead rápido"),
// 'reservado' es la que se marca al convertir un lead en cliente y 'perdido'
// la de los que no compraron.
export const CLAVES_FIJAS = ['nuevo', 'reservado', 'perdido']

export const TIPOS_ETAPA = [
  { id: 'abierta', label: 'En curso' },
  { id: 'ganada', label: 'Ganada (ya pagó)' },
  { id: 'perdida', label: 'Perdida' },
]

export function useEtapas() {
  const [etapas, setEtapas] = useState(ETAPAS_POR_DEFECTO)
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(async () => {
    const res = await embudoApi.getAll()
    if (res?.data?.length) setEtapas(res.data)
    setCargando(false)
  }, [])

  useEffect(() => { recargar() }, [recargar])
  return { etapas, cargando, recargar }
}

export function etapaDe(etapas, clave) {
  return etapas.find(e => e.clave === clave)
}

// Una clave que ya no existe (etapa borrada) cae en la primera etapa, para que
// el lead no desaparezca del tablero.
export function claveVisible(etapas, clave) {
  return etapas.some(e => e.clave === clave) ? clave : etapas[0]?.clave
}

// Nombre de la etapa con su color: punto de color y fondo tenue del mismo tono.
// El texto queda neutro para que se lea igual en claro y en oscuro.
export function estiloFondoEtapa(color) {
  return { backgroundColor: `${color}2e` }
}
