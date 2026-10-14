// Importa la planilla de Excel del equipo de paseos ("NUEVA PLANILLA") a la tabla
// reservas, mientras el equipo siga cargando en el Excel. NO tiene datos: los lee del
// archivo que se le pasa y escribe todo en la carpeta de ese archivo (fuera del repo,
// porque son datos de clientes).
//
// Uso:
//   (la librería xlsx no es dependencia del proyecto: en la Mac de Abril está en
//   ~/Desktop/reservas-paseos/.herramientas/node_modules/xlsx)
//   XLSX_PATH=<carpeta>/node_modules/xlsx node scripts/importar-planilla-reservas.mjs \
//     "<carpeta privada>/archivo.xlsx" [--desde AAAA-MM-DD] [--anterior <importacion-previa.json>]
//
// Escribe, junto al Excel:
//   vista-previa-<fecha>.csv   una fila por reserva, con la columna "A revisar" (se abre en Excel)
//   importacion-<fecha>.sql    para pegar en el SQL Editor de Supabase (inserta lo nuevo y
//                              actualiza lo que cambió; no toca estado, chofer ni guía
//                              asignados desde la Agenda)
//   importacion-<fecha>.json   foto de lo importado, para comparar la próxima actualización
//
// Solo entran las reservas con fecha del paseo desde --desde (por defecto, hoy).
// Columnas: ver supabase/migrations/20261014100000_reservas_planilla_paseos.sql

import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const XLSX = require(process.env.XLSX_PATH || 'xlsx')

const args = process.argv.slice(2)
const archivo = args[0]
const opcion = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' })
const desde = opcion('--desde') || hoy
const anterior = opcion('--anterior') ? JSON.parse(readFileSync(opcion('--anterior'), 'utf8')) : null
if (!archivo) { console.error('Falta el archivo .xlsx'); process.exit(1) }

// ── Equivalencias (revisadas con Abril el 2026-10-13) ────────────────────────────

const norm = (t) => String(t ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')

// Paseos: texto normalizado → { paseo, catalogo (nombre en excursiones o null), sinTraslado, obs }
const PASEOS = {
  'maragogi': { paseo: 'Maragogi', catalogo: true },
  'carneiros': { paseo: 'Praia dos Carneiros', catalogo: true },
  'carnerios': { paseo: 'Praia dos Carneiros', catalogo: true },
  'isla de santo aleixo': { paseo: 'Isla de Santo Aleixo', catalogo: true },
  'isla santo aleixo': { paseo: 'Isla de Santo Aleixo', catalogo: true },
  'isla': { paseo: 'Isla de Santo Aleixo', catalogo: true },
  'isla de santo aleixo lancha': { paseo: 'Isla de Santo Aleixo', catalogo: true, sinTraslado: true, obs: 'En lancha' },
  'isla en su auto': { paseo: 'Isla de Santo Aleixo', catalogo: true, sinTraslado: true, obs: 'Van en su auto' },
  'buggy': { paseo: 'Paseo en Buggy', catalogo: true },
  'buggi': { paseo: 'Paseo en Buggy', catalogo: true },
  'buggy por la tarde': { paseo: 'Paseo en Buggy', catalogo: true, obs: 'Por la tarde' },
  'buggy+kayak': { paseo: 'Paseo en Buggy + Kayak', catalogo: false },
  'cuadriciclo': { paseo: 'Paseo en Quad', catalogo: true },
  'kayak': { paseo: 'Kayak a las piscinas naturales', catalogo: true },
  'buceo': { paseo: 'Buceo con cilindro', catalogo: true },
  'surf': { paseo: 'Clase de Surf', catalogo: true },
  'catamaran-maragogi': { paseo: 'Maragogi', catalogo: true, sinTraslado: true, obs: 'Catamarán, van por su cuenta' },
  'catamaran maragogi': { paseo: 'Maragogi', catalogo: true, sinTraslado: true, obs: 'Catamarán, van por su cuenta' },
  'jangada': { paseo: 'Jangada', catalogo: false },
}

// Lugares de los traslados ("porto-aeroporto"); "aeroporto" a secas es Recife
const LUGARES = {
  'porto': 'Porto', 'porto de galinhas': 'Porto', 'portp': 'Porto',
  'aeroporto': 'Aeropuerto Recife', 'aeropuerto': 'Aeropuerto Recife', 'aeroporto recife': 'Aeropuerto Recife',
  'aeroporto maceio': 'Aeropuerto Maceió', 'hotel maceio': 'Hotel Maceió', 'maceio': 'Maceió',
  'maragogi': 'Maragogi',
  'aeroporto noronha': 'Aeropuerto Noronha', 'noronha': 'Noronha', 'nornoha': 'Noronha', 'hospedaje': 'Hospedaje',
  'joa pessoa': 'João Pessoa', 'joao pessoa': 'João Pessoa',
}

function traducirPaseo(original) {
  const n = norm(original)
  if (PASEOS[n]) return { ...PASEOS[n], conocido: true }
  const partes = n.replace(/^traslado\s+/, '').split(/\s*-\s*/)
  if (partes.length === 2 && LUGARES[partes[0]] && LUGARES[partes[1]]) {
    return { paseo: `Traslado ${LUGARES[partes[0]]} → ${LUGARES[partes[1]]}`, catalogo: false, conocido: true }
  }
  return { paseo: String(original ?? '').trim(), catalogo: false, conocido: false }
}

const capitalizar = (t) => String(t ?? '').trim().toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, e, l) => e + l.toUpperCase())

