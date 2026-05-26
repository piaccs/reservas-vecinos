import * as XLSX from 'xlsx'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { mes, reservas, bloqueos } = req.body
  const [year, month] = mes.split('-')
  const nombreMes = new Date(year, month - 1).toLocaleString('es-CL', { month: 'long', year: 'numeric' })

  const wb = XLSX.utils.book_new()

  // Hoja 1: Reservas
  const reservasData = [
    ['REPORTE DE RESERVAS — GIMNASIO COLLICO'],
    [`Mes: ${nombreMes.toUpperCase()}`],
    [],
    ['Fecha', 'Hora', 'Nombre', 'Celular', 'Monto ($)', 'Comprobante'],
    ...reservas.map(r => [
      r.fecha.split('-').reverse().join('/'),
      `${r.hora.toString().padStart(2, '0')}:00`,
      r.nombre_reservante,
      r.celular,
      r.monto || 10000,
      r.comprobante_url || ''
    ]),
    [],
    ['', '', '', 'TOTAL RESERVAS:', reservas.reduce((s, r) => s + (r.monto || 10000), 0)]
  ]

  const ws1 = XLSX.utils.aoa_to_sheet(reservasData)
  ws1['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 14 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Reservas')

  // Hoja 2: Bloqueos
  const bloqueosData = [
    ['HORAS BLOQUEADAS — GIMNASIO COLLICO'],
    [`Mes: ${nombreMes.toUpperCase()}`],
    [],
    ['Fecha', 'Hora', 'Motivo', 'Tipo', 'Monto ($)'],
    ...bloqueos.map(b => [
      b.fecha.split('-').reverse().join('/'),
      `${b.hora.toString().padStart(2, '0')}:00`,
      b.motivo,
      b.tipo === 'pagado' ? 'Pagado' : 'Gratuito / Convenio',
      b.tipo === 'pagado' ? (b.monto || 0) : 0
    ]),
    [],
    ['', '', '', 'TOTAL PAGADOS:', bloqueos.filter(b => b.tipo === 'pagado').reduce((s, b) => s + (b.monto || 0), 0)]
  ]

  const ws2 = XLSX.utils.aoa_to_sheet(bloqueosData)
  ws2['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 40 }, { wch: 22 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Bloqueos')

  // Hoja 3: Resumen
  const totalReservas = reservas.reduce((s, r) => s + (r.monto || 10000), 0)
  const totalPagados = bloqueos.filter(b => b.tipo === 'pagado').reduce((s, b) => s + (b.monto || 0), 0)

  const resumenData = [
    ['RESUMEN MENSUAL — GIMNASIO COLLICO'],
    [`Mes: ${nombreMes.toUpperCase()}`],
    [],
    ['Concepto', 'Cantidad', 'Total ($)'],
    ['Reservas vecinos (pagadas)', reservas.length, totalReservas],
    ['Horas bloqueadas (pagas)', bloqueos.filter(b => b.tipo === 'pagado').length, totalPagados],
    ['Horas bloqueadas (gratuitas/convenio)', bloqueos.filter(b => b.tipo === 'gratuito').length, 0],
    [],
    ['TOTAL INGRESOS', '', totalReservas + totalPagados]
  ]

  const ws3 = XLSX.utils.aoa_to_sheet(resumenData)
  ws3['!cols'] = [{ wch: 42 }, { wch: 12 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws3, 'Resumen')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename=reporte-gimnasio-${mes}.xlsx`)
  res.send(buffer)
}
