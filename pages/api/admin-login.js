import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { crearLimiter } from '../../lib/rateLimiter'
import { validarEmail } from '../../lib/validators'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// 5 intentos por IP cada 15 minutos
const limiter = crearLimiter({ max: 5, ventanaMs: 15 * 60 * 1000 })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!limiter.permitir(req, res)) return

  const { email, password } = req.body

  // Validar formato antes de consultar la base de datos
  const emailError = validarEmail(email)
  if (emailError) {
    return res.status(400).json({ ok: false, mensaje: 'Correo y contraseña requeridos' })
  }
  if (!password || typeof password !== 'string' || password.length < 1 || password.length > 128) {
    return res.status(400).json({ ok: false, mensaje: 'Correo y contraseña requeridos' })
  }

  const { data, error } = await supabase
    .from('administradores')
    .select('email, nombre, password_hash')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (error || !data) {
    // Mismo mensaje para no revelar si el email existe o no
    return res.status(401).json({ ok: false, mensaje: 'Credenciales incorrectas' })
  }

  let passwordValida = false

  if (data.password_hash && data.password_hash.startsWith('$2')) {
    // Contraseña hasheada con bcrypt
    passwordValida = await bcrypt.compare(password, data.password_hash)
  } else {
    // Contraseña en texto plano (migración): comparar y hashear automáticamente
    const esPlano = data.password_hash === password ||
      (data.password_hash === null && password === process.env.ADMIN_PASSWORD)

    if (esPlano) {
      const hash = await bcrypt.hash(password, 12)
      await supabase
        .from('administradores')
        .update({ password_hash: hash })
        .eq('email', data.email)
      passwordValida = true
    }
  }

  if (!passwordValida) {
    return res.status(401).json({ ok: false, mensaje: 'Credenciales incorrectas' })
  }

  // Generar JWT
  const token = jwt.sign(
    { email: data.email, nombre: data.nombre },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  )

  // Enviar como cookie HttpOnly — no accesible desde JS del navegador
  res.setHeader('Set-Cookie', [
    `admin_token=${token}; HttpOnly; Path=/; Max-Age=28800; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  ])

  res.status(200).json({ ok: true, nombre: data.nombre, email: data.email })
}
