/**
 * Validaciones reutilizables para los endpoints de la app.
 * Cada función retorna null si es válido, o un string con el error.
 */

/** Elimina caracteres HTML peligrosos */
export function sanitizar(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/[<>"'&]/g, c => ({
    '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;'
  }[c]))
}

/** Nombre: solo letras, espacios, tildes, apostrofos. Largo 2-80 */
export function validarNombre(v) {
  if (!v || typeof v !== 'string') return 'Nombre requerido'
  const s = v.trim()
  if (s.length < 2) return 'Nombre muy corto'
  if (s.length > 80) return 'Nombre muy largo (máx 80 caracteres)'
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ' ]+$/.test(s)) return 'Nombre contiene caracteres no permitidos'
  return null
}

/** Email básico */
export function validarEmail(v) {
  if (!v || typeof v !== 'string') return 'Correo requerido'
  const s = v.trim()
  if (s.length > 254) return 'Correo muy largo'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'Formato de correo inválido'
  return null
}

/** Celular chileno: 8-15 dígitos */
export function validarCelular(v) {
  if (!v || typeof v !== 'string') return 'Celular requerido'
  const digits = v.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return 'Celular inválido'
  return null
}

/** Fecha YYYY-MM-DD, no en el pasado */
export function validarFecha(v) {
  if (!v || typeof v !== 'string') return 'Fecha requerida'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Formato de fecha inválido'
  const d = new Date(v + 'T00:00:00')
  if (isNaN(d.getTime())) return 'Fecha inválida'
  // Permitir hasta 90 días al futuro
  const max = new Date()
  max.setDate(max.getDate() + 90)
  if (d > max) return 'Fecha demasiado lejana'
  return null
}

/** Horas: array de enteros entre 9 y 22, máx 2 */
export function validarHoras(v) {
  if (!Array.isArray(v) || v.length === 0) return 'Debes seleccionar al menos una hora'
  if (v.length > 2) return 'Máximo 2 horas por reserva'
  for (const h of v) {
    if (!Number.isInteger(h) || h < 9 || h > 23) return `Hora inválida: ${h}`
  }
  return null
}

/** Monto: número positivo razonable */
export function validarMonto(v) {
  if (typeof v !== 'number' || isNaN(v)) return 'Monto inválido'
  if (v < 0) return 'Monto no puede ser negativo'
  if (v > 500000) return 'Monto fuera de rango'
  return null
}

/** UUID v4 */
export function validarUUID(v) {
  if (!v || typeof v !== 'string') return 'ID requerido'
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v))
    return 'ID inválido'
  return null
}

/** URL https */
export function validarUrl(v) {
  if (!v || typeof v !== 'string') return 'URL requerida'
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:') return 'La URL debe ser HTTPS'
    return null
  } catch {
    return 'URL inválida'
  }
}

/**
 * Construye un objeto de errores a partir de un mapa { campo: validador(valor) }
 * Retorna null si todo es válido, o { campo: mensaje } si hay errores.
 */
export function validar(campos) {
  const errores = {}
  for (const [campo, resultado] of Object.entries(campos)) {
    if (resultado !== null) errores[campo] = resultado
  }
  return Object.keys(errores).length > 0 ? errores : null
}