function traducirChofer(original) {
  const n = norm(original)
  if (!n) return { chofer: null }
  if (n === 'van en su auto' || n === 'tienen auto') return { chofer: null, sinTraslado: true, obs: 'Van en su auto' }
  if (n === 'van de tiago') return { chofer: 'Tiago', obs: 'Van' }
  const conGuia = /\s+y\s+guia$/.test(n)
  const base = n.replace(/\s+y\s+guia$/, '').replace(/^loudes$/, 'lourdes')
  return { chofer: capitalizar(base) + (conGuia ? ' + guía' : '') }
}

function traducirVendedor(original) {
  let n = norm(original)
  if (!n) return null
  if (/^dream ?tours$/.test(n)) return 'DreamTours'
  n = n.replace(/\b(fran|fancisco|francsico|francisco)\b/g, 'francisco')
  return capitalizar(n).replace(/ Y /g, ' y ')
}

// ── Lectura ──────────────────────────────────────────────────────────────────

const iso = (v) => v instanceof Date ? new Date(v.getTime() + 12 * 3600e3).toISOString().slice(0, 10) : null
const monto = (v) => {
  if (typeof v === 'number') return v
  const m = /^\s*(?:r\$|\$)?\s*([\d.,]+)\s*$/i.exec(String(v ?? ''))
  if (!m) return null
  return Number(m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
}
const texto = (v) => String(v ?? '').trim()

const wb = XLSX.readFile(archivo, { cellDates: true })
const hoja = wb.Sheets['NUEVA PLANILLA']
if (!hoja) { console.error('No está la pestaña "NUEVA PLANILLA"'); process.exit(1) }
const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null, raw: true })

