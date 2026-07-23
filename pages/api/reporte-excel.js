import * as XLSX from 'xlsx'
import { requireAdmin } from '../../lib/auth'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TIPO_EXC = {
  sobrebloqueada: 'Sobrebloqueada (no se cobra)',
  aviso_anticipado: 'Avisaron con anticipación (no se cobra)',
  recuperacion: 'Recuperación de hora (se cobra)',
}

function calcularHorasEnMes(diaSemana, mes) {
  const [year, month] = mes.split('-').map(Number)
  const diasEnMes = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= diasEnMes; d++) {
    if (new Date(year, month - 1, d).getDay() === diaSemana) count++
  }
  return count
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!requireAdmin(req, res)) return

  const { mes, reservas = [], bloqueos = [], excepciones = [], clubes = [], devoluciones = [] } = req.body
  const [year, month] = mes.split('-')
  const nombreMes = new Date(year, month - 1).toLocaleString('es-CL', { month: 'long', year: 'numeric' })

  const wb = XLSX.utils.book_new()

  // Hoja 1: Clubes con excepciones
  const clubsAgrupados = clubes.reduce((acc, b) => {
    if (!acc[b.motivo]) acc[b.motivo] = []
    acc[b.motivo].push(b)
    return acc
  }, {})

  const clubesRows = [
    ['HORAS DE CLUBES — GIMNASIO COLLICO'],
    [`Mes: ${nombreMes.toUpperCase()}`],
    [],
    ['Club', 'Días', 'Hrs programadas', 'Sobrebloqueadas', 'Con aviso previo', 'Recuperadas', 'Hrs a cobrar', 'Precio/hr', 'Monto total', 'Tipo'],
  ]

  let totalClubes = 0
  Object.entries(clubsAgrupados).forEach(([nombre, dias]) => {
    const horasPorDia = dias.reduce((acc, b) => { acc[b.dia_semana] = (acc[b.dia_semana] || 0) + 1; return acc }, {})
    const diasUnicos = Object.keys(horasPorDia).map(Number)
    const horasProgramadas = diasUnicos.reduce((s, dia) => s + calcularHorasEnMes(dia, mes) * horasPorDia[dia], 0)
    const excClub = excepciones.filter(e => e.nombre_club === nombre)
    const sobrebloqueadas = excClub.filter(e => e.tipo === 'sobrebloqueada').length
    const conAviso = excClub.filter(e => e.tipo === 'aviso_anticipado').length
    const recuperadas = excClub.filter(e => e.tipo === 'recuperacion').length
    const horasACobrar = Math.max(0, horasProgramadas - sobrebloqueadas - conAviso + recuperadas)
    const precioPorHora = dias[0].monto > 0 ? dias[0].monto : 10000
    const montoTotal = dias[0].tipo === 'pagado' ? horasACobrar * precioPorHora : 0
    totalClubes += montoTotal
    clubesRows.push([
      nombre,
      diasUnicos.map(d => DIAS[d]).join(', '),
      horasProgramadas,
      sobrebloqueadas > 0 ? `-${sobrebloqueadas}` : 0,
      conAviso > 0 ? `-${conAviso}` : 0,
      recuperadas > 0 ? `+${recuperadas}` : 0,
      horasACobrar,
      dias[0].tipo === 'pagado' ? precioPorHora : 0,
      montoTotal,
      dias[0].tipo === 'pagado' ? 'Pagado' : 'Gratuito / Convenio',
    ])
  })
  clubesRows.push([], ['', '', '', '', '', '', '', 'TOTAL CLUBES:', totalClubes, ''])

  const ws1 = XLSX.utils.aoa_to_sheet(clubesRows)
  ws1['!cols'] = [{ wch: 28 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 22 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Clubes')

  // Hoja 2: Excepciones
  const excRows = [
    ['EXCEPCIONES DE HORAS — GIMNASIO COLLICO'],
    [`Mes: ${nombreMes.toUpperCase()}`],
    [],
    ['Club', 'Fecha', 'Hora', 'Tipo', 'Hora liberada', 'Notas'],
    ...excepciones.map(e => [
      e.nombre_club,
      e.fecha.split('-').reverse().join('/'),
      `${e.hora.toString().padStart(2, '0')}:00`,
      TIPO_EXC[e.tipo] || e.tipo,
      e.liberar_hora ? 'Sí' : 'No',
      e.notas || '',
    ]),
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(excRows)
  ws2['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 36 }, { wch: 14 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Excepciones')

  // Hoja 3: Reservas vecinos
  const totalReservas = reservas.reduce((s, r) => s + (r.monto || 10000), 0)
  const reservasRows = [
    ['RESERVAS DE VECINOS — GIMNASIO COLLICO'],
    [`Mes: ${nombreMes.toUpperCase()}`],
    [],
    ['Fecha', 'Hora', 'Nombre', 'Celular', 'Monto ($)', 'Comprobante'],
    ...reservas.map(r => [
      r.fecha.split('-').reverse().join('/'),
      `${r.hora.toString().padStart(2, '0')}:00`,
      r.nombre_reservante,
      r.celular,
      r.monto || 10000,
      r.comprobante_url || '',
    ]),
    [],
    ['', '', '', 'TOTAL:', totalReservas, ''],
  ]
  const ws3 = XLSX.utils.aoa_to_sheet(reservasRows)
  ws3['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 14 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Reservas')

  // Hoja 4: Resumen
  const totalDevoluciones = devoluciones.reduce((s, d) => s + (d.monto || 0), 0)
  const totalBruto = totalReservas + totalClubes
  const resumenRows = [
    ['RESUMEN MENSUAL — GIMNASIO COLLICO'],
    [`Mes: ${nombreMes.toUpperCase()}`],
    [],
    ['Concepto', 'Cantidad', 'Total ($)'],
    ['Reservas de vecinos', reservas.length, totalReservas],
    ['Ingresos por clubes (pagados)', Object.values(clubsAgrupados).filter(d => d[0].tipo === 'pagado').length, totalClubes],
    ['Clubes gratuitos / convenio', Object.values(clubsAgrupados).filter(d => d[0].tipo === 'gratuito').length, 0],
    ['Excepciones: sobrebloqueadas', excepciones.filter(e => e.tipo === 'sobrebloqueada').length, 0],
    ['Excepciones: con aviso previo', excepciones.filter(e => e.tipo === 'aviso_anticipado').length, 0],
    ['Excepciones: recuperaciones', excepciones.filter(e => e.tipo === 'recuperacion').length, 0],
    [],
    ['TOTAL INGRESOS DEL MES (bruto)', '', totalBruto],
    ['- Devoluciones', devoluciones.length, -totalDevoluciones],
    [],
    ['TOTAL EFECTIVAMENTE PERCIBIDO', '', totalBruto - totalDevoluciones],
  ]
  const ws4 = XLSX.utils.aoa_to_sheet(resumenRows)
  ws4['!cols'] = [{ wch: 42 }, { wch: 12 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws4, 'Resumen')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename=reporte-gimnasio-${mes}.xlsx`)
  res.send(buffer)
}
