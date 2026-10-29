// Alertas de operaciones (2026-10-29): carga los datos una sola vez para todo el panel y los
// comparte con la campanita, la tarjeta del Dashboard y la pantalla de configuración.
// Cuando aparece una alerta que esta persona no había visto, suena y, si está en otra ventana,
// muestra una notificación del navegador. Solo avisa con el panel abierto.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { reservasApi, excursionesApi, operacionesApi, choferesApi, guiasApi } from './supabase.js'
import { useSincronizado } from './useSincronizado.js'
import { calcularAlertas, cargarConfigAlertas, configCompleta, hoyBrasil } from './alertas.js'
import { sonar, mostrarNotificacion, parpadearTitulo, tienePestanaEnfoque } from './avisosMensajes.js'

const CLAVE_SONIDO = 'alertas_sonido'
const CLAVE_VISTAS = 'alertas_vistas'
const TABLAS = ['reservas', 'operaciones', 'operaciones_avisos']

function leerSonido() {
  try { return localStorage.getItem(CLAVE_SONIDO) !== 'off' } catch { return true }
}
function leerVistas() {
  try { return new Set(JSON.parse(localStorage.getItem(CLAVE_VISTAS) || '[]')) } catch { return new Set() }
}
function guardarVistas(ids) {
  try { localStorage.setItem(CLAVE_VISTAS, JSON.stringify([...ids].slice(-500))) } catch { /* sin almacenamiento */ }
}

const Contexto = createContext(null)

export function AlertasProvider({ habilitado, navigate, children }) {
  const [datos, setDatos] = useState(null)
  const [config, setConfig] = useState(() => configCompleta(null))
  const [columnaFalta, setColumnaFalta] = useState(false)
  const [error, setError] = useState(false)
  const [ahora, setAhora] = useState(() => new Date())
  const [sonidoActivo, setSonidoActivo] = useState(leerSonido)
  const [, setVersion] = useState(0)

  const cargar = useCallback(async () => {
    if (!habilitado) return
    const hoy = hoyBrasil()
    try {
      const [res, exc, ops, cho, gui, cfg] = await Promise.all([
        reservasApi.getEnCursoDesde(hoy), excursionesApi.getAll(), operacionesApi.getDesde(hoy),
        choferesApi.getAll(), guiasApi.getAll(), cargarConfigAlertas(),
      ])
      // Si no se pudieron leer las reservas no se muestra nada (mejor ninguna alerta que alertas falsas)
      if (res?.error || !Array.isArray(res?.data)) { setError(true); return }
      setError(false)
      setDatos({
        reservas: res.data, excursiones: exc?.data || [], operaciones: ops?.data || [],
        choferes: cho?.data || [], guias: gui?.data || [],
      })
      setConfig(cfg.config)
      setColumnaFalta(cfg.columnaFalta)
    } catch {
      setError(true)
    }
  }, [habilitado])

  useEffect(() => { cargar() }, [cargar])
  useSincronizado(cargar, TABLAS, { intervaloMs: 90000 })

  // Pasa el tiempo: una alerta como "falta cerrar" aparece a su hora aunque no cambie ningún dato
  useEffect(() => {
    if (!habilitado) return
    const t = setInterval(() => setAhora(new Date()), 60000)
    return () => clearInterval(t)
  }, [habilitado])

  const alertas = useMemo(() => (datos ? calcularAlertas({ ...datos, config, ahora }) : []), [datos, config, ahora])

  // Avisar solo de lo que esta persona todavía no vio
  const primeraVez = useRef(true)
  useEffect(() => {
    if (!habilitado || !datos) return
    const ids = new Set(alertas.map((a) => a.id))
    const vistas = leerVistas()
    const nuevas = alertas.filter((a) => !vistas.has(a.id))
    guardarVistas(ids) // lo resuelto deja de recordarse: si vuelve a pasar, vuelve a avisar
    if (!nuevas.length) { primeraVez.current = false; return }
    primeraVez.current = false
    if (sonidoActivo) sonar()
    if (!tienePestanaEnfoque()) {
      const titulo = nuevas.length === 1 ? 'Alerta de operaciones' : `${nuevas.length} alertas nuevas de operaciones`
      const cuerpo = nuevas.length === 1 ? nuevas[0].titulo : `${nuevas[0].titulo} y ${nuevas.length - 1} más`
      mostrarNotificacion({ titulo, cuerpo, tag: 'alertas-operaciones', alHacerClic: () => navigate?.(nuevas[0].ruta) })
      parpadearTitulo(titulo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertas, habilitado, datos])

  const alternarSonido = useCallback(() => {
    setSonidoActivo((v) => {
      const nuevo = !v
      try { localStorage.setItem(CLAVE_SONIDO, nuevo ? 'on' : 'off') } catch { /* sin almacenamiento */ }
      if (nuevo) sonar() // que se escuche cómo suena
      return nuevo
    })
  }, [])

  const permitirNotificaciones = useCallback(async () => {
    if (typeof Notification === 'undefined') return
    await Notification.requestPermission()
    setVersion((v) => v + 1)
  }, [])

  const valor = useMemo(() => ({
    habilitado, alertas, cargando: habilitado && !datos && !error, error, config, columnaFalta, recargar: cargar,
    sonidoActivo, alternarSonido, permitirNotificaciones,
  }), [habilitado, alertas, datos, error, config, columnaFalta, cargar, sonidoActivo, alternarSonido, permitirNotificaciones])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

const VACIO = {
  habilitado: false, alertas: [], cargando: false, error: false, config: configCompleta(null), columnaFalta: false,
  recargar: () => {}, sonidoActivo: false, alternarSonido: () => {}, permitirNotificaciones: () => {},
}

export function useAlertas() {
  return useContext(Contexto) || VACIO
}
