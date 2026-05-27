import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET

/**
 * Verifica el token JWT de la cookie de sesión admin.
 * Retorna el payload si es válido, o null si no.
 */
export function verificarToken(req) {
  try {
    const cookie = req.headers.cookie || ''
    const match = cookie.match(/admin_token=([^;]+)/)
    if (!match) return null
    return jwt.verify(match[1], SECRET)
  } catch {
    return null
  }
}

/**
 * Middleware: si el token no es válido, responde 401 y retorna false.
 * Uso: if (!requireAdmin(req, res)) return
 */
export function requireAdmin(req, res) {
  const payload = verificarToken(req)
  if (!payload) {
    res.status(401).json({ ok: false, mensaje: 'No autorizado' })
    return false
  }
  return payload
}
