import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, actual, nueva } = req.body

  const { data, error } = await supabase
    .from('administradores')
    .select('email, password_hash')
    .eq('email', email)
    .single()

  if (error || !data) {
    return res.status(404).json({ ok: false, mensaje: 'Administrador no encontrado' })
  }

  const passActualValida = data.password_hash === actual ||
    (data.password_hash === null && actual === process.env.ADMIN_PASSWORD)

  if (!passActualValida) {
    return res.status(401).json({ ok: false, mensaje: 'La contraseña actual es incorrecta' })
  }

  const { error: updateError } = await supabase
    .from('administradores')
    .update({ password_hash: nueva })
    .eq('email', email)

  if (updateError) {
    return res.status(500).json({ ok: false, mensaje: 'Error al actualizar la contraseña' })
  }

  res.status(200).json({ ok: true })
}
