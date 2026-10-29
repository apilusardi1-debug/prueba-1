// Alertas de operaciones (pedido de Cristian, 2026-10-29). Se calculan en la pantalla con lo que ya
// hay cargado (reservas, operaciones cerradas, avisos a guías y choferes): no hay tareas
// programadas ni nada que toque el CRM. Solo se ven con el panel abierto.
// La configuración (qué reglas están prendidas y con qué números) vive en site_config.alertas_config
// (migración 20261029110000_alertas_config.sql) y se cambia en Configuración > Alertas.
//
// calcularAlertas es una función pura: recibe los datos y la configuración y devuelve la lista.
import { supabase, guardarSiteConfig } from './supabase.js'
import { claveTexto, saldoDe, formatMonto, fechaCorta } from './reservasPlanilla.js'

// ── Reglas y valores de fábrica ─────────────────────────────────────────────────────────────
// campos: lo que se puede ajustar de cada regla (clave dentro de su configuración).
export const REGLAS = [
  {
    clave: 'cerrar_manana', titulo: 'Operaciones de mañana sin cerrar',
    descripcion: 'Avisa cuando quedan paseos de mañana sin cerrar la operación, pasada cierta hora.',
    campos: [{ clave: 'hora', etiqueta: 'A partir de las', unidad: 'hs', min: 0, max: 23, defecto: 17 }],
  },
  {
    clave: 'sin_chofer', titulo: 'Reservas sin chofer',
    descripcion: 'Un paseo próximo tiene reservas que todavía no tienen chofer asignado.',
    campos: [{ clave: 'dias', etiqueta: 'Paseos de los próximos', unidad: 'días', min: 0, max: 30, defecto: 2 }],
  },
  {
    clave: 'sin_guia', titulo: 'Paseos sin guía',
    descripcion: 'Un paseo próximo del catálogo no tiene guía asignado.',
    campos: [{ clave: 'dias', etiqueta: 'Paseos de los próximos', unidad: 'días', min: 0, max: 30, defecto: 2 }],
  },
  {
    clave: 'aviso_sin_abrir', titulo: 'Chofer o guía sin abrir el aviso',
    descripcion: 'Un aviso de operación lleva varias horas mandado y el guía o chofer no lo abrió o no tocó "Recebido".',
    campos: [{ clave: 'horas', etiqueta: 'Pasadas', unidad: 'horas', min: 1, max: 48, defecto: 3 }],
  },
  {
    clave: 'saldo_pendiente', titulo: 'Saldo pendiente de cobro',
    descripcion: 'Un paseo próximo tiene reservas con saldo del cliente sin cobrar.',
    campos: [{ clave: 'dias', etiqueta: 'Paseos de los próximos', unidad: 'días', min: 0, max: 30, defecto: 2 }],
  },
  {
    clave: 'choque_horarios', titulo: 'Choque de horarios',
    descripcion: 'Un chofer o un guía tiene dos paseos distintos a la misma hora de salida el mismo día.',
    campos: [],
  },
  {
    clave: 'datos_incompletos', titulo: 'Datos incompletos',
    descripcion: 'A una reserva próxima le falta el hospedaje o el WhatsApp del cliente.',
    campos: [{ clave: 'dias', etiqueta: 'Reservas de los próximos', unidad: 'días', min: 0, max: 30, defecto: 2 }],
  },
]

export function configPorDefecto() {
  return Object.fromEntries(REGLAS.map((r) => [r.clave, {
    activa: true,
    ...Object.fromEntries(r.campos.map((c) => [c.clave, c.defecto])),
  }]))
}

// Mezcla lo guardado con los valores de fábrica (una regla nueva no queda sin configuración) y
// deja los números dentro de su rango.
export function configCompleta(guardada) {
  const base = configPorDefecto()
  for (const r of REGLAS) {
    const g = guardada?.[r.clave] || {}
    base[r.clave].activa = g.activa !== false
    for (const c of r.campos) {
      const n = Number(g[c.clave])
      if (g[c.clave] != null && g[c.clave] !== '' && Number.isFinite(n)) base[r.clave][c.clave] = Math.min(c.max, Math.max(c.min, Math.round(n)))
    }
  }
  return base
}

