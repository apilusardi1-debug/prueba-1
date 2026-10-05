import { useState, useEffect } from 'react'
import { usuariosAdminApi } from '../../lib/supabase.js'
import { SECCIONES, ROLES_ADMINISTRABLES, ROLES } from '../../lib/roles.js'
import { TabAccesos } from './SiteConfig.jsx'
import { avisar } from '../../components/ui/Avisos.jsx'

// Las secciones que se pueden asignar a un tipo: las del superadmin no, y las de admin/superadmin
// siempre las ven (no dependen de esta tabla).
const SECCIONES_ASIGNABLES = SECCIONES.filter(s => !s.soloSuperadmin)

function TabPermisos() {
  const [permisos, setPermisos] = useState({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    usuariosAdminApi.permisos().then(res => {
      const mapa = Object.fromEntries((res?.permisos || []).map(p => [p.tipo, p.secciones || []]))
      setPermisos(mapa)
      setCargando(false)
    })
  }, [])

  function alternar(tipo, clave) {
    setPermisos(prev => {
      const actual = prev[tipo] || []
      const nuevas = actual.includes(clave) ? actual.filter(c => c !== clave) : [...actual, clave]
      return { ...prev, [tipo]: nuevas }
    })
  }

  async function guardar() {
    setGuardando(true)
    const resultados = await Promise.all(
      ROLES_ADMINISTRABLES.map(tipo => usuariosAdminApi.guardarPermisos(tipo, permisos[tipo] || []))
    )
    setGuardando(false)
    if (resultados.some(r => !r?.ok)) return avisar('No se pudieron guardar todos los permisos. Probá de nuevo.')
    avisar('Permisos guardados. Cada usuario los ve al volver a entrar o en unos minutos.')
  }

  if (cargando) return <p className="text-sm text-gray-400 dark:text-zinc-500">Cargando permisos...</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-500 dark:text-zinc-400">
          Marcá qué secciones ve cada tipo de usuario. Admin y superadmin siempre ven todo lo que no es de superadmin.
        </p>
        <button onClick={guardar} disabled={guardando}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300">
          {guardando ? 'Guardando...' : 'Guardar permisos'}
        </button>
      </div>

      <div className="dash-card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left">Sección</th>
              {ROLES_ADMINISTRABLES.map(tipo => (
                <th key={tipo} className="px-4 py-3 text-center">{ROLES[tipo].label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {SECCIONES_ASIGNABLES.map(s => (
              <tr key={s.clave} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-2.5 text-gray-900 dark:text-zinc-100">{s.nombre}</td>
                {ROLES_ADMINISTRABLES.map(tipo => (
                  <td key={tipo} className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={(permisos[tipo] || []).includes(s.clave)}
                      onChange={() => alternar(tipo, s.clave)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-600 dark:bg-zinc-800"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Superadmin() {
  const [pestana, setPestana] = useState('usuarios')
  const pestanas = [
    { id: 'usuarios', label: 'Usuarios' },
    { id: 'permisos', label: 'Permisos por tipo' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {pestanas.map(p => (
          <button key={p.id} onClick={() => setPestana(p.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${pestana === p.id ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border border-gray-200 bg-white text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'}`}>
            {p.label}
          </button>
        ))}
      </div>
      {pestana === 'usuarios' ? <TabAccesos /> : <TabPermisos />}
    </div>
  )
}
