import { useState, useEffect, useMemo, useCallback } from 'react'
import { leerHistorialAsignaciones } from '../../lib/historialAsignaciones.js'

// Quién asignó cada chat del CRM a quién y cuándo. Solo superadmin (también lo exige el servidor).
// "Manual" = lo hizo una persona desde el panel; "Automático" = el reparto, el asistente o una respuesta
// del equipo que se quedó con el chat (en esos casos no se sabe qué persona lo disparó).

const INPUT = 'border border-gray-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400'
const aFechaLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const haceDias = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return aFechaLocal(d) }

function formatoFechaHora(iso) {
  const d = new Date(iso)
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function HistorialAsignaciones() {
  const [desde, setDesde] = useState(haceDias(7))
  const [hasta, setHasta] = useState(aFechaLocal(new Date()))
  const [filas, setFilas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [fPor, setFPor] = useState('')     // email de quien asignó, o 'auto'
  const [fA, setFA] = useState('')         // id de a quién, o 'nadie'
  const [fOrigen, setFOrigen] = useState('')
  const [texto, setTexto] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    const r = await leerHistorialAsignaciones({
      desde: new Date(desde + 'T00:00:00').toISOString(),
      hasta: new Date(hasta + 'T23:59:59').toISOString(),
    })
    if (r.error) setError(r.error)
    else { setFilas(r.filas); setUsuarios(r.usuarios) }
    setCargando(false)
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  const porId = useMemo(() => Object.fromEntries(usuarios.map(u => [u.id, u.nombre])), [usuarios])
  const porEmail = useMemo(() => Object.fromEntries(usuarios.map(u => [u.email, u.nombre])), [usuarios])

  const visibles = useMemo(() => {
    const t = texto.trim().toLowerCase()
    return filas.filter(f => {
      if (fOrigen && f.origen !== fOrigen) return false
      if (fPor === 'auto' ? f.origen !== 'automatico' : fPor && f.asignado_por !== fPor) return false
      if (fA === 'nadie' ? f.a_usuario_id : fA && f.a_usuario_id !== fA) return false
      if (t && !`${f.contacto_nombre || ''} ${f.contacto_whatsapp || ''}`.toLowerCase().includes(t)) return false
      return true
    })
  }, [filas, fPor, fA, fOrigen, texto])

  // Resumen por persona, sobre lo que se está viendo: cuántas asignó (a mano), cuántas recibió y cuántas liberó
  const resumen = useMemo(() => {
    const m = new Map()
    const fila = (clave, nombre) => { if (!m.has(clave)) m.set(clave, { nombre, asigno: 0, recibio: 0, libero: 0 }); return m.get(clave) }
    for (const f of visibles) {
      if (f.asignado_por) fila(f.asignado_por, porEmail[f.asignado_por] || f.asignado_por).asigno += 1
      if (f.a_usuario_id) fila(f.a_usuario_id, porId[f.a_usuario_id] || 'Usuario eliminado').recibio += 1
      else if (f.de_usuario_id) fila(f.de_usuario_id, porId[f.de_usuario_id] || 'Usuario eliminado').libero += 1
    }
    return [...m.entries()].map(([k, v]) => v).sort((a, b) => (b.asigno + b.recibio) - (a.asigno + a.recibio))
  }, [visibles, porId, porEmail])

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Historial de asignaciones</h1>
        <p className="text-gray-400 dark:text-zinc-500 text-sm">Quién pasó cada chat a quién y cuándo. Solo lo ve el superadmin.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4">
        <label className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Desde
          <input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} className={INPUT + ' block mt-1'} />
        </label>
        <label className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Hasta
          <input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} className={INPUT + ' block mt-1'} />
        </label>
        <label className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Asignó
          <select value={fPor} onChange={e => setFPor(e.target.value)} className={INPUT + ' block mt-1'}>
            <option value="">Cualquiera</option>
            <option value="auto">Automático</option>
            {usuarios.map(u => <option key={u.id} value={u.email}>{u.nombre}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500 dark:text-zinc-400 font-medium">A quién
          <select value={fA} onChange={e => setFA(e.target.value)} className={INPUT + ' block mt-1'}>
            <option value="">Cualquiera</option>
            <option value="nadie">Quedó sin asignar</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500 dark:text-zinc-400 font-medium">Tipo
          <select value={fOrigen} onChange={e => setFOrigen(e.target.value)} className={INPUT + ' block mt-1'}>
            <option value="">Todos</option>
            <option value="manual">Manual</option>
            <option value="automatico">Automático</option>
          </select>
        </label>
        <label className="text-xs text-gray-500 dark:text-zinc-400 font-medium flex-1 min-w-[160px]">Contacto
          <input type="text" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Nombre o teléfono..." className={INPUT + ' block mt-1 w-full'} />
        </label>
        <button onClick={cargar} className="text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800">Actualizar</button>
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-4 py-3 rounded-xl">{error}</p>}

      {cargando ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-600">Cargando...</div>
      ) : !error && (
        <>
          {resumen.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-x-auto">
              <p className="px-5 pt-4 pb-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">Por persona (según los filtros)</p>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Persona</th>
                  <th className="px-5 py-2 font-semibold text-right">Asignó a mano</th>
                  <th className="px-5 py-2 font-semibold text-right">Recibió chats</th>
                  <th className="px-5 py-2 font-semibold text-right">Dejó sin asignar</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {resumen.map(r => (
                    <tr key={r.nombre}>
                      <td className="px-5 py-2 font-medium text-gray-800 dark:text-zinc-200">{r.nombre}</td>
                      <td className="px-5 py-2 text-right">{r.asigno}</td>
                      <td className="px-5 py-2 text-right">{r.recibio}</td>
                      <td className="px-5 py-2 text-right">{r.libero}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-x-auto">
            <p className="px-5 pt-4 pb-2 text-sm font-semibold text-gray-700 dark:text-zinc-300">{visibles.length} asignaciones</p>
            {visibles.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-gray-400 dark:text-zinc-500">
                No hay asignaciones en este período. El registro empezó el 23/11/2026 y guarda todo lo que pase desde ahí.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-400 dark:text-zinc-500 uppercase tracking-wide border-b border-gray-100 dark:border-zinc-800">
                  <th className="px-5 py-2 font-semibold">Fecha</th>
                  <th className="px-5 py-2 font-semibold">Contacto</th>
                  <th className="px-5 py-2 font-semibold">De</th>
                  <th className="px-5 py-2 font-semibold">A</th>
                  <th className="px-5 py-2 font-semibold">Asignó</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                  {visibles.map(f => (
                    <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                      <td className="px-5 py-2.5 whitespace-nowrap text-gray-500 dark:text-zinc-400 tabular-nums">{formatoFechaHora(f.created_at)}</td>
                      <td className="px-5 py-2.5">
                        <p className="font-medium text-gray-800 dark:text-zinc-200">{f.contacto_nombre || 'Sin nombre'}</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500">{f.contacto_whatsapp}</p>
                      </td>
                      <td className="px-5 py-2.5 text-gray-600 dark:text-zinc-300">{f.de_usuario_id ? (porId[f.de_usuario_id] || 'Usuario eliminado') : <span className="text-gray-400 dark:text-zinc-500">Sin asignar</span>}</td>
                      <td className="px-5 py-2.5 font-medium text-gray-800 dark:text-zinc-200">{f.a_usuario_id ? (porId[f.a_usuario_id] || 'Usuario eliminado') : <span className="text-gray-400 dark:text-zinc-500 font-normal">Quedó sin asignar</span>}</td>
                      <td className="px-5 py-2.5">
                        {f.origen === 'manual'
                          ? <span className="text-gray-800 dark:text-zinc-200">{porEmail[f.asignado_por] || f.asignado_por || 'Manual'}</span>
                          : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" title="Reparto automático, asistente o una respuesta del equipo que se quedó con el chat">Automático</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
