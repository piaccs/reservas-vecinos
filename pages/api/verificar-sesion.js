import { verificarToken } from '../../lib/auth'

export default function handler(req, res) {
  const payload = verificarToken(req)
  if (!payload) {
    return res.status(401).json({ ok: false })
  }
  res.status(200).json({ ok: true, email: payload.email, nombre: payload.nombre })
}