const reservas = []
filas.slice(1).forEach((f, i) => {
  const fecha = iso(f[4])
  if (!fecha || fecha < desde) return
  const filaExcel = i + 2
  const revisar = []
  const obs = []
  if (texto(f[11])) obs.push(texto(f[11]))

  const p = traducirPaseo(f[3])
  if (!p.conocido) revisar.push(`Paseo sin equivalencia: "${texto(f[3])}"`)
  if (p.obs) obs.push(p.obs)
  const ch = traducirChofer(f[8])
  if (ch.obs) obs.push(ch.obs)

  const usd = [f[5], f[6], f[7], f[9], f[12], f[11]].some(v => /usd|u\$s|us\$|dolar|dólar/i.test(texto(v)))

  // Montos: si en la celda hay texto en vez de un número, el texto pasa a observaciones
  const leerMonto = (v, nombre) => {
    if (v === null || texto(v) === '') return null
    const m = monto(v)
    if (m === null) { obs.push(`${nombre}: ${texto(v)}`); revisar.push(`${nombre} con texto`) }
    return m
  }
  const total = leerMonto(f[5], 'Valor venta')
  const saldo = leerMonto(f[7], 'Saldo cliente')
  const sena = leerMonto(f[12], 'Seña')
  const comChofer = leerMonto(f[9], 'Comisión chofer')
  if (texto(f[6])) obs.push(`Comisión Dream (en la planilla): ${texto(f[6])}`)

  if (total !== null && saldo !== null && sena !== null && Math.abs(total - saldo - sena) > 0.01) revisar.push('Venta ≠ saldo + seña')
  if (total !== null && sena === null) revisar.push('Sin seña cargada')
  if (!texto(f[1])) revisar.push('Sin nombre de cliente')
  const personas = typeof f[2] === 'number' ? f[2] : parseInt(texto(f[2]), 10)
  if (!(personas > 0)) revisar.push('Cantidad vacía')

  const r = {
    fila_excel: filaExcel,
    fecha_venta: iso(f[0]),
    cliente_nombre: texto(f[1]) || 'Sin nombre',
    personas: personas > 0 ? personas : 1,
    paseo: p.paseo,
    paseo_catalogo: p.catalogo ? p.paseo : null,
    paseo_original: texto(f[3]),
    fecha,
    sin_traslado: !!(p.sinTraslado || ch.sinTraslado),
    total: total ?? 0,
    saldo_cliente: saldo,
    sena,
    moneda: usd ? 'USD' : 'BRL',
    chofer_texto: ch.chofer,
    comision_chofer: comChofer,
    hospedaje: texto(f[10]) || null,
    notas: obs.join(' · ') || null,
    cliente_whatsapp: texto(f[13]).replace(/\D/g, '') || null,
    vendedor_texto: traducirVendedor(f[14]),
    revisar,
  }
  // La fila del Excel se reconoce por fecha de venta + cliente + paseo (como está escrito) + fecha del paseo
  r.clave_planilla = createHash('sha1').update([r.fecha_venta, norm(f[1]), norm(f[3]), fecha].join('|')).digest('hex').slice(0, 20)
  reservas.push(r)
})

// Dos filas con la misma clave serían la misma reserva para las actualizaciones: se marcan
const porClave = new Map()
for (const r of reservas) {
  if (porClave.has(r.clave_planilla)) {
    r.revisar.push(`Igual a la fila ${porClave.get(r.clave_planilla).fila_excel} (fecha de venta, cliente, paseo y fecha): se carga una sola vez`)
  } else porClave.set(r.clave_planilla, r)
}
const unicas = [...porClave.values()]

// ── Comparación con la importación anterior ─────────────────────────────────

const CAMPOS = ['fecha_venta', 'cliente_nombre', 'personas', 'paseo', 'fecha', 'sin_traslado', 'total', 'saldo_cliente', 'sena', 'moneda', 'chofer_texto', 'comision_chofer', 'hospedaje', 'notas', 'cliente_whatsapp', 'vendedor_texto']
const previas = new Map((anterior?.reservas || []).map(r => [r.clave_planilla, r]))
for (const r of unicas) {
  const antes = previas.get(r.clave_planilla)
  r.situacion = !anterior ? 'nueva' : !antes ? 'nueva' : CAMPOS.some(c => JSON.stringify(antes[c]) !== JSON.stringify(r[c])) ? 'cambió' : 'igual'
  if (antes && r.situacion === 'cambió') r.cambios = CAMPOS.filter(c => JSON.stringify(antes[c]) !== JSON.stringify(r[c]))
}
const desaparecidas = anterior ? [...previas.values()].filter(r => !porClave.has(r.clave_planilla) && r.fecha >= desde) : []

// ── Salida ──────────────────────────────────────────────────────────────────

const carpeta = dirname(archivo)
const sello = hoy

