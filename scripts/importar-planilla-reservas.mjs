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
const soloNuevas = args.includes('--solo-nuevas')
if (!archivo) { console.error('Falta el archivo .xlsx'); process.exit(1) }

// ── Equivalencias (revisadas con Abril el 2026-10-13) ────────────────────────────

const norm = (t) => String(t ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ')

// Paseos: texto normalizado → { paseo, catalogo (nombre en excursiones o null), sinTraslado, obs }
const PASEOS = {
  'maragogi': { paseo: 'Maragogi', catalogo: true },
  'maragogi desde alla': { paseo: 'Maragogi', catalogo: true, obs: 'Hospedado en Maragogi' },
  'praia dos carneiros': { paseo: 'Praia dos Carneiros', catalogo: true },
  'paramotor': { paseo: 'Vuelo en Paramotor', catalogo: true },
  'carneiros': { paseo: 'Praia dos Carneiros', catalogo: true },
  'carnerios': { paseo: 'Praia dos Carneiros', catalogo: true },
  'isla de santo aleixo': { paseo: 'Isla de Santo Aleixo', catalogo: true },
  'isla santo aleixo': { paseo: 'Isla de Santo Aleixo', catalogo: true },
  'ilha de santo aleixo': { paseo: 'Isla de Santo Aleixo', catalogo: true },
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
  'buceo con cilindro': { paseo: 'Buceo con cilindro', catalogo: true },
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
const hoja = wb.Sheets['NUEVA PLANILLA'] || wb.Sheets['NUEVA_PLANILLA']
if (!hoja) { console.error('No está la pestaña "NUEVA PLANILLA" (ni "NUEVA_PLANILLA")'); process.exit(1) }
const filasCrudas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null, raw: true })
// La versión de noviembre trae una columna en blanco después de "Fecha del paseo" (antes de
// "Valor venta"): se detecta por el título y se saca, así el resto de las columnas queda igual
const desfase = Math.max(0, filasCrudas[0].findIndex(t => norm(t) === 'valor venta') - 5)
const filas = desfase ? filasCrudas.map(r => [...r.slice(0, 5), ...r.slice(5 + desfase)]) : filasCrudas

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
    // Si la celda trae más de un teléfono (separados por / | ; ,) se guardan todos, cada uno solo con
    // dígitos y unidos con " / " (así los entiende telefonos_contacto); antes se juntaban en un solo número
    cliente_whatsapp: texto(f[13]).split(/[|/;,]/).map(t => t.replace(/\D/g, '')).filter(Boolean).join(' / ') || null,
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
  ...[...unicas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.fila_excel - b.fila_excel).map(r => COLS_CSV.map(([, k]) => csvCelda(typeof k === 'function' ? k(r) : r[k])).join(';'))].join('\n')
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

// --solo-nuevas: no actualiza nada de lo que ya está cargado, solo inserta lo que no existe.
// "Ya existe" = misma clave de planilla, o misma fecha + cliente + paseo (cubre reservas cargadas
// a mano desde el panel, que no tienen clave). Cada valor lleva su tipo porque va dentro de un VALUES.
const TIPOS = ['text', 'text', 'date', 'text', 'text', 'integer', 'text', 'uuid', 'date', 'boolean', 'numeric', 'numeric', 'numeric', 'text', 'text', 'numeric', 'text', 'text', 'text', 'text']
const COLS_INS = ['clave_planilla', 'origen', 'fecha_venta', 'cliente_nombre', 'cliente_whatsapp', 'personas', 'paseo', 'excursion_id', 'fecha', 'sin_traslado', 'total', 'saldo_cliente', 'sena', 'moneda', 'chofer_texto', 'comision_chofer', 'hospedaje', 'notas', 'vendedor_texto', 'estado']
const valoresTipados = aCargar.map(r => {
  const v = [r.clave_planilla, 'planilla', r.fecha_venta, r.cliente_nombre, r.cliente_whatsapp, r.personas, r.paseo,
    r.paseo_catalogo ? `(select id from excursiones where nombre = ${sql(r.paseo_catalogo)} limit 1)` : null,
    r.fecha, r.sin_traslado, r.total, r.saldo_cliente, r.sena, r.moneda, r.chofer_texto, r.comision_chofer,
    r.hospedaje, r.notas, r.vendedor_texto, 'confirmada']
  return `  (${v.map((x, i) => i === 7 ? (x ?? 'null::uuid') : `${sql(x)}::${TIPOS[i]}`).join(', ')})`
})
const textoSqlSoloNuevas = aCargar.length ? `-- Importación de la planilla de paseos (${sello}): hasta ${aCargar.length} reservas, SOLO LAS QUE NO EXISTEN.
-- Generado por scripts/importar-planilla-reservas.mjs --solo-nuevas. Pegar entero en el SQL Editor de Supabase.
-- No modifica ninguna reserva ya cargada. Se saltea las que ya existen por clave de planilla o por
-- fecha del paseo + cliente + paseo (así tampoco duplica las que se cargaron a mano desde el panel).
begin;
insert into reservas (${COLS_INS.join(', ')})
select v.* from (values
${valoresTipados.join(',\n')}
) as v(${COLS_INS.join(', ')})
where not exists (
  select 1 from reservas x
   where x.clave_planilla = v.clave_planilla
      or (x.fecha = v.fecha and lower(btrim(x.cliente_nombre)) = lower(btrim(v.cliente_nombre)) and x.paseo = v.paseo)
);
commit;
` : '-- No hay nada para cargar.\n'

