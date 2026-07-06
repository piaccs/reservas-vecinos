import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'
import { crearLimiter } from '../../lib/rateLimiter'
import { sanitizar, validarUUID } from '../../lib/validators'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const limiter = crearLimiter({ max: 20, ventanaMs: 60 * 60 * 1000 })

function paginaHtml({ titulo, color, mensaje, detalle, boton }) {
  return `
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body{font-family:Arial,sans-serif;text-align:center;padding:60px 20px;background:#f4f6f0}
      .box{background:white;border-radius:16px;padding:40px;max-width:420px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,0.1)}
      h2{color:${color};margin-top:0}
      p{color:#374151;font-size:15px;line-height:1.5}
      .detalle{color:#6b7280;font-size:13px;margin-top:16px}
      a.btn{display:inline-block;margin-top:20px;padding:12px 24px;border-radius:8px;background:#dc2626;color:white;text-decoration:none;font-weight:700}
    </style></head>
    <body><div class="box">
      <h2>${titulo}</h2>
      <p>${mensaje}</p>
      ${detalle ? `<p class="detalle">${detalle}</p>` : ''}
      ${boton || ''}
    </div></body></html>
  `
}

function chileNow() {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }))
}

export default async function handler(req, res) {
  if (!limiter.permitir(req, res)) return

  const { id, confirmar } = req.query
  const idError = validarUUID(id)
  if (idError) return res.status(400).send(paginaHtml({ titulo: 'Enlace inválido', color: '#dc2626', mensaje: 'El enlace de cancelación no es válido.' }))

  const { data: reserva, error } = await supabase
    .from('reservas')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !reserva) {
    return res.status(404).send(paginaHtml({ titulo: 'Reserva no encontrada', color: '#dc2626', mensaje: 'No pudimos encontrar esta reserva.' }))
  }

  if (reserva.estado !== 'confirmada') {
    const estadoTexto = reserva.estado === 'cancelada' ? 'ya fue cancelada' : reserva.estado === 'rechazada' ? 'fue rechazada' : 'aún no ha sido confirmada'
    return res.status(200).send(paginaHtml({
      titulo: 'No se puede cancelar',
      color: '#6b7280',
      mensaje: `Esta reserva ${estadoTexto}, por lo que no corresponde cancelarla desde aquí.`,
      detalle: 'Si crees que esto es un error, comunícate al +56 9 4170 7439.'
    }))
  }

  // Todas las filas del mismo bloque de reserva (mismo vecino, misma fecha)
  const { data: filas } = await supabase
    .from('reservas')
    .select('*')
    .eq('nombre_reservante', reserva.nombre_reservante)
    .eq('fecha', reserva.fecha)
    .eq('email_reservante', reserva.email_reservante)
    .eq('estado', 'confirmada')

  const grupo = filas && filas.length ? filas : [reserva]
  const horaMinima = Math.min(...grupo.map(r => r.hora))
  const montoTotal = grupo.reduce((sum, r) => sum + Number(r.monto || 10000), 0)

  const [y, m, d] = reserva.fecha.split('-').map(Number)
  const objetivo = new Date(y, m - 1, d, horaMinima, 0, 0)
  const ahora = chileNow()
  const diffHoras = (objetivo - ahora) / (1000 * 60 * 60)

  if (diffHoras < 0) {
    return res.status(200).send(paginaHtml({
      titulo: 'No se puede cancelar',
      color: '#6b7280',
      mensaje: 'Esta hora ya pasó, por lo que no se puede cancelar ni corresponde devolución.',
      detalle: 'Si tienes dudas, comunícate al +56 9 4170 7439.'
    }))
  }

  const porcentaje = diffHoras >= 24 ? 100 : 50
  const montoDevolucion = Math.round(montoTotal * porcentaje / 100)
  const fechaFormateada = reserva.fecha.split('-').reverse().join('/')
  const horaFormateada = `${horaMinima.toString().padStart(2, '0')}:00`
  const montoFormateado = montoDevolucion.toLocaleString('es-CL')

  if (confirmar !== 'si') {
    return res.status(200).send(paginaHtml({
      titulo: '¿Cancelar tu reserva?',
      color: '#374151',
      mensaje: `Tu reserva es para el <strong>${fechaFormateada}</strong> a las <strong>${horaFormateada} hrs</strong>. Según la política de cancelación, te corresponde una devolución del <strong>${porcentaje}%</strong> ($${montoFormateado}).`,
      detalle: 'Esta acción no se puede deshacer.',
      boton: `<a class="btn" href="/api/cancelar-reserva?id=${encodeURIComponent(id)}&confirmar=si">Sí, cancelar mi reserva</a>`
    }))
  }

  const ids = grupo.map(r => r.id)
  const { error: updateError } = await supabase
    .from('reservas')
    .update({
      estado: 'cancelada',
      cancelada_en: new Date().toISOString(),
      porcentaje_devolucion: porcentaje,
      monto_devolucion: montoDevolucion,
      estado_devolucion: montoDevolucion > 0 ? 'pendiente' : null
    })
    .in('id', ids)

  if (updateError) {
    return res.status(500).send(paginaHtml({ titulo: 'Error', color: '#dc2626', mensaje: 'No se pudo procesar la cancelación. Intenta nuevamente o comunícate al +56 9 4170 7439.' }))
  }

  // Avisar a la directiva por correo para que gestione la devolución
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    })
    const nombreSeguro = sanitizar(reserva.nombre_reservante)
    await transporter.sendMail({
      from: `"Gimnasio Collico" <${process.env.GMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `Reserva cancelada — ${fechaFormateada} ${horaFormateada} — ${nombreSeguro}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <p><strong>${nombreSeguro}</strong> canceló su reserva del ${fechaFormateada} a las ${horaFormateada} hrs.</p>
          <p>Aviso con ${diffHoras >= 24 ? 'más' : 'menos'} de 24 hrs de anticipación → corresponde devolución del <strong>${porcentaje}%</strong> ($${montoFormateado}).</p>
          <p>Puedes gestionarla desde el panel de administrador, en la sección "Devoluciones".</p>
        </div>
      `
    })
  } catch (e) {
    // No bloquea la cancelación si falla el correo de aviso
  }

  return res.status(200).send(paginaHtml({
    titulo: '✅ Reserva cancelada',
    color: '#4d7d14',
    mensaje: `Tu reserva del ${fechaFormateada} a las ${horaFormateada} hrs fue cancelada.`,
    detalle: montoDevolucion > 0
      ? `Te corresponde una devolución de $${montoFormateado} (${porcentaje}%). La directiva se contactará contigo para coordinarla.`
      : 'No corresponde devolución para esta cancelación.'
  }))
}
