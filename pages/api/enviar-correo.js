export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { nombre, celular, email, fecha, horas, comprobanteUrl, monto, reservaId } = req.body

  const fechaFormateada = fecha.split('-').reverse().join('/')
  const horasFormateadas = horas.map(h => `${h.toString().padStart(2, '0')}:00`).join(' y ')

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://reservas-vecinos.vercel.app'

  const btnStyle = `display:inline-block;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;font-family:Arial,sans-serif`

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f6f0;padding:20px;border-radius:12px">
      <div style="background:#6aaa1e;padding:24px;border-radius:10px 10px 0 0;text-align:center">
        <h1 style="color:white;margin:0;font-size:24px;letter-spacing:2px">NUEVA RESERVA</h1>
        <p style="color:rgba(255,255,255,0.9);margin:6px 0 0;font-size:14px">Gimnasio Collico — Junta de Vecinos N°25</p>
      </div>
      <div style="background:white;padding:24px;border-radius:0 0 10px 10px">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:10px 0;color:#6b7280;font-size:14px">Nombre</td>
            <td style="padding:10px 0;font-weight:600;font-size:15px">${nombre}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:10px 0;color:#6b7280;font-size:14px">Celular</td>
            <td style="padding:10px 0;font-weight:600">${celular}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:10px 0;color:#6b7280;font-size:14px">Correo</td>
            <td style="padding:10px 0;font-weight:600">${email || 'No ingresado'}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:10px 0;color:#6b7280;font-size:14px">Fecha</td>
            <td style="padding:10px 0;font-weight:600">${fechaFormateada}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:10px 0;color:#6b7280;font-size:14px">Hora(s)</td>
            <td style="padding:10px 0;font-weight:600">${horasFormateadas}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#6b7280;font-size:14px">Monto</td>
            <td style="padding:10px 0;font-weight:700;font-size:20px;color:#4d7d14">$${monto.toLocaleString('es-CL')}</td>
          </tr>
        </table>

        <div style="background:#fef9c3;border:1.5px solid #fde68a;border-radius:8px;padding:14px;margin-bottom:20px">
          <p style="margin:0;font-size:13px;color:#92400e">
            ⚠️ <strong>Verifica el comprobante</strong> antes de confirmar o rechazar la reserva.
          </p>
        </div>

        <a href="${comprobanteUrl}" style="${btnStyle};background:#f3f4f6;color:#374151;display:block;text-align:center;margin-bottom:16px">
          📎 Ver Comprobante de Transferencia
        </a>

        ${reservaId ? `
        <div style="display:flex;gap:12px;margin-top:8px">
          <a href="${baseUrl}/api/confirmar-reserva?id=${reservaId}&accion=aceptar" style="${btnStyle};background:#6aaa1e;color:white;flex:1;text-align:center">
            ✅ Aceptar reserva
          </a>
          <a href="${baseUrl}/api/confirmar-reserva?id=${reservaId}&accion=rechazar" style="${btnStyle};background:#dc2626;color:white;flex:1;text-align:center">
            ❌ Rechazar reserva
          </a>
        </div>
        <p style="text-align:center;font-size:12px;color:#9ca3af;margin-top:12px">
          Al hacer clic se enviará automáticamente un correo a ${email || 'el vecino'} con la respuesta.
        </p>
        ` : ''}

        <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px">
          Notificación automática — Gimnasio Collico
        </p>
      </div>
    </div>
  `

  try {
    const nodemailer = require('nodemailer')
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    })

    await transporter.sendMail({
      from: `"Gimnasio Collico" <${process.env.GMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `Nueva Reserva — ${fechaFormateada} ${horasFormateadas} — ${nombre}`,
      html: htmlBody
    })

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Error enviando correo:', error)
    res.status(500).json({ ok: false, error: error.message })
  }
}
