// Filtrado de clientes de Paquetes: después de que el contacto elige Paquetes, el
// asistente le pide los datos que necesita el equipo para armar la propuesta
// (nombre, destino, adultos, menores con su edad, presupuesto y fechas), pero:
//  - solo pregunta lo que el contacto NO dijo antes (en cualquier mensaje);
//  - lo pide todo junto, en UN mensaje;
//  - si la respuesta viene incompleta, hace UNA sola pregunta de seguimiento con lo
//    que falta; después de eso, o si contestó otra cosa, lo toma una persona.
// Este archivo lo usan el webhook de WhatsApp y la pantalla de configuración (para
// mostrar cómo le llega el mensaje al cliente), así el texto no se desincroniza.

import type { DatosViaje } from './datosViaje.ts'

export type Faltante = 'nombre' | 'destino' | 'adultos' | 'menores' | 'edades' | 'presupuesto' | 'fechas'

// Todo lo que se pregunta cuando el contacto todavía no dijo nada (para la vista previa)
export const TODOS_LOS_DATOS: Faltante[] = ['nombre', 'destino', 'adultos', 'menores', 'presupuesto', 'fechas']

export interface ConfigFiltro {
  activo: boolean
  intro: string
  seguimiento: string
  destinos: string[]
  presupuestos: string[]
}

// Los mismos textos que trae por defecto la migración 20260921200000
export const TEXTOS_POR_DEFECTO = {
  intro: 'Perfecto! Para armarte una propuesta a tu medida necesito unos datos. Podés contestarme todo en un solo mensaje:',
  seguimiento: 'Gracias! Para terminar me faltan estos datos:',
  destinos: 'Porto de Galinhas, Maragogi, Pipa, Fernando de Noronha, Maceió',
  presupuestos: 'Desde 1.000 a 2.000 USD\nDesde 2.000 a 2.500 USD\nDesde 2.500 a 3.000 USD',
}

function lista(texto: unknown, separador: RegExp): string[] {
  return String(texto ?? '').split(separador).map((s) => s.trim()).filter(Boolean)
}

// Lee la configuración de la fila de bot_config. Si todavía no se corrió la migración
// (no existe filtro_activo), el filtrado queda apagado y todo funciona como antes.
export function configFiltro(cfg: Record<string, unknown> | null | undefined): ConfigFiltro {
  const texto = (valor: unknown, defecto: string) => String(valor ?? '').trim() || defecto
  return {
    activo: cfg?.filtro_activo === true,
    intro: texto(cfg?.filtro_intro, TEXTOS_POR_DEFECTO.intro),
    seguimiento: texto(cfg?.filtro_seguimiento, TEXTOS_POR_DEFECTO.seguimiento),
    destinos: lista(texto(cfg?.filtro_destinos, TEXTOS_POR_DEFECTO.destinos), /[,\n]/),
    presupuestos: lista(texto(cfg?.filtro_presupuestos, TEXTOS_POR_DEFECTO.presupuestos), /\n/),
  }
}

// ¿El nombre que trae WhatsApp sirve? Vacío, "Sin nombre" o solo números/símbolos, no.
export function nombreValido(nombre: unknown): boolean {
  const n = String(nombre ?? '').trim()
  return /\p{L}{2,}/u.test(n) && n.toLowerCase() !== 'sin nombre'
}

// Lo que falta preguntar: solo lo que el contacto no dijo.
export function faltantes(datos: DatosViaje, nombreConocido: boolean): Faltante[] {
  const f: Faltante[] = []
  if (!nombreConocido) f.push('nombre')
  if (!datos.destino) f.push('destino')
  if (datos.adultos === null) f.push('adultos')
  if (datos.menores === null) f.push('menores')
  else if (datos.menores > 0 && datos.edadesMenores.length < datos.menores) f.push('edades')
  if (!datos.presupuesto) f.push('presupuesto')
  if (!datos.fechas) f.push('fechas')
  return f
}

// Cuántos datos distintos se le entendieron (para saber si su última respuesta aportó algo)
export function camposAportados(datos: DatosViaje): number {
  return [datos.nombre, datos.destino, datos.adultos, datos.menores, datos.presupuesto, datos.fechas]
    .filter((v) => v !== null && v !== '').length + datos.edadesMenores.length
}

export type Paso =
  | { accion: 'derivar' }
  | { accion: 'preguntar'; faltan: Faltante[] }
  | { accion: 'seguimiento'; faltan: Faltante[] }

// Recién elegió Paquetes: si ya dijo todo, va directo a una persona; si no, se pregunta lo que falta.
export function pasoInicial(datos: DatosViaje, nombreConocido: boolean): Paso {
  const faltan = faltantes(datos, nombreConocido)
  return faltan.length ? { accion: 'preguntar', faltan } : { accion: 'derivar' }
}

// Ya se le preguntó y contestó. `antes` es lo que se sabía cuando se hizo la pregunta y
// `despues` lo que se sabe ahora; `intentos` cuántas veces se le preguntó (1 = una).
export function pasoTrasRespuesta(
  { antes, despues, nombreConocido, intentos }: { antes: DatosViaje; despues: DatosViaje; nombreConocido: boolean; intentos: number },
): Paso {
  const faltan = faltantes(despues, nombreConocido)
  if (!faltan.length) return { accion: 'derivar' }
  // Contestó otra cosa (una pregunta, por ejemplo): que lo tome una persona
  if (camposAportados(despues) <= camposAportados(antes)) return { accion: 'derivar' }
  // Ya se le insistió una vez: no se le pregunta de nuevo
  if (intentos >= 2) return { accion: 'derivar' }
  return { accion: 'seguimiento', faltan }
}

function primeraEnMinuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1)
}

function unirConO(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} o ${items[items.length - 1]}`
}

function lineas(config: ConfigFiltro, faltan: Faltante[]): string[] {
  const f = new Set(faltan)
  const l: string[] = []
  if (f.has('nombre')) l.push('Tu nombre')
  if (f.has('destino')) l.push(config.destinos.length ? `Destino: ${unirConO(config.destinos)}` : 'Destino que te interesa')
  if (f.has('adultos') && f.has('menores')) l.push('Cantidad de adultos y de menores (con la edad de cada menor)')
  else if (f.has('adultos')) l.push('Cantidad de adultos')
  else if (f.has('menores')) l.push('Cantidad de menores y la edad de cada uno (si no viajan menores, avisame)')
  if (f.has('edades')) l.push('La edad de cada menor')
  if (f.has('presupuesto')) {
    l.push(config.presupuestos.length
      ? `Rango de presupuesto: ${unirConO(config.presupuestos.map(primeraEnMinuscula))}`
      : 'Rango de presupuesto')
  }
  if (f.has('fechas')) l.push('Fecha o período en que pensás viajar')
  return l
}

// El mensaje con todas las preguntas juntas (solo las que faltan)
export function mensajePreguntas(config: ConfigFiltro, faltan: Faltante[]): string {
  return `${config.intro}\n\n${lineas(config, faltan).map((l) => `- ${l}`).join('\n')}`
}

// La pregunta de seguimiento: solo lo que todavía falta
export function mensajeSeguimiento(config: ConfigFiltro, faltan: Faltante[]): string {
  return `${config.seguimiento}\n\n${lineas(config, faltan).map((l) => `- ${l}`).join('\n')}`
}
