// Importa la planilla de Excel del equipo de paquetes ("PLANILLA VIAJES", pestañas VIAJES y
// YA SE FUERON) a la tabla viajes_paquetes (admin: Paquetes > Planilla), mientras el equipo
// siga cargando en el Excel. NO tiene datos: los lee del archivo que se le pasa y escribe todo
// en la carpeta de ese archivo (fuera del repo, porque son datos de clientes).
//
// Uso:
//   (la librería xlsx no es dependencia del proyecto: en la Mac de Abril está en
//   ~/Desktop/reservas-paseos/.herramientas/node_modules/xlsx)
//   XLSX_PATH=<carpeta>/node_modules/xlsx node scripts/importar-planilla-paquetes.mjs \
//     "<carpeta privada>/archivo.xlsm" [--anterior <importacion-previa.json>]
//
// Escribe, junto al Excel:
//   vista-previa-<fecha>.csv   una fila por viaje, con la columna "A revisar" (se abre en Excel)
//   importacion-<fecha>.sql    para pegar en el SQL Editor de Supabase (inserta lo nuevo y
//                              actualiza lo que cambió)
//   importacion-<fecha>.json   foto de lo importado, para comparar la próxima actualización
//
// Columnas: ver supabase/migrations/20261015100000_viajes_paquetes_planilla.sql

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
const anterior = opcion('--anterior') ? JSON.parse(readFileSync(opcion('--anterior'), 'utf8')) : null
if (!archivo) { console.error('Falta el archivo .xlsm'); process.exit(1) }

