// Niveles del panel y secciones. Qué secciones ve cada tipo (operativo, ventas, lectura) lo define
// el superadmin en la pantalla Superadmin → Permisos por tipo; se guarda en la base y llega al
// navegador al entrar (admin_session.permisos). Superadmin y admin no dependen de esa lista.
export const ROLES = {
  superadmin: { label: 'Superadmin', descripcion: 'Control total. Crea admins y define qué ve cada tipo de usuario.' },
  admin: { label: 'Admin', descripcion: 'Administra los usuarios de los tipos operativo, ventas y lectura.' },
  operativo: { label: 'Operativo', descripcion: 'Trabajo diario. Las secciones las define el superadmin.' },
  ventas: { label: 'Ventas', descripcion: 'Trabajo de ventas. Las secciones las define el superadmin.' },
  lectura: { label: 'Solo lectura', descripcion: 'Consulta. Las secciones las define el superadmin.' },
  logistica: { label: 'Logística', descripcion: 'Coordina las operaciones con choferes, guías y clientes. Puede crear cuentas de choferes.' },
  chofer: { label: 'Chofer', descripcion: 'Solo ve el chat interno de sus operaciones.' },
}

// Roles que un admin (no superadmin) puede dar o quitar.
export const ROLES_ADMINISTRABLES = ['operativo', 'ventas', 'lectura', 'logistica', 'chofer']

// Cada sección es una página del panel. "ruta" es el inicio de la URL; "exacta" significa que
// solo vale para esa URL, sin sus subrutas (como el embudo de paquetes frente al de paseos).
export const SECCIONES = [
  { clave: 'dashboard', nombre: 'Dashboard', ruta: '/admin', exacta: true },
  { clave: 'clientes', nombre: 'Clientes', ruta: '/admin/clientes' },
  { clave: 'embudo_paquetes', nombre: 'Embudo de paquetes', ruta: '/admin/leads', exacta: true },
  { clave: 'embudo_paseos', nombre: 'Embudo de paseos', ruta: '/admin/leads/paseos' },
  { clave: 'embudo_anfitriona', nombre: 'Embudo de anfitriona', ruta: '/admin/leads/anfitriona' },
  { clave: 'whatsapp', nombre: 'WhatsApp', ruta: '/admin/crm/whatsapp' },
  { clave: 'reservas', nombre: 'Reservas', ruta: '/admin/reservas' },
  { clave: 'traslados', nombre: 'Traslados', ruta: '/admin/traslados' },
  { clave: 'paseos', nombre: 'Paseos', ruta: '/admin/excursiones' },
  { clave: 'agenda', nombre: 'Agenda', ruta: '/admin/agenda' },
  { clave: 'operaciones', nombre: 'Operaciones', ruta: '/admin/operaciones/en-curso' },
  { clave: 'chat_interno', nombre: 'Chat interno', ruta: '/admin/operaciones/chat' },
  { clave: 'mensajes', nombre: 'Mensajes', ruta: '/admin/mensajes' },
  { clave: 'hospedajes', nombre: 'Hospedajes', ruta: '/admin/hospedajes' },
  { clave: 'videos', nombre: 'Videos', ruta: '/admin/videos' },
  { clave: 'paquetes_clientes', nombre: 'Paquetes: clientes', ruta: '/admin/paquetes/clientes' },
  { clave: 'paquetes_generador', nombre: 'Paquetes: generador', ruta: '/admin/paquetes/generador' },
  { clave: 'paquetes_enviadas', nombre: 'Paquetes: enviadas', ruta: '/admin/paquetes/enviadas' },
  { clave: 'paquetes_cerradas', nombre: 'Paquetes: cerradas', ruta: '/admin/paquetes/cerradas' },
  { clave: 'finanzas', nombre: 'Finanzas', ruta: '/admin/finanzas' },
  { clave: 'equipo', nombre: 'Equipo', ruta: '/admin/equipo' },
  { clave: 'configuracion', nombre: 'Configuración', ruta: '/admin/configuracion' },
  { clave: 'entrenar_asistente', nombre: 'Entrenar al asistente', ruta: '/admin/entrenar-asistente' },
  { clave: 'superadmin', nombre: 'Superadmin', ruta: '/admin/superadmin', soloSuperadmin: true },
]

export function seccionDeRuta(pathname) {
  let mejor = null
  for (const s of SECCIONES) {
    const coincide = s.exacta ? pathname === s.ruta : (pathname === s.ruta || pathname.startsWith(s.ruta + '/'))
    if (coincide && (!mejor || s.ruta.length > mejor.ruta.length)) mejor = s
  }
  return mejor
}

function sesionGuardada() {
  try {
    return JSON.parse(localStorage.getItem('admin_session') || '{}')
  } catch {
    return {}
  }
}

export function puedeVerSeccion(rol, clave) {
  if (rol === 'superadmin') return true
  if (rol === 'admin') return clave !== 'superadmin'
  const permisos = sesionGuardada().permisos || {}
  return (permisos[rol] || []).includes(clave)
}

export function tieneAcceso(rol, pathname) {
  const seccion = seccionDeRuta(pathname)
  return !!seccion && puedeVerSeccion(rol, seccion.clave)
}

// A dónde entra cada rol: a la primera sección que puede ver. Si no ve ninguna, a la entrada del panel.
export function rutaInicial(rol) {
  const primera = SECCIONES.find(s => puedeVerSeccion(rol, s.clave))
  return primera ? primera.ruta : '/login'
}
