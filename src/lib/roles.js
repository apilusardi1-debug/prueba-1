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
      '/admin/reservas', '/admin/excursiones', '/admin/agenda', '/admin/hospedajes',
      '/admin/paquetes', '/admin/equipo',
    ],
  },
  lectura: {
    label: 'Solo lectura',
    descripcion: 'Consulta de Dashboard, Reservas, Agenda y Excursiones.',
    acceso: ['/admin', '/admin/reservas', '/admin/agenda', '/admin/excursiones'],
  },
}

export function tieneAcceso(rol, pathname) {
  const r = ROLES[rol]
  if (!r) return false
  if (r.acceso === 'todo') return true
  return r.acceso.some(p => (p === '/admin' ? pathname === '/admin' : pathname === p || pathname.startsWith(p + '/')))
}