const norm = (t) => String(t ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')
const texto = (c) => String(c?.w ?? c?.v ?? '').trim()

// Fecha: las celdas de fecha llegan como Date (Excel guarda la hora local de Brasil)
const iso = (c) => c?.v instanceof Date ? new Date(c.v.getTime() + 12 * 3600e3).toISOString().slice(0, 10) : null

// Hora: "8:30:00 PM" o "09:55" → "20:30" / "09:55"; lo que no es hora ("preguntar", "-") queda como está
function hora(c) {
  const t = texto(c)
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i.exec(t)
  if (!m) return t && !/^[-_]+$/.test(t) ? t : null
  let h = Number(m[1])
  if (m[3]) h = (h % 12) + (/pm/i.test(m[3]) ? 12 : 0)
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

// Saldo: número, o texto tipo "$6.900" / "$ 0.00"; lo demás ("Consultar") va a observaciones
function monto(c) {
  if (c == null) return { valor: null }
  if (typeof c.v === 'number') return { valor: c.v }
  const t = texto(c)
  if (!t) return { valor: null }
  const m = /^\s*(?:r\$|\$)?\s*([\d.,]+)\s*$/i.exec(t)
  if (!m) return { valor: null, texto: t }
  let n = m[1]
  n = /,\d{2}$/.test(n) ? n.replace(/\./g, '').replace(',', '.') : /\.\d{2}$/.test(n) ? n.replace(/,/g, '') : n.replace(/[.,]/g, '')
  return { valor: Number(n) }
}

// Teléfono: los números largos Excel los guarda como número (y los muestra 5.49116E+12)
function contactoCliente(c) {
  if (c == null) return null
  if (typeof c.v === 'number') return '+' + String(Math.round(c.v))
  return texto(c) || null
}

const wb = XLSX.readFile(archivo, { cellDates: true })
const HOJAS = wb.SheetNames.filter(n => ['viajes', 'ya se fueron'].includes(norm(n)))
if (!HOJAS.length) { console.error('No están las pestañas VIAJES / YA SE FUERON'); process.exit(1) }

const viajes = []
for (const nombreHoja of HOJAS) {
  const ws = wb.Sheets[nombreHoja]
  const rango = XLSX.utils.decode_range(ws['!ref'])
  for (let fila = 1; fila <= rango.e.r; fila++) {
    const celda = (col) => ws[XLSX.utils.encode_cell({ r: fila, c: col })]
    const nombre = texto(celda(2))
    const fechaLlegada = iso(celda(1))
    if (!nombre && !fechaLlegada) continue
    const revisar = []
    const obs = []
    if (texto(celda(9))) obs.push(texto(celda(9)))

    const s = monto(celda(7))
    if (s.texto) { obs.push(`Saldo: ${s.texto}`); revisar.push('Saldo con texto') }
    const usd = /usd|u\$s|us\$|dolar|dólar/i.test(texto(celda(7)))

    // En YA SE FUERON la columna 8 no tiene título ("Columna9") y en VIAJES es LLAVE PIX
    const pix = texto(celda(8)) || null
    const personas = parseInt(texto(celda(3)), 10)
    const fechaRegreso = iso(celda(5))
    if (!nombre) revisar.push('Sin nombre de cliente')
    if (!fechaLlegada) revisar.push('Sin fecha de viaje')
    if (!fechaRegreso) revisar.push('Sin fecha de regreso')
    if (fechaLlegada && fechaRegreso && fechaRegreso < fechaLlegada) revisar.push('Regreso antes que la llegada')
    if (!(personas > 0)) revisar.push('Cantidad vacía')

    const link = celda(11)
    const v = {
      hoja: nombreHoja.trim(),
      fila_excel: fila + 1,
      hora_llegada: hora(celda(0)),
      fecha_llegada: fechaLlegada,
      cliente_nombre: nombre || 'Sin nombre',
      personas: personas > 0 ? personas : null,
      hospedaje: texto(celda(4)) || null,
      fecha_regreso: fechaRegreso,
      hora_regreso: hora(celda(6)),
      saldo: s.valor,
      moneda: usd ? 'USD' : 'BRL',
      llave_pix: pix,
      observaciones: obs.join(' · ') || null,
      contacto_hospedaje: texto(celda(10)) || null,
      detalles_texto: texto(link) || null,
      detalles_url: link?.l?.Target || (/^https?:\/\//.test(texto(link)) ? texto(link) : null),
      cliente_contacto: contactoCliente(celda(12)),
      info_extra: texto(celda(13)) || null,
      revisar,
    }
    // La fila del Excel se reconoce por cliente + fecha de viaje (no por pestaña: cuando un
    // viaje pasa de VIAJES a YA SE FUERON sigue siendo el mismo)
    v.clave_planilla = createHash('sha1').update([norm(nombre), fechaLlegada].join('|')).digest('hex').slice(0, 20)
    viajes.push(v)
  }
}

// Dos filas con la misma clave serían el mismo viaje para las actualizaciones: se marcan
const porClave = new Map()
for (const v of viajes) {
  if (porClave.has(v.clave_planilla)) {
    const otra = porClave.get(v.clave_planilla)
    v.revisar.push(`Igual a ${otra.hoja} fila ${otra.fila_excel} (cliente y fecha de viaje): se carga una sola vez`)
  } else porClave.set(v.clave_planilla, v)
}
const unicos = [...porClave.values()]

// ── Comparación con la importación anterior ─────────────────────────────────

const CAMPOS = ['hora_llegada', 'fecha_llegada', 'cliente_nombre', 'personas', 'hospedaje', 'fecha_regreso', 'hora_regreso', 'saldo', 'moneda', 'llave_pix', 'observaciones', 'contacto_hospedaje', 'detalles_texto', 'detalles_url', 'cliente_contacto', 'info_extra']
const previos = new Map((anterior?.viajes || []).map(v => [v.clave_planilla, v]))
for (const v of unicos) {
  const antes = previos.get(v.clave_planilla)
  v.situacion = !antes ? 'nuevo' : CAMPOS.some(c => JSON.stringify(antes[c]) !== JSON.stringify(v[c])) ? 'cambió' : 'igual'
  if (antes && v.situacion === 'cambió') v.cambios = CAMPOS.filter(c => JSON.stringify(antes[c]) !== JSON.stringify(v[c]))
}
const desaparecidos = anterior ? [...previos.values()].filter(v => !porClave.has(v.clave_planilla)) : []

// ── Salida ──────────────────────────────────────────────────────────────────

const carpeta = dirname(archivo)
const sello = hoy

const csvCelda = (x) => { const s = x == null ? '' : String(x); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const COLS_CSV = [
  ['Pestaña', 'hoja'], ['Fila Excel', 'fila_excel'], ['Situación', 'situacion'], ['A revisar', v => v.revisar.join(' | ')],
  ['Hora llegada', 'hora_llegada'], ['Fecha viaje', 'fecha_llegada'], ['Cliente', 'cliente_nombre'], ['Cant.', 'personas'],
  ['Hospedaje', 'hospedaje'], ['Fecha regreso', 'fecha_regreso'], ['Hora regreso', 'hora_regreso'],
  ['Saldo', 'saldo'], ['Moneda', 'moneda'], ['Llave PIX', 'llave_pix'], ['Observaciones', 'observaciones'],
  ['Contacto hospedaje', 'contacto_hospedaje'], ['Detalles', 'detalles_texto'], ['Link detalles', 'detalles_url'],
  ['Contacto cliente', 'cliente_contacto'], ['Info extra', 'info_extra'], ['Qué cambió', v => (v.cambios || []).join(', ')],
]
const csv = [COLS_CSV.map(c => c[0]).join(';'),
  ...[...unicos].sort((a, b) => String(a.fecha_llegada).localeCompare(String(b.fecha_llegada)))
    .map(v => COLS_CSV.map(([, k]) => csvCelda(typeof k === 'function' ? k(v) : v[k])).join(';'))].join('\n')
writeFileSync(join(carpeta, `vista-previa-${sello}.csv`), '﻿' + csv)

const sql = (x) => x == null ? 'null' : typeof x === 'number' ? String(x) : `'${String(x).replace(/'/g, "''")}'`
const aCargar = unicos.filter(v => v.situacion !== 'igual')
const COLS_SQL = ['clave_planilla', 'origen', ...CAMPOS]
const valores = aCargar.map(v => `  (${COLS_SQL.map(c => sql(c === 'origen' ? 'planilla' : v[c])).join(', ')})`)
const textoSql = aCargar.length ? `-- Importación de la planilla de paquetes (${sello}): ${aCargar.length} viajes (${aCargar.filter(v => v.situacion === 'nuevo').length} nuevos, ${aCargar.filter(v => v.situacion === 'cambió').length} con cambios).
-- Generado por scripts/importar-planilla-paquetes.mjs. Pegar entero en el SQL Editor de Supabase.
-- Los que ya estaban (misma clave_planilla) se actualizan.
begin;
insert into viajes_paquetes (${COLS_SQL.join(', ')})
values
${valores.join(',\n')}
on conflict (clave_planilla) where clave_planilla is not null do update set
${CAMPOS.map(c => `  ${c} = excluded.${c}`).join(',\n')},
  updated_at = now();
commit;
` : '-- No hay nada nuevo ni con cambios para cargar.\n'
writeFileSync(join(carpeta, `importacion-${sello}.sql`), textoSql)
writeFileSync(join(carpeta, `importacion-${sello}.json`), JSON.stringify({ fecha: sello, viajes: unicos }, null, 1))

// Resumen (sin datos de clientes): para mostrar en la conversación
const cuenta = (fn) => { const c = {}; unicos.forEach(v => { const k = fn(v); c[k] = (c[k] || 0) + 1 }); return c }
console.log(JSON.stringify({
  filas: viajes.length, viajes_unicos: unicos.length,
  por_pestana: cuenta(v => v.hoja),
  ya_se_fueron: unicos.filter(v => (v.fecha_regreso || v.fecha_llegada || '') < hoy).length,
  situacion: cuenta(v => v.situacion), a_cargar: aCargar.length,
  desaparecidos_del_excel: desaparecidos.length,
  a_revisar: unicos.filter(v => v.revisar.length).length,
  motivos: (() => { const c = {}; unicos.forEach(v => v.revisar.forEach(m => { const k = m.replace(/(VIAJES|YA SE FUERON) fila \d+/, '… fila …'); c[k] = (c[k] || 0) + 1 })); return c })(),
  con_link_detalles: unicos.filter(v => v.detalles_url).length,
  con_saldo_pendiente: unicos.filter(v => v.saldo > 0).length,
  en_usd: unicos.filter(v => v.moneda === 'USD').length,
}, null, 1))
