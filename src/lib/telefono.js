// Completa el formato de un WhatsApp cargado a mano: código de país + (en
// Brasil) el "9" del celular que a veces falta al escribirlo (ver CLAUDE.md
// "Números Brasil": 5581989375412, no 558189375412). La agencia está en
// Salvador, así que un número sin código de país se asume brasilero; uno que
// ya trae otro código (ej: 54 de Argentina) se deja como está.
export function normalizarWhatsapp(valor) {
  const digitos = String(valor || '').replace(/\D/g, '')
  if (!digitos) return ''

  if (digitos.startsWith('55')) {
    const resto = digitos.slice(2)
    if (resto.length === 10) return '55' + resto.slice(0, 2) + '9' + resto.slice(2)
    return digitos
  }

  if (digitos.length === 10) return '55' + digitos.slice(0, 2) + '9' + digitos.slice(2)
  if (digitos.length === 11) return '55' + digitos

  return digitos
}
