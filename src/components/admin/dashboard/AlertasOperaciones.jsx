import { Link } from 'react-router-dom'
import Ic from './Ic.jsx'
import { useAlertas } from '../../../lib/useAlertas.jsx'
import { tieneAcceso } from '../../../lib/roles.js'

// Tarjeta del Dashboard con las alertas de operaciones (ver src/lib/alertas.js). Se configuran
// en Configuración > Alertas. Si la persona no tiene acceso a Agenda, no se muestra.
export default function AlertasOperaciones() {
  const { habilitado, alertas, cargando, error } = useAlertas()
  if (!habilitado) return null
  const rol = JSON.parse(localStorage.getItem('admin_session') || '{}').role
  const urgentes = alertas.filter(a => a.gravedad === 'alta').length

  return (
    <div className="dash-card">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Ic n="alert" className="h-[18px] w-[18px] text-gray-500 dark:text-zinc-400" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Alertas de operaciones</h3>
          {alertas.length > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${urgentes ? 'bg-red-500' : 'bg-amber-500'}`}>{alertas.length}</span>
          )}
        </div>
        {tieneAcceso(rol, '/admin/alertas') && (
          <Link to="/admin/alertas" className="text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white">Configurar</Link>
        )}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {cargando && <p className="px-5 py-6 text-center text-xs text-gray-400 dark:text-zinc-500">Cargando...</p>}
        {error && !alertas.length && <p className="px-5 py-6 text-center text-xs text-gray-400 dark:text-zinc-500">No se pudieron leer las reservas para calcular las alertas.</p>}
        {!cargando && !error && !alertas.length && <p className="px-5 py-6 text-center text-xs text-gray-400 dark:text-zinc-500">Todo en orden: no hay alertas.</p>}
        {alertas.map(a => (
          <Link key={a.id} to={a.ruta} className="flex items-start gap-3 border-b border-gray-50 px-5 py-2.5 transition-colors last:border-0 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/[0.03]">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.gravedad === 'alta' ? 'bg-red-500' : 'bg-amber-400'}`} />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-snug text-gray-900 dark:text-zinc-100">{a.titulo}</span>
              <span className="block text-xs text-gray-500 dark:text-zinc-400">{a.detalle}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