const csvCelda = (v) => { const s = v == null ? '' : String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const COLS_CSV = [
  ['Fila Excel', 'fila_excel'], ['Situación', 'situacion'], ['A revisar', r => r.revisar.join(' | ')],
  ['Fecha venta', 'fecha_venta'], ['Cliente', 'cliente_nombre'], ['Cant.', 'personas'],
  ['Paseo (Excel)', 'paseo_original'], ['Paseo (admin)', 'paseo'], ['Del catálogo', r => r.paseo_catalogo ? 'sí' : 'no'],
  ['Fecha paseo', 'fecha'], ['Sin traslado', r => r.sin_traslado ? 'sí' : ''],
  ['Valor venta', 'total'], ['Saldo cliente', 'saldo_cliente'], ['Seña', 'sena'], ['Moneda', 'moneda'],
  ['Chofer', 'chofer_texto'], ['Com. chofer', 'comision_chofer'], ['Hospedaje', 'hospedaje'],
  ['Obs.', 'notas'], ['Contacto', 'cliente_whatsapp'], ['Vendedor', 'vendedor_texto'], ['Qué cambió', r => (r.cambios || []).join(', ')],
]
const csv = [COLS_CSV.map(c => c[0]).join(';'),
  ...unicas.map(r => COLS_CSV.map(([, k]) => csvCelda(typeof k === 'function' ? k(r) : r[k])).join(';'))].join('\n')
writeFileSync(join(carpeta, `vista-previa-${sello}.csv`), '﻿' + csv)

const sql = (v) => v == null ? 'null' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`
const aCargar = unicas.filter(r => r.situacion !== 'igual')
const valores = aCargar.map(r => `  (${[
  r.clave_planilla, 'planilla', r.fecha_venta, r.cliente_nombre, r.cliente_whatsapp, r.personas, r.paseo,
].map(sql).join(', ')}, ${r.paseo_catalogo ? `(select id from excursiones where nombre = ${sql(r.paseo_catalogo)} limit 1)` : 'null'}, ${[
  r.fecha, r.sin_traslado, r.total, r.saldo_cliente, r.sena, r.moneda, r.chofer_texto, r.comision_chofer,
  r.hospedaje, r.notas, r.vendedor_texto, 'confirmada',
].map(sql).join(', ')})`)
const actualizables = ['fecha_venta', 'cliente_nombre', 'cliente_whatsapp', 'personas', 'paseo', 'excursion_id', 'fecha', 'sin_traslado', 'total', 'saldo_cliente', 'sena', 'moneda', 'chofer_texto', 'comision_chofer', 'hospedaje', 'notas', 'vendedor_texto']
const textoSql = aCargar.length ? `-- Importación de la planilla de paseos (${sello}): ${aCargar.length} reservas (${aCargar.filter(r => r.situacion === 'nueva').length} nuevas, ${aCargar.filter(r => r.situacion === 'cambió').length} con cambios).
-- Generado por scripts/importar-planilla-reservas.mjs. Pegar entero en el SQL Editor de Supabase.
-- Las que ya estaban (misma clave_planilla) se actualizan, sin tocar estado ni chofer/guía asignados en la Agenda.
begin;
insert into reservas (clave_planilla, origen, fecha_venta, cliente_nombre, cliente_whatsapp, personas, paseo, excursion_id, fecha, sin_traslado, total, saldo_cliente, sena, moneda, chofer_texto, comision_chofer, hospedaje, notas, vendedor_texto, estado)
values
${valores.join(',\n')}
on conflict (clave_planilla) where clave_planilla is not null do update set
${actualizables.map(c => `  ${c} = excluded.${c}`).join(',\n')},
  updated_at = now();
commit;
` : '-- No hay nada nuevo ni con cambios para cargar.\n'
writeFileSync(join(carpeta, `importacion-${sello}.sql`), textoSql)
writeFileSync(join(carpeta, `importacion-${sello}.json`), JSON.stringify({ fecha: sello, desde, reservas: unicas }, null, 1))

// Resumen (sin datos de clientes): para mostrar en la conversación
const cuenta = (fn) => { const c = {}; unicas.forEach(r => { const k = fn(r); c[k] = (c[k] || 0) + 1 }); return c }
console.log(JSON.stringify({
  desde, filas_desde_esa_fecha: reservas.length, reservas_unicas: unicas.length,
  situacion: cuenta(r => r.situacion), a_cargar: aCargar.length,
  desaparecidas_del_excel: desaparecidas.length,
  a_revisar: unicas.filter(r => r.revisar.length).length,
  motivos: (() => { const c = {}; unicas.forEach(r => r.revisar.forEach(m => { const k = m.replace(/".*"/, '"…"').replace(/fila \d+/, 'fila …'); c[k] = (c[k] || 0) + 1 })); return c })(),
  paseos_sin_equivalencia: [...new Set(unicas.filter(r => r.revisar.some(m => m.startsWith('Paseo sin'))).map(r => r.paseo_original))],
  paseos: cuenta(r => r.paseo), vendedores: cuenta(r => r.vendedor_texto || '(sin vendedor)'), choferes: cuenta(r => r.chofer_texto || '(sin chofer)'),
  sin_traslado: unicas.filter(r => r.sin_traslado).length, en_usd: unicas.filter(r => r.moneda === 'USD').length,
}, null, 1))
