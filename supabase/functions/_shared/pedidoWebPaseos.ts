// Pedido de paseos que arma el sitio público ("Mi selección"): el cliente elige
// paseos, fechas de estadía y pasajeros, y se le abre WhatsApp con este mensaje.
// El mismo archivo lo usan la web (para escribirlo) y webhook-whatsapp (para
// reconocerlo y completar el lead), así el formato no se desincroniza nunca.
//
// El cliente puede editar el mensaje antes de mandarlo, así que la lectura es
// tolerante: alcanza con que esté el encabezado; lo que falte queda en null.

export interface PaseoPedido { nombre: string; destino: string | null }

export interface PedidoWebPaseos {
  paseos: PaseoPedido[]
  desde: string | null // ISO (aaaa-mm-dd)
  hasta: string | null
  adultos: number | null
  edadesMenores: number[]
  codigoVendedor: string | null
}

const ENCABEZADO = '¡Hola DreamTours! Me interesan estos paseos:'

const fechaLegible = (iso: string) => iso.split('-').reverse().join('/')

export function armarMensajePedidoWeb(p: {
  paseos: PaseoPedido[]; desde: string; hasta: string; adultos: number; edadesMenores: (number | string)[]; codigoVendedor?: string | null
}): string {
  const menores = p.edadesMenores.length
  const pasajeros = `${p.adultos} adulto${p.adultos !== 1 ? 's' : ''}` + (menores
    ? ` y ${menores} menor${menores !== 1 ? 'es' : ''} (edad${menores !== 1 ? 'es' : ''}: ${p.edadesMenores.join(', ')})`
    : '')
  const lineas = [
    ENCABEZADO,
    ...p.paseos.map(x => `• ${x.nombre}${x.destino && !x.nombre.includes(x.destino) ? ` (${x.destino})` : ''}`),
    '',
    `Fechas de estadía: del ${fechaLegible(p.desde)} al ${fechaLegible(p.hasta)}`,
    `Pasajeros: ${pasajeros}`,
  ]
  if (p.codigoVendedor) lineas.push(`Código de vendedor: ${p.codigoVendedor}`)
  return lineas.join('\n')
}

function normalizar(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¡!]/g, '').trim()
}

const ENCABEZADO_NORMALIZADO = normalizar(ENCABEZADO)

// "12/01/2027" -> "2027-01-12" (null si no es una fecha válida)
function aIso(ddmmaaaa: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(ddmmaaaa)
  if (!m) return null
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const fecha = new Date(Date.UTC(a, mes - 1, d))
  if (fecha.getUTCDate() !== d || fecha.getUTCMonth() !== mes - 1) return null
  return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// Devuelve el pedido si el texto es el mensaje de la web, o null si no lo es.
export function leerPedidoWebPaseos(texto: string | null | undefined): PedidoWebPaseos | null {
  if (!texto) return null
  const lineas = texto.split('\n').map(l => l.trim())
  if (normalizar(lineas[0] ?? '') !== ENCABEZADO_NORMALIZADO) return null

  const pedido: PedidoWebPaseos = { paseos: [], desde: null, hasta: null, adultos: null, edadesMenores: [], codigoVendedor: null }
  for (const linea of lineas.slice(1)) {
    const item = /^[•\-*]\s*(.+)$/.exec(linea)
    if (item) {
      const conDestino = /^(.*\S)\s*\(([^()]+)\)$/.exec(item[1])
      pedido.paseos.push(conDestino ? { nombre: conDestino[1], destino: conDestino[2].trim() } : { nombre: item[1].trim(), destino: null })
      continue
    }
    const n = normalizar(linea)
    const fechas = /^fechas de estadia:\s*del\s+(\S+)\s+al\s+(\S+)/.exec(n)
    if (fechas) { pedido.desde = aIso(fechas[1]); pedido.hasta = aIso(fechas[2]); continue }
    if (n.startsWith('pasajeros:')) {
      const adultos = /(\d+)\s+adultos?/.exec(n)
      if (adultos) pedido.adultos = Number(adultos[1])
      const edades = /edad(?:es)?:\s*([\d,\s]+)/.exec(n)
      if (edades) pedido.edadesMenores = edades[1].split(',').map(e => e.trim()).filter(Boolean).map(Number)
      continue
    }
    const codigo = /^codigo de vendedor:\s*(\S+)/.exec(n)
    if (codigo) pedido.codigoVendedor = codigo[1].toUpperCase()
  }
  return pedido
}

// Destinos de los paseos pedidos, sin repetir, para el interés del lead
export function destinosDelPedido(p: PedidoWebPaseos): string | null {
  const destinos = [...new Set(p.paseos.map(x => x.destino).filter((d): d is string => !!d))]
  return destinos.length ? destinos.join(' + ') : null
}

// Etiquetas que se le ponen al lead: de dónde vino y, si trajo un código válido, de qué vendedor
export const ETIQUETA_PEDIDO_WEB = 'Pedido web'
export const etiquetaVendedor = (nombre: string, codigo: string) => `Vendedor: ${nombre} (${codigo})`
