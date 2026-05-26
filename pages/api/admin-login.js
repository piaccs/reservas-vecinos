import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ ok: false, mensaje: 'Correo y contraseña requeridos' })
  }

  const { data, error } = await supabase
    .from('administradores')
    .select('email, nombre, password_hash')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (error || !data) {
    return res.status(401).json({ ok: false, mensaje: 'Correo no registrado como administrador' })
  }

  // Comparar contraseña (simple hash o texto plano según lo configurado)
  const passwordValida = data.password_hash === password ||
    data.password_hash === null && password === process.env.ADMIN_PASSWORD

  if (!passwordValida) {
    return res.status(401).json({ ok: false, mensaje: 'Contraseña incorrecta' })
  }

  res.status(200).json({ ok: true, nombre: data.nombre, email: data.email })
}
