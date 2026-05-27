/**
 * Rate limiter en memoria por IP.
 * Se reinicia con cada deploy de Vercel — suficiente para este proyecto.
 * Para mayor escala, reemplazar con Upstash Redis.
 *
 * Uso:
 *   import { crearLimiter } from '../../lib/rateLimiter'
 *   const limiter = crearLimiter({ max: 10, ventanaMs: 60_000 })
 *   if (!limiter.permitir(req, res)) return
 */

export function crearLimiter({ max, ventanaMs }) {
  const store = {}

  function limpiar(ip) {
    if (!store[ip]) return
    if (Date.now() - store[ip].desde > ventanaMs) delete store[ip]
  }

  return {
    /**
     * Retorna true si la solicitud está permitida.
     * Retorna false y responde 429 si está bloqueada.
     */
    permitir(req, res) {
      const ip =
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        'unknown'

      limpiar(ip)

      if (!store[ip]) {
        store[ip] = { count: 1, desde: Date.now() }
        return true
      }

      store[ip].count++

      if (store[ip].count > max) {
        const segundos = Math.ceil((ventanaMs - (Date.now() - store[ip].desde)) / 1000)
        res.setHeader('Retry-After', segundos)
        res.status(429).json({
          ok: false,
          mensaje: `Demasiadas solicitudes. Intenta en ${Math.ceil(segundos / 60)} minuto(s).`
        })
        return false
      }

      return true
    }
  }
}
