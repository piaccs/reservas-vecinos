import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import { crearLimiter } from '../../lib/rateLimiter'
import { validarEmail } from '../../lib/validators'

const limiter = crearLimiter({ max: 5, ventanaMs: 15 * 60 * 1000 })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!limiter.permitir(req, res)) return

  const { email, password } = req.body

  const emailError = validarEmail(email)
  if (emailError) {
    return res.status(400).json({ ok: false, mensaje: 'Correo y contraseña requeridos' })
  }
  if (!password || typeof password !== 'string' || password.length < 1 || password.length > 128) {
    return res.status(400).json({ ok: false, mensaje: 'Correo y contraseña requeridos' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password
  })

  if (error || !data.user) {
    return res.status(401).json({ ok: false, mensaje: 'Credenciales incorrectas' })
  }

  const { data: admin, error: adminError } = await supabase
    .from('administradores')
    .select('email, nombre')
    .eq('email', data.user.email)
    .single()

  if (adminError || !admin) {
    return res.status(401).json({ ok: false, mensaje: 'No tienes permisos de administrador' })
  }

  const token = jwt.sign(
    { email: admin.email, nombre: admin.nombre },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  )

  res.setHeader('Set-Cookie', [
    `admin_token=${token}; HttpOnly; Path=/; Max-Age=28800; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  ])

  res.status(200).json({ ok: true, nombre: admin.nombre, email: admin.email })
}