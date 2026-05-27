import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { requireAdmin } from '../../lib/auth'
import { crearLimiter } from '../../lib/rateLimiter'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 5 intentos de cambio de contraseña por IP cada 15 minutos
const limiter = crearLimiter({ max: 5, ventanaMs: 15 * 60 * 1000 })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!limiter.permitir(req, res)) return

  // Verificar que sea un admin autenticado
  const session = requireAdmin(req, res)
  if (!session) return

  const { actual, nueva } = req.body
  const email = session.email // Tomar el email del token, no del body

  if (!actual || typeof actual !== 'string' || !nueva || typeof nueva !== 'string') {
    return res.status(400).json({ ok: false, mensaje: 'Faltan campos' })
  }

  if (nueva.length < 8) {
    return res.status(400).json({ ok: false, mensaje: 'La nueva contraseña debe tener al menos 8 caracteres' })
  }

  if (nueva.length > 128) {
    return res.status(400).json({ ok: false, mensaje: 'Contraseña demasiado larga' })
  }

  const { data, error } = await supabase
    .from('administradores')
    .select('email, password_hash')
    .eq('email', email)
    .single()

  if (error || !data) {
    return res.status(404).json({ ok: false, mensaje: 'Administrador no encontrado' })
  }

  let passActualValida = false
  if (data.password_hash && data.password_hash.startsWith('$2')) {
    passActualValida = await bcrypt.compare(actual, data.password_hash)
  } else {
    passActualValida = data.password_hash === actual ||
      (data.password_hash === null && actual === process.env.ADMIN_PASSWORD)
  }

  if (!passActualValida) {
    return res.status(401).json({ ok: false, mensaje: 'La contraseña actual es incorrecta' })
  }

  const hash = await bcrypt.hash(nueva, 12)

  const { error: updateError } = await supabase
    .from('administradores')
    .update({ password_hash: hash })
    .eq('email', email)

  if (updateError) {
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar la contraseña' })
  }

  res.status(200).json({ ok: true })
}
