// Roles del panel admin y qué secciones puede ver cada uno.
// Restringe a nivel de página/menú (qué se puede abrir), no bloquea
// botones individuales dentro de una página permitida.
export const ROLES = {
  admin: {
    label: 'Admin',
    descripcion: 'Acceso completo a todas las secciones.',
    acceso: 'todo',
  },
  operativo: {
    label: 'Operativo',
    descripcion: 'Trabajo diario: reservas, agenda, excursiones, equipo, CRM y paquetes. Sin Finanzas ni Configuración.',
    acceso: [
      '/admin', '/admin/clientes', '/admin/leads', '/admin/crm/whatsapp',
      '/admin/reservas', '/admin/excursiones', '/admin/agenda', '/admin/operaciones',
      '/admin/hospedajes', '/admin/videos', '/admin/paquetes', '/admin/equipo',
    ],
  },
  lectura: {
    label: 'Solo lectura',
    descripcion: 'Consulta de Dashboard, Reservas, Agenda y Excursiones.',
    acceso: ['/admin', '/admin/reservas', '/admin/agenda', '/admin/excursiones'],
  },
  ventas: {
    label: 'Ventas',
    descripcion: 'Generador de propuestas, WhatsApp y el embudo de Paquetes. Sin Dashboard ni el resto del panel.',
    acceso: [
      '/admin/paquetes/generador',
      '/admin/crm/whatsapp',
      // exact: sin esto, alcanzaría también para /admin/leads/paseos y
      // /admin/leads/anfitriona (ver tieneAcceso más abajo)
      { path: '/admin/leads', exact: true },
    ],
  },
}

// Cada entrada de "acceso" es una ruta (agarra también sus subrutas, como el menú
// de un módulo con submenús) o, para pedir una página suelta sin llevarse sus
// subrutas, { path, exact: true } — como "/admin/leads": Ventas puede ver el
// embudo de Paquetes pero no el de Paseos ni el de Anfitriona, que viven un
// escalón más abajo (/admin/leads/paseos, /admin/leads/anfitriona).
export function tieneAcceso(rol, pathname) {
  const r = ROLES[rol]
  if (!r) return false
  if (r.acceso === 'todo') return true
  return r.acceso.some(entry => {
    const { path: p, exact } = typeof entry === 'string' ? { path: entry, exact: false } : entry
    if (p === '/admin' || exact) return pathname === p
    return pathname === p || pathname.startsWith(p + '/')
  })
}

// A dónde entra cada rol: al Dashboard si lo puede ver, o si no a su primera
// sección (por ejemplo Ventas entra directo a WhatsApp, no ve los números de
// Finanzas del Dashboard). Se usa al iniciar sesión y si intenta abrir algo que
// no puede ver.
export function rutaInicial(rol) {
  const r = ROLES[rol]
  if (!r || r.acceso === 'todo' || r.acceso.some(e => (typeof e === 'string' ? e : e.path) === '/admin')) {
    return '/admin'
  }
  const primera = r.acceso[0]
  return typeof primera === 'string' ? primera : primera.path
}
