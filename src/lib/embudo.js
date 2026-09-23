import { useCallback, useEffect, useState } from 'react'
import { embudoApi } from './supabase.js'

// Embudos de ventas. Cada etapa pertenece a uno; un lead está en el embudo de su
// etapa. "ruta" es la sección del panel donde se ve cada uno. "posventa" es un
// embudo al que se llega después de vender (hoy solo Anfitriona): sus leads no
// cuentan como "nuevos" en el Dashboard, aunque acaben de entrar a su primera etapa.
export const EMBUDOS = [
  { clave: 'paquetes', nombre: 'Paquetes', ruta: '/admin/leads' },
  { clave: 'paseos', nombre: 'Paseos', ruta: '/admin/leads/paseos' },
  { clave: 'anfitriona', nombre: 'Anfitriona', ruta: '/admin/leads/anfitriona', posventa: true },
]

export function nombreEmbudo(clave) {
  return EMBUDOS.find(e => e.clave === clave)?.nombre || clave
}

// Etapas que se usan mientras no se cargan las de la base (o si todavía no se
// corrió la migración): las cuatro de siempre, en el embudo de Paquetes.
export const ETAPAS_POR_DEFECTO = [
  { clave: 'nuevo', nombre: 'Nueva consulta', orden: 1, color: '#8b8fe8', tipo: 'abierta', embudo: 'paquetes' },
  { clave: 'contactado', nombre: 'Filtrado', orden: 2, color: '#7ec4f2', tipo: 'abierta', embudo: 'paquetes' },
  { clave: 'reservado', nombre: 'Ya pagó, reserva confirmada', orden: 3, color: '#34c38f', tipo: 'ganada', embudo: 'paquetes' },
  { clave: 'perdido', nombre: 'Perdido', orden: 4, color: '#9ca3af', tipo: 'perdida', embudo: 'paquetes' },
]

// Etapas que el sistema usa por su nombre interno y no se pueden borrar: la
// primera de cada embudo (donde entran los leads nuevos: WhatsApp, formulario,
// "lead rápido"), la ganada que se marca al convertir un lead en cliente y la de
// los que no compraron. "anfitriona" también es fija: un lead que llega ahí se
// redirige solo a "anfitriona_asignada" (ver la migración del embudo de Anfitriona).
export const CLAVES_FIJAS = [
  'nuevo', 'reservado', 'perdido', 'anfitriona',
  'paseos_contacto_inicial', 'paseos_confirmada', 'paseos_perdido',
  'anfitriona_asignada', 'anfitriona_confirmada', 'anfitriona_perdido',
]

export const TIPOS_ETAPA = [
  { id: 'abierta', label: 'En curso' },
  { id: 'ganada', label: 'Ganada (ya pagó)' },
  { id: 'perdida', label: 'Perdida' },
]

function posicionEmbudo(clave) {
  const i = EMBUDOS.findIndex(e => e.clave === (clave || 'paquetes'))
  return i < 0 ? EMBUDOS.length : i
}

// Etapas de todos los embudos: primero las de Paquetes, después las de Paseos, y
// dentro de cada uno por orden.
function ordenarEtapas(lista) {
  return [...lista].sort((a, b) => posicionEmbudo(a.embudo) - posicionEmbudo(b.embudo) || a.orden - b.orden)
}

export function useEtapas() {
  const [etapas, setEtapas] = useState(ETAPAS_POR_DEFECTO)
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(async () => {
    const res = await embudoApi.getAll()
    if (res?.data?.length) setEtapas(ordenarEtapas(res.data))
    setCargando(false)
  }, [])

  useEffect(() => { recargar() }, [recargar])
  return { etapas, cargando, recargar }
}

export function etapaDe(etapas, clave) {
  return etapas.find(e => e.clave === clave)
}

// Las etapas de un embudo, en su orden. Las que no dicen a qué embudo pertenecen
// (antes de la migración) son de Paquetes.
export function etapasDelEmbudo(etapas, embudo) {
  return etapas.filter(e => (e.embudo || 'paquetes') === embudo).sort((a, b) => a.orden - b.orden)
}

export function embudoDeEtapa(etapa) {
  return etapa?.embudo || 'paquetes'
}

// La primera etapa de cada embudo de venta (no cuenta los de posventa, como
// Anfitriona: esos leads no son "nuevos", ya se vendieron)
export function clavesDeEntrada(etapas) {
  return EMBUDOS.filter(e => !e.posventa).map(e => etapasDelEmbudo(etapas, e.clave)[0]?.clave).filter(Boolean)
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