const textoSql = soloNuevas ? textoSqlSoloNuevas : aCargar.length ? `-- Importación de la planilla de paseos (${sello}): ${aCargar.length} reservas (${aCargar.filter(r => r.situacion === 'nueva').length} nuevas, ${aCargar.filter(r => r.situacion === 'cambió').length} con cambios).
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

// ── Clientes (solo con --clientes) ───────────────────────────────────────────
// Segundo SQL, para correr DESPUÉS del de reservas. Crea la ficha de cliente de quien todavía no la
// tiene y une sus reservas de la planilla. Solo con teléfono claro (un solo número, con código de
// país y largo normal): el resto va a un CSV aparte para revisar, nunca se crea a ciegas.
// Para saber si ya existe usa telefonos_contacto() (con y sin el 9 argentino), igual que el resto
// del sistema; la columna whatsapp de clientes además es única, así que no puede quedar repetido.
if (args.includes('--clientes')) {
  const telClaro = (t) => !!t && !t.includes(' / ') && t.length >= 11 && t.length <= 13 && /^(54|55|56|57|58|51|52|34|59\d)/.test(t)
  const porTel = new Map()
  const dudosos = []
  for (const r of [...unicas].sort((a, b) => a.fila_excel - b.fila_excel)) {
    const sinNombre = !r.cliente_nombre || r.cliente_nombre === 'Sin nombre'
    if (!telClaro(r.cliente_whatsapp) || sinNombre) {
      dudosos.push([r.fila_excel, r.cliente_nombre, r.cliente_whatsapp || '', !r.cliente_whatsapp ? 'Sin teléfono' : sinNombre ? 'Sin nombre' : r.cliente_whatsapp.includes(' / ') ? 'Más de un teléfono en la celda' : 'Teléfono dudoso (largo o código de país)'])
      continue
    }
    if (!porTel.has(r.cliente_whatsapp)) porTel.set(r.cliente_whatsapp, { nombre: r.cliente_nombre, nombres: new Set() })
    porTel.get(r.cliente_whatsapp).nombres.add(r.cliente_nombre)
  }
  for (const [tel, v] of porTel) if (v.nombres.size > 1) dudosos.push(['', [...v.nombres].join(' / '), tel, 'Informativo: mismo teléfono con varios nombres; se crea con el primero'])
  const tels = [...porTel.keys()]
  const filasCli = tels.map(t => `  (${sql(t)}::text, ${sql(porTel.get(t).nombre)}::text)`)
  const sqlClientes = tels.length ? `-- Clientes de la planilla de paseos (${sello}): ${tels.length} teléfonos claros. Correr DESPUÉS de importacion-${sello}.sql.
-- 1) Crea el cliente solo si no existe ninguno con ese teléfono (con o sin el 9 argentino).
-- 2) Une a ese cliente sus reservas de la planilla que no tenían cliente.
-- 3) Recalcula cantidad_reservas de esos clientes.
-- No toca clientes que ya existían (salvo recalcular su cantidad_reservas).
begin;
insert into clientes (nombre, whatsapp, origen, lead_id)
select n.nombre, n.tel, 'Planilla paseos',
       (select l.id from leads l where regexp_replace(coalesce(l.whatsapp, ''), '\\D', '', 'g') = any (telefonos_contacto(n.tel)) order by l.created_at desc limit 1)
from (values
${filasCli.join(',\n')}
) as n(tel, nombre)
where not exists (
  select 1 from clientes c where regexp_replace(coalesce(c.whatsapp, ''), '\\D', '', 'g') = any (telefonos_contacto(n.tel))
)
on conflict (whatsapp) do nothing;

update reservas r set cliente_id = (
  select c.id from clientes c
   where regexp_replace(coalesce(c.whatsapp, ''), '\\D', '', 'g') = any (telefonos_contacto(r.cliente_whatsapp))
   order by c.created_at limit 1)
 where r.cliente_id is null and r.origen = 'planilla'
   and r.cliente_whatsapp in (${tels.map(sql).join(', ')});

update clientes c set cantidad_reservas = (select count(*) from reservas r where r.cliente_id = c.id)
 where c.id in (select cliente_id from reservas where origen = 'planilla' and cliente_whatsapp in (${tels.map(sql).join(', ')}) and cliente_id is not null);
commit;
` : '-- No hay clientes claros para crear.\n'
  writeFileSync(join(carpeta, `clientes-${sello}.sql`), sqlClientes)
  writeFileSync(join(carpeta, `clientes-a-revisar-${sello}.csv`), '﻿' + ['Fila Excel;Cliente;Teléfono;Motivo', ...dudosos.map(d => d.map(csvCelda).join(';'))].join('\n'))
  console.log(JSON.stringify({ clientes_claros_para_crear_o_unir: tels.length, a_revisar_o_informativos: dudosos.length }))
}

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
