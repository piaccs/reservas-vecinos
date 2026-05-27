import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  const { id, accion } = req.query

  if (!id || !accion) {
    return res.status(400).send('Parámetros inválidos')
  }

  // Buscar la reserva
  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { data: reserva, error } = await supabase
    .from('reservas')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !reserva) {
    return res.status(404).send('Reserva no encontrada')
  }

  if (!reserva.email_reservante) {
    return res.status(200).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2>No se puede enviar correo</h2>
        <p>Esta reserva no tiene correo registrado.</p>
      </body></html>
    `)
  }

  const fecha = reserva.fecha.split('-').reverse().join('/')
  const hora = `${reserva.hora.toString().padStart(2,'0')}:00`
  const aceptada = accion === 'aceptar'

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  })

  const asunto = aceptada
    ? `✅ Reserva confirmada — Gimnasio Collico ${fecha} ${hora}`
    : `❌ Reserva rechazada — Gimnasio Collico ${fecha} ${hora}`

  const htmlVecino = aceptada ? `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f6f0;padding:20px;border-radius:12px">
      <div style="background:#6aaa1e;padding:24px;border-radius:10px 10px 0 0;text-align:center">
        <h1 style="color:white;margin:0;font-size:22px">✅ RESERVA CONFIRMADA</h1>
        <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:14px">Gimnasio Collico — Junta de Vecinos N°25</p>
      </div>
      <div style="background:white;padding:24px;border-radius:0 0 10px 10px">
        <p style="font-size:16px">Hola <strong>${reserva.nombre_reservante}</strong>,</p>
        <p>Tu reserva ha sido <strong style="color:#4d7d14">confirmada</strong> por la directiva de la Junta de Vecinos.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:10px 0;color:#6b7280;font-size:14px">Fecha</td>
            <td style="padding:10px 0;font-weight:600">${fecha}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:10px 0;color:#6b7280;font-size:14px">Hora</td>
            <td style="padding:10px 0;font-weight:600">${hora} hrs</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#6b7280;font-size:14px">Monto</td>
            <td style="padding:10px 0;font-weight:700;color:#4d7d14">$${(reserva.monto||10000).toLocaleString('es-CL')}</td>
          </tr>
        </table>
        <p style="color:#6b7280;font-size:13px">Por favor llega puntual. Si necesitas cancelar, contáctate con la directiva con anticipación.</p>
        <p style="color:#6b7280;font-size:13px">— Junta de Vecinos Urbana N°25 Collico</p>
      </div>
    </div>
  ` : `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f6f0;padding:20px;border-radius:12px">
      <div style="background:#dc2626;padding:24px;border-radius:10px 10px 0 0;text-align:center">
        <h1 style="color:white;margin:0;font-size:22px">❌ RESERVA RECHAZADA</h1>
        <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:14px">Gimnasio Collico — Junta de Vecinos N°25</p>
      </div>
      <div style="background:white;padding:24px;border-radius:0 0 10px 10px">
        <p style="font-size:16px">Hola <strong>${reserva.nombre_reservante}</strong>,</p>
        <p>Lamentablemente tu reserva para el <strong>${fecha}</strong> a las <strong>${hora} hrs</strong> no pudo ser confirmada.</p>
        <p style="color:#6b7280;font-size:13px">Esto puede deberse a que el comprobante no fue validado o la hora ya no está disponible. Por favor contáctate con la directiva para más información.</p>
        <p style="color:#6b7280;font-size:13px">— Junta de Vecinos Urbana N°25 Collico</p>
      </div>
    </div>
  `

  try {
    await transporter.sendMail({
      from: `"Gimnasio Collico" <${process.env.GMAIL_USER}>`,
      to: reserva.email_reservante,
      subject: asunto,
      html: htmlVecino
    })

    // Actualizar estado en base de datos
    await supabase.from('reservas').update({
      estado: aceptada ? 'confirmada' : 'rechazada'
    }).eq('id', id)

    return res.status(200).send(`
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{font-family:Arial,sans-serif;text-align:center;padding:60px 20px;background:#f4f6f0}
      .box{background:white;border-radius:16px;padding:40px;max-width:400px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,0.1)}
      h2{color:${aceptada ? '#4d7d14' : '#dc2626'}}p{color:#6b7280}</style></head>
      <body><div class="box">
        <div style="font-size:3rem">${aceptada ? '✅' : '❌'}</div>
        <h2>${aceptada ? 'Reserva confirmada' : 'Reserva rechazada'}</h2>
        <p>Se envió un correo a <strong>${reserva.email_reservante}</strong> con la notificación.</p>
        <p style="font-size:0.85rem">${reserva.nombre_reservante} — ${fecha} ${hora}</p>
      </div></body></html>
    `)
  } catch (err) {
    return res.status(500).send(`Error enviando correo: ${err.message}`)
  }
}
