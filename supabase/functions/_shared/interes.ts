// Detección del interés de un contacto (tipo de servicio + destino) a partir de
// palabras clave del mensaje. Un solo archivo lo usan el webhook de WhatsApp
// (que completa el lead al llegar el mensaje) y el panel (leads cargados a
// mano), así las reglas no se desincronizan. Para sumar un destino o una
// palabra, se agrega una línea en DESTINOS o PALABRAS_TIPO.

export const TIPOS_INTERES = [
  { id: 'paquete', label: 'Paquete' },
  { id: 'paseo', label: 'Paseo' },
  { id: 'traslado', label: 'Traslado' },
  { id: 'hospedaje', label: 'Hospedaje' },
]

// Se evalúan sobre el texto en minúsculas y sin acentos.
const PALABRAS_TIPO: Record<string, RegExp> = {
  paquete: /paquete|pacote|package|todo incluido|all inclusive|viaje completo/,
  paseo: /paseo|excursion|excursao|\btours?\b|passeio|buggy|bugre|lancha|jangada|catamaran|snorkel/,
  traslado: /traslado|translado|transfer/,
  hospedaje: /hotel|hospedaje|alojamiento|pousada|posada|hostel/,
}

const DESTINOS: [string, RegExp][] = [
  ['Porto de Galinhas', /porto de galinha|galinhas|\bporto\b(?! seguro)/],
  ['Porto Seguro', /porto seguro/],
  ['Maragogi', /maragogi/],
  ['Maceió', /maceio/],
  ['Pipa', /\bpipa\b/],
  ['Natal', /(?<!feliz |ciudad |cidade |pais )\bnatal\b/],
  ['Fernando de Noronha', /noronha/],
  ['Tamandaré', /tamandare|carneiros/],
  ['Barra de Sirinhaém', /sirinhaem/],
  ['São Miguel dos Milagres', /milagres/],
  ['Recife', /\brecife\b/],
  ['Salvador', /\bsalvador\b/],
  ['Jericoacoara', /jericoacoara|\bjeri\b/],
  ['Fortaleza', /fortaleza/],
  ['Lençóis Maranhenses', /lencois|maranhenses/],
  ['Morro de São Paulo', /morro de sao paulo/],
]

export const DESTINOS_INTERES = DESTINOS.map(([nombre]) => nombre)

function normalizar(texto: string): string {
  return texto.toLowerCase()
    .replace(/[áàâäã]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
    .replace(/[óòôöõ]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ñ/g, 'n').replace(/ç/g, 'c')
}

// Devuelve el tipo y el destino que se reconocen en el texto (null si no hay).
// Si el mensaje menciona a la vez paquete y paseo el tipo queda en null: es
// mejor dejarlo en blanco que adivinar mal. Un paquete puede nombrar hotel y
// traslado sin dejar de ser paquete; un paseo, traslado y hotel sin dejar de
// ser paseo. Con varios destinos se unen ("Porto de Galinhas + Maragogi").
export function detectarInteres(texto: string | null | undefined): { tipo: string | null; destino: string | null } {
  const t = normalizar(String(texto ?? ''))
  if (!t.trim()) return { tipo: null, destino: null }

  const encontrados = new Set(Object.entries(PALABRAS_TIPO).filter(([, re]) => re.test(t)).map(([id]) => id))
  let tipo: string | null = null
  if (!(encontrados.has('paquete') && encontrados.has('paseo'))) {
    tipo = ['paquete', 'paseo', 'traslado', 'hospedaje'].find(id => encontrados.has(id)) ?? null
  }

  const destinos = DESTINOS.filter(([, re]) => re.test(t)).map(([nombre]) => nombre)
  return { tipo, destino: destinos.length ? destinos.join(' + ') : null }
}

// Texto para mostrar el interés de un lead: "Paquete · Porto de Galinhas".
// Los leads viejos, cargados antes de este campo, muestran la excursión que
// tenían guardada.
export function etiquetaInteres(lead: { interes_tipo?: string | null; interes_destino?: string | null; excursion_interes?: string | null }): string {
  const tipo = TIPOS_INTERES.find(t => t.id === lead.interes_tipo)?.label
  const partes = [tipo, lead.interes_destino].filter(Boolean)
  return partes.length ? partes.join(' · ') : (lead.excursion_interes || '')
}