// Devuelve { config, columnaFalta }. Si la migración todavía no se corrió, usa los valores de
// fábrica y avisa para que la pantalla de configuración lo diga.
export async function cargarConfigAlertas() {
  if (!supabase) return { config: configCompleta(null), columnaFalta: false }
  const { data, error } = await supabase.from('site_config').select('alertas_config').eq('id', 1).maybeSingle()
  if (error) return { config: configCompleta(null), columnaFalta: true }
  return { config: configCompleta(data?.alertas_config), columnaFalta: false }
}

export async function guardarConfigAlertas(config) {
  return guardarSiteConfig({ alertas_config: configCompleta(config) })
}

// ── Fechas y horas (siempre hora de Brasil) ─────────────────────────────────────────────────
const ZONA = 'America/Recife'

export function hoyBrasil(ahora = new Date()) {
  return ahora.toLocaleDateString('en-CA', { timeZone: ZONA })
}

export function sumarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function horaActualBrasil(ahora) {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hour: 'numeric', hour12: false }).format(ahora)
  return Number(h) % 24
}

// '8:00 AM' -> '08:00', '2:30 PM' -> '14:30'; ya en 24 hs queda igual; si no se entiende, ''
export function hora24(txt) {
  const m = String(txt || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!m) return ''
  let h = parseInt(m[1], 10)
  const ap = (m[3] || '').toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

const unaLinea = (txt) => String(txt || '').replace(/\s+/g, ' ').trim()

function cuando(fecha, hoy) {
  if (fecha === hoy) return 'Hoy'
  if (fecha === sumarDias(hoy, 1)) return 'Mañana'
  return fechaCorta(fecha)
}

// ── Cálculo ─────────────────────────────────────────────────────────────────────────────────
// reservas: filas de reservas (con su paseo, chofer y guía), de hoy en adelante
// operaciones: operaciones cerradas con sus avisos (operaciones_avisos)
// excursiones: catálogo (para la hora de salida) · choferes, guias: para los nombres
export function calcularAlertas({ reservas = [], operaciones = [], excursiones = [], choferes = [], guias = [], config, ahora = new Date() }) {
  const cfg = configCompleta(config)
  const hoy = hoyBrasil(ahora)
  const manana = sumarDias(hoy, 1)
  const catalogo = Object.fromEntries(excursiones.map((e) => [e.id, e]))
  const nombreChofer = Object.fromEntries(choferes.map((c) => [c.id, c.nombre]))
  const nombreGuia = Object.fromEntries(guias.map((g) => [g.id, g.nombre]))
  const opPorClave = Object.fromEntries(operaciones.map((o) => [`${o.excursion_id}|${o.fecha}`, o]))
  // El texto cargado (traslados, paseos fuera del catálogo), el del join o, si no, el del catálogo
  const nombrePaseo = (r) => r.paseo || r.excursiones?.nombre || catalogo[r.excursion_id]?.nombre || '—'

  const vigentes = reservas.filter((r) => r.estado !== 'cancelada' && r.fecha && r.fecha >= hoy)
  const rutaAgenda = (fecha) => `/admin/agenda?fecha=${fecha}`
  const alertas = []

  // Reservas agrupadas por paseo y fecha (= una salida / una operación)
  const salidas = new Map()
  for (const r of vigentes) {
    const gid = r.excursion_id || `paseo:${claveTexto(nombrePaseo(r))}`
    const clave = `${gid}|${r.fecha}`
    if (!salidas.has(clave)) salidas.set(clave, { gid, excursionId: r.excursion_id, fecha: r.fecha, nombre: nombrePaseo(r), reservas: [] })
    salidas.get(clave).reservas.push(r)
  }
  const personas = (s) => s.reservas.reduce((a, r) => a + (Number(r.personas) || 1), 0)
  const dentroDe = (fecha, dias) => fecha <= sumarDias(hoy, dias)

  // 1. Operaciones de mañana sin cerrar
  if (cfg.cerrar_manana.activa && horaActualBrasil(ahora) >= cfg.cerrar_manana.hora) {
    for (const s of salidas.values()) {
      if (s.fecha !== manana || !s.excursionId || opPorClave[`${s.excursionId}|${s.fecha}`]) continue
      alertas.push({
        id: `cerrar_manana:${s.gid}:${s.fecha}`, regla: 'cerrar_manana', gravedad: 'alta', fecha: s.fecha,
        titulo: `Falta cerrar la operación: ${s.nombre}`, detalle: `Mañana · ${personas(s)} personas`, ruta: rutaAgenda(s.fecha),
      })
    }
  }

  // 2. Reservas sin chofer (las que van "sin traslado" no lo necesitan)
  if (cfg.sin_chofer.activa) {
    for (const s of salidas.values()) {
      if (!dentroDe(s.fecha, cfg.sin_chofer.dias)) continue
      const sin = s.reservas.filter((r) => !r.chofer_id && !r.sin_traslado)
      if (!sin.length) continue
      alertas.push({
        id: `sin_chofer:${s.gid}:${s.fecha}`, regla: 'sin_chofer', gravedad: s.fecha <= manana ? 'alta' : 'media', fecha: s.fecha,
        titulo: `${sin.length === 1 ? '1 reserva sin chofer' : `${sin.length} reservas sin chofer`}: ${s.nombre}`,
        detalle: `${cuando(s.fecha, hoy)} · ${sin.map((r) => unaLinea(r.cliente_nombre).split(' ')[0] || 'cliente').join(', ')}`, ruta: rutaAgenda(s.fecha),
      })
    }
  }

  // 3. Paseos del catálogo sin guía (ni en las reservas ni en la operación)
  if (cfg.sin_guia.activa) {
    for (const s of salidas.values()) {
      if (!s.excursionId || !dentroDe(s.fecha, cfg.sin_guia.dias)) continue
      const op = opPorClave[`${s.excursionId}|${s.fecha}`]
      if (op?.guia_id || s.reservas.some((r) => r.guia_id)) continue
      alertas.push({
        id: `sin_guia:${s.gid}:${s.fecha}`, regla: 'sin_guia', gravedad: s.fecha <= manana ? 'alta' : 'media', fecha: s.fecha,
        titulo: `Paseo sin guía: ${s.nombre}`, detalle: `${cuando(s.fecha, hoy)} · ${personas(s)} personas`, ruta: rutaAgenda(s.fecha),
      })
    }
  }

  // 4. Guía o chofer que no abrió el aviso, o lo abrió y no confirmó
  if (cfg.aviso_sin_abrir.activa) {
    const limite = ahora.getTime() - cfg.aviso_sin_abrir.horas * 3600 * 1000
    for (const op of operaciones) {
      if (op.fecha < hoy) continue
      const paseo = catalogo[op.excursion_id]?.nombre || 'Paseo'
      for (const a of op.operaciones_avisos || []) {
        if (a.confirmado_at || !a.created_at || Date.parse(a.created_at) > limite) continue
        const nombre = (a.destinatario === 'guia' ? nombreGuia[a.guia_id] : nombreChofer[a.chofer_id]) || (a.destinatario === 'guia' ? 'El guía' : 'El chofer')
        const abierto = !!a.leido_at
        alertas.push({
          id: `aviso:${a.id}:${abierto ? 'confirmar' : 'abrir'}`, regla: 'aviso_sin_abrir', gravedad: op.fecha <= manana ? 'alta' : 'media', fecha: op.fecha,
          titulo: abierto ? `${nombre} abrió el aviso pero no tocó "Recebido"` : `${nombre} no abrió el aviso`,
          detalle: `${paseo} · ${cuando(op.fecha, hoy)}`, ruta: rutaAgenda(op.fecha),
        })
      }
    }
  }

  // 5. Saldo pendiente
  if (cfg.saldo_pendiente.activa) {
    for (const r of vigentes) {
      if (!dentroDe(r.fecha, cfg.saldo_pendiente.dias)) continue
      const saldo = saldoDe(r)
      if (!(saldo > 0)) continue
      alertas.push({
        id: `saldo:${r.id}`, regla: 'saldo_pendiente', gravedad: 'media', fecha: r.fecha,
        titulo: `Saldo pendiente: ${r.cliente_nombre || 'cliente'}`,
        detalle: `${nombrePaseo(r)} · ${cuando(r.fecha, hoy)} · ${formatMonto(saldo, r.moneda || 'BRL')}`, ruta: '/admin/reservas',
      })
    }
  }

  // 6. Choque de horarios: la misma persona en dos salidas distintas a la misma hora el mismo día
  if (cfg.choque_horarios.activa) {
    const porPersona = new Map() // `${tipo}|${id}|${fecha}|${hora}` -> salidas
    const sumar = (tipo, id, s) => {
      const hora = hora24(catalogo[s.excursionId]?.hora_salida)
      if (!id || !hora) return
      const k = `${tipo}|${id}|${s.fecha}|${hora}`
      if (!porPersona.has(k)) porPersona.set(k, new Map())
      porPersona.get(k).set(s.gid, s)
    }
    for (const s of salidas.values()) {
      if (!s.excursionId) continue // traslados y paseos fuera del catálogo no tienen hora cargada
      const op = opPorClave[`${s.excursionId}|${s.fecha}`]
      for (const id of new Set(s.reservas.map((r) => r.chofer_id).filter(Boolean))) sumar('chofer', id, s)
      for (const id of new Set([op?.guia_id, ...s.reservas.map((r) => r.guia_id)].filter(Boolean))) sumar('guia', id, s)
    }
    for (const [k, grupo] of porPersona) {
      if (grupo.size < 2) continue
      const [tipo, id, fecha, hora] = k.split('|')
      const nombre = (tipo === 'chofer' ? nombreChofer[id] : nombreGuia[id]) || (tipo === 'chofer' ? 'Un chofer' : 'Un guía')
      alertas.push({
        id: `choque:${k}`, regla: 'choque_horarios', gravedad: fecha <= manana ? 'alta' : 'media', fecha,
        titulo: `${nombre} tiene ${grupo.size} paseos a las ${hora}`,
        detalle: `${[...grupo.values()].map((s) => s.nombre).join(' y ')} · ${cuando(fecha, hoy)}`, ruta: rutaAgenda(fecha),
      })
    }
  }

  // 7. Datos incompletos
  if (cfg.datos_incompletos.activa) {
    for (const r of vigentes) {
      if (!dentroDe(r.fecha, cfg.datos_incompletos.dias)) continue
      const falta = []
      if (!r.sin_traslado && !unaLinea(r.hospedaje)) falta.push('hospedaje')
      if (String(r.cliente_whatsapp || '').replace(/\D/g, '').length < 10) falta.push('WhatsApp del cliente')
      if (!falta.length) continue
      alertas.push({
        id: `datos:${r.id}`, regla: 'datos_incompletos', gravedad: r.fecha <= manana ? 'alta' : 'media', fecha: r.fecha,
        titulo: `Falta ${falta.join(' y ')}: ${r.cliente_nombre || 'cliente'}`,
        detalle: `${nombrePaseo(r)} · ${cuando(r.fecha, hoy)}`, ruta: '/admin/reservas',
      })
    }
  }

  const peso = { alta: 0, media: 1 }
  return alertas.sort((a, b) => peso[a.gravedad] - peso[b.gravedad] || a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo, 'es'))
}
