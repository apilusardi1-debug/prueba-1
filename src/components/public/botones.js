// Botones del sitio público: un solo estilo principal para lo que lleva a cotizar o
// consultar (armar un paquete, agregar un paseo, consultar disponibilidad, enviar por
// WhatsApp) y secundarios con menos peso para "ver más" o navegar. Pedido de Abril
// (2026-10-14): misma identidad, mejor jerarquía. Usar estas clases en vez de armar
// botones a mano en cada página.

const BASE = 'inline-flex items-center justify-center gap-2 rounded-full font-label-lg uppercase transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-hero-navy disabled:opacity-50'

// Acción principal: amarillo de la marca con texto azul. Uno por bloque.
export const BTN_PRINCIPAL = `${BASE} bg-hero-yellow text-hero-navy text-label-lg px-7 py-3.5 shadow-[0_2px_10px_rgba(7,46,64,0.15)] hover:bg-[#ffe92e]`

// Secundario sobre fondo claro: contorno fino, más chico.
export const BTN_SECUNDARIO = `${BASE} border-[1.5px] border-hero-navy/35 text-hero-navy text-label-sm px-5 py-2.5 hover:border-hero-navy hover:bg-hero-navy/5`

// Secundario sobre fondo oscuro (azul o foto).
export const BTN_SECUNDARIO_OSCURO = `${BASE} border-[1.5px] border-hero-cream/55 text-hero-cream text-label-sm px-5 py-2.5 hover:border-hero-cream hover:bg-white/10`

// Estado "ya elegido" de una acción principal (ej. paseo agregado a la selección):
// mismo tamaño que el principal, pero sin el amarillo.
export const BTN_ELEGIDO = `${BASE} border-[1.5px] border-hero-navy bg-hero-cream text-hero-navy text-label-lg px-7 py-3.5 hover:bg-hero-cream/70`
