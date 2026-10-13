// Pedido de paquete que arma el sitio público (/paquetes, "Armar mi paquete"): el
// cliente completa los mismos datos que el formulario "Completar datos del viaje"
// que manda el asistente por WhatsApp, y se le abre WhatsApp con este mensaje.
// Las líneas "Campo: valor" son las mismas que arma textoDesdeFlow en
// webhook-whatsapp, así datosViaje.ts las lee igual que una respuesta del formulario.
// El mismo archivo lo usan la web (para escribirlo) y webhook-whatsapp (para
// reconocerlo y mandar el lead directo al embudo de Paquetes, ya filtrado).

export const DESTINOS_PAQUETE = ['Porto de Galinhas', 'Maragogi', 'Pipa', 'Fernando de Noronha', 'Maceió']
export const HOSPEDAJES_PAQUETE = ['Posada/Departamento', 'Hotel', 'Resort All Inclusive']
export const PAISES_PAQUETE = ['Argentina', 'Uruguay', 'Chile', 'Paraguay', 'Perú', 'Venezuela']

const ENCABEZADO = '¡Hola DreamTours! Quiero armar un paquete:'

const fechaLegible = (iso: string) => iso.split('-').reverse().join('/')

function formatoMonto(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function nochesEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000)
}

export function armarMensajePedidoPaquete(p: {
  nombre: string; destinos: string[]; pais: string; origen: string; adultos: number
  edadesMenores: (number | string)[]; hospedajes: string[]; presupuesto: number; desde: string; hasta: string
}): string {
  const noches = nochesEntre(p.desde, p.hasta)
  const lineas = [
    ENCABEZADO,
    `Nombre: ${p.nombre}`,
    `Destino: ${p.destinos.join(', ')}`,
    `País: ${p.pais}`,
    `Origen: ${p.origen}`,
    `Adultos: ${p.adultos}`,
    `Menores: ${p.edadesMenores.length}`,
  ]
  if (p.edadesMenores.length) lineas.push(`Edades: ${p.edadesMenores.join(', ')}`)
  lineas.push(
    `Hospedaje: ${p.hospedajes.join(', ')}`,
    `Presupuesto: ${formatoMonto(p.presupuesto)} USD`,
    `Fecha: ${fechaLegible(p.desde)} al ${fechaLegible(p.hasta)}${noches > 0 ? ` · ${noches} noches` : ''}`,
  )
  return lineas.join('\n')
}

function normalizar(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¡!]/g, '').trim()
}

const ENCABEZADO_NORMALIZADO = normalizar(ENCABEZADO)

// ¿Es el mensaje de la web? El cliente puede editarlo antes de mandarlo: alcanza con
// que la primera línea sea el encabezado. Los datos los lee datosViaje.ts, como siempre.
export function esPedidoWebPaquete(texto: string | null | undefined): boolean {
  if (!texto) return false
  return normalizar(texto.split('\n')[0] ?? '') === ENCABEZADO_NORMALIZADO
}

