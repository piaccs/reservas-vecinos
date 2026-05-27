import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Head from 'next/head'

const HORAS = Array.from({ length: 15 }, (_, i) => i + 9)
const DIAS = { 0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' }

function formatHora(h) {
  return `${h.toString().padStart(2, '0')}:00`
}

function hoyChile() {
  const now = new Date()
  const chile = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }))
  return chile.toISOString().split('T')[0]
}

export default function AdminPanel() {
  const router = useRouter()
  const [admin, setAdmin] = useState(null)
  const [tab, setTab] = useState('bloqueos')

  // Bloqueos
  const [fechaBloqueo, setFechaBloqueo] = useState(hoyChile())
  const [horasSelBloqueo, setHorasSelBloqueo] = useState([])
  const [motivoBloqueo, setMotivoBloqueo] = useState('')
  const [tipoBloqueo, setTipoBloqueo] = useState('gratuito')
  const [montoBloqueo, setMontoBloqueo] = useState('')
  const [horasOcupadas, setHorasOcupadas] = useState([])
  const [horasBloqueadas, setHorasBloqueadas] = useState([])
  const [bloqueoActual, setBloqueoActual] = useState([])
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false)

  // Bloqueos indefinidos
  const [bloqueosMensuales, setBloqueosMensuales] = useState([])
  const [desbloqueoTemp, setDesbloqueoTemp] = useState({})

  // Clubes semanales
  const [clubes, setClubes] = useState([])
  const [nuevoClub, setNuevoClub] = useState({ motivo: '', tipo: 'gratuito', monto: '' })
  const [diasClub, setDiasClub] = useState([{ dia: 1, hora_inicio: 9, hora_fin: 10 }])
  const [guardandoClub, setGuardandoClub] = useState(false)
  const [clubExpandido, setClubExpandido] = useState(null)

  // Reporte
  const [mesReporte, setMesReporte] = useState(new Date().toISOString().slice(0, 7))
  const [reservasReporte, setReservasReporte] = useState([])
  const [bloqueosReporte, setBloqueosReporte] = useState([])
  const [cargandoReporte, setCargandoReporte] = useState(false)
  const [pagosClubs, setPagosClubs] = useState([])
  const [clubesSemanales, setClubesSemanales] = useState([])
  const [nuevoPago, setNuevoPago] = useState({ nombre_club: '', monto_pagado: '', fecha_pago: hoyChile(), notas: '' })
  const [guardandoPago, setGuardandoPago] = useState(false)

  // Reservas
  const [todasReservas, setTodasReservas] = useState([])
  const [cargandoReservas, setCargandoReservas] = useState(false)

  // Cuenta
  const [passActual, setPassActual] = useState('')
  const [passNueva, setPassNueva] = useState('')
  const [passConfirm, setPassConfirm] = useState('')
  const [msgPass, setMsgPass] = useState('')

  useEffect(() => {
    const session = sessionStorage.getItem('admin_session')
    if (!session) { router.push('/admin'); return }
    setAdmin(JSON.parse(session))
  }, [])

  useEffect(() => {
    if (tab === 'bloqueos') { cargarHorasBloqueo(); cargarBloqueosMensuales() }
    if (tab === 'clubes') cargarClubes()
    if (tab === 'reservas') cargarTodasReservas()
  }, [tab, fechaBloqueo])

  async function cargarHorasBloqueo() {
    const { data: reservas } = await supabase
      .from('reservas').select('hora').eq('fecha', fechaBloqueo).eq('estado', 'confirmada')
    const { data: bloqueos } = await supabase
      .from('bloqueos').select('hora, motivo, tipo, monto, indefinido').eq('fecha', fechaBloqueo)
    setHorasOcupadas(reservas ? reservas.map(r => r.hora) : [])
    setHorasBloqueadas(bloqueos ? bloqueos.map(b => b.hora) : [])
    setBloqueoActual(bloqueos || [])
  }

  async function cargarBloqueosMensuales() {
    const { data } = await supabase
      .from('bloqueos').select('*').eq('indefinido', true).order('hora')
    setBloqueosMensuales(data || [])
  }

  async function cargarClubes() {
    const { data } = await supabase.from('bloqueos_semanales').select('*').order('dia_semana').order('hora_inicio')
    setClubes(data || [])
  }

  async function agregarClub() {
    if (!nuevoClub.motivo.trim()) return alert('Escribe el nombre del club')
    if (nuevoClub.tipo === 'pagado' && !nuevoClub.monto) return alert('Escribe el monto')
    const diasValidos = diasClub.every(d => parseInt(d.hora_fin) > parseInt(d.hora_inicio))
    if (!diasValidos) {
      // Auto-fix: set hora_fin to hora_inicio + 1
      setDiasClub(prev => prev.map(d => ({ ...d, hora_fin: parseInt(d.hora_fin) <= parseInt(d.hora_inicio) ? parseInt(d.hora_inicio) + 1 : parseInt(d.hora_fin) })))
      setGuardandoClub(false)
      return alert('Se corrigieron las horas automáticamente. Intenta de nuevo.')
    }
    setGuardandoClub(true)

    const horas = []
    for (const d of diasClub) {
      for (let h = d.hora_inicio; h < d.hora_fin; h++) {
        horas.push({
          dia_semana: parseInt(d.dia),
          hora_inicio: h,
          hora_fin: h + 1,
          motivo: nuevoClub.motivo.trim(),
          tipo: nuevoClub.tipo,
          monto: nuevoClub.tipo === 'pagado' ? parseInt(nuevoClub.monto) : 0,
          activo: true
        })
      }
    }

    const { error } = await supabase.from('bloqueos_semanales').insert(horas)
    if (error) alert('Error: ' + error.message)
    else {
      setNuevoClub({ motivo: '', tipo: 'gratuito', monto: '' })
      setDiasClub([{ dia: 1, hora_inicio: 9, hora_fin: 10 }])
      await cargarClubes()
      alert('✅ Club agregado correctamente')
    }
    setGuardandoClub(false)
  }

  async function eliminarClub(motivo, dia) {
    if (!confirm(`¿Eliminar todos los horarios de "${motivo}" del ${DIAS[dia]}?`)) return
    await supabase.from('bloqueos_semanales').delete().eq('motivo', motivo).eq('dia_semana', dia)
    await cargarClubes()
  }

  async function toggleClub(id, activo) {
    await supabase.from('bloqueos_semanales').update({ activo: !activo }).eq('id', id)
    await cargarClubes()
  }

  async function cargarPagosClubs(mes) {
    const { data } = await supabase.from('pagos_clubes').select('*').eq('mes', mes).order('fecha_pago')
    setPagosClubs(data || [])
  }

  async function cargarClubesSemanales() {
    const { data } = await supabase.from('bloqueos_semanales').select('*').eq('activo', true)
    setClubesSemanales(data || [])
  }

  async function registrarPago() {
    if (!nuevoPago.nombre_club) return alert('Selecciona el club')
    if (!nuevoPago.monto_pagado) return alert('Ingresa el monto pagado')
    if (!nuevoPago.fecha_pago) return alert('Ingresa la fecha de pago')
    setGuardandoPago(true)
    const { error } = await supabase.from('pagos_clubes').insert({
      nombre_club: nuevoPago.nombre_club,
      mes: mesReporte,
      monto_pagado: parseInt(nuevoPago.monto_pagado),
      fecha_pago: nuevoPago.fecha_pago,
      notas: nuevoPago.notas || null,
      registrado_por: admin.email
    })
    if (error) alert('Error: ' + error.message)
    else {
      setNuevoPago({ nombre_club: '', monto_pagado: '', fecha_pago: hoyChile(), notas: '' })
      await cargarPagosClubs(mesReporte)
      alert('✅ Pago registrado')
    }
    setGuardandoPago(false)
  }

  async function eliminarPago(id) {
    if (!confirm('¿Eliminar este pago?')) return
    await supabase.from('pagos_clubes').delete().eq('id', id)
    await cargarPagosClubs(mesReporte)
  }

  function calcularHorasClubEnMes(club, mes) {
    const [year, month] = mes.split('-').map(Number)
    const diasEnMes = new Date(year, month, 0).getDate()
    let count = 0
    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = new Date(year, month - 1, d)
      if (fecha.getDay() === club.dia_semana) count++
    }
    return count
  }

  async function cargarTodasReservas() {
    setCargandoReservas(true)
    const { data } = await supabase
      .from('reservas').select('*')
      .eq('estado', 'confirmada')
      .order('fecha', { ascending: false })
      .order('hora', { ascending: true })
      .limit(200)
    setTodasReservas(data || [])
    setCargandoReservas(false)
  }

  async function guardarBloqueos() {
    if (horasSelBloqueo.length === 0) return alert('Selecciona al menos una hora')
    if (!motivoBloqueo.trim()) return alert('Escribe el motivo del bloqueo')
    if (tipoBloqueo === 'pagado' && !montoBloqueo) return alert('Escribe el monto')
    setGuardandoBloqueo(true)

    const bloqueos = horasSelBloqueo.map(hora => ({
      fecha: fechaBloqueo,
      hora,
      motivo: motivoBloqueo.trim(),
      tipo: tipoBloqueo,
      monto: tipoBloqueo === 'pagado' ? parseInt(montoBloqueo) : 0,
      bloqueado_por: admin.email,
      indefinido: false
    }))
    const { error } = await supabase.from('bloqueos').insert(bloqueos)
    if (error) alert('Error: ' + error.message)
    else { alert('✅ Horas bloqueadas'); await cargarHorasBloqueo() }

    setHorasSelBloqueo([])
    setMotivoBloqueo('')
    setMontoBloqueo('')
    setGuardandoBloqueo(false)
  }

  async function eliminarBloqueo(id) {
    if (!confirm('¿Eliminar este bloqueo?')) return
    await supabase.from('bloqueos').delete().eq('id', id)
    await cargarHorasBloqueo()
    await cargarBloqueosMensuales()
  }

  async function desbloquearPorDia(bloqueoId, hora) {
    const fecha = desbloqueoTemp[bloqueoId]
    if (!fecha) return alert('Selecciona la fecha que quieres desbloquear')
    if (!confirm(`¿Desbloquear la hora ${formatHora(hora)} solo el día ${fecha.split('-').reverse().join('/')}?`)) return

    // Insertar una "excepción" — en este caso simplemente no bloqueamos ese día
    // Borramos el bloqueo indefinido y creamos bloqueos para todos los días del mes excepto ese
    alert(`✅ La hora ${formatHora(hora)} quedará disponible el ${fecha.split('-').reverse().join('/')}.\n\nNota: Para esa fecha específica la hora aparecerá libre automáticamente.`)
    
    // Registrar excepción en tabla bloqueos con fecha específica marcada como "excepcion"
    await supabase.from('bloqueos').insert({
      fecha: fecha,
      hora: hora,
      motivo: 'EXCEPCION_DESBLOQUEADA',
      tipo: 'gratuito',
      monto: 0,
      bloqueado_por: admin.email,
      indefinido: false
    })
    setDesbloqueoTemp(prev => ({ ...prev, [bloqueoId]: '' }))
  }

  async function eliminarReserva(id, fecha, hora) {
    if (!confirm(`¿Eliminar la reserva del ${fecha.split('-').reverse().join('/')} a las ${formatHora(hora)}? La hora quedará disponible nuevamente.`)) return
    const { error } = await supabase.from('reservas').delete().eq('id', id)
    if (error) alert('Error al eliminar: ' + error.message)
    else {
      await cargarTodasReservas()
      alert('✅ Reserva eliminada. La hora está disponible nuevamente.')
    }
  }

  async function cargarReporte() {
    setCargandoReporte(true)
    const [year, month] = mesReporte.split('-')
    const inicio = `${year}-${month}-01`
    const fin = `${year}-${month}-31`
    const { data: reservas } = await supabase.from('reservas').select('*')
      .gte('fecha', inicio).lte('fecha', fin).eq('estado', 'confirmada').order('fecha').order('hora')
    const { data: bloqueos } = await supabase.from('bloqueos').select('*')
      .gte('fecha', inicio).lte('fecha', fin).order('fecha').order('hora')
    setReservasReporte(reservas || [])
    setBloqueosReporte(bloqueos || [])
    await cargarPagosClubs(mesReporte)
    await cargarClubesSemanales()
    setCargandoReporte(false)
  }

  async function descargarExcel() {
    if (reservasReporte.length === 0 && bloqueosReporte.length === 0) return alert('Carga el reporte primero.')
    const res = await fetch('/api/reporte-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes: mesReporte, reservas: reservasReporte, bloqueos: bloqueosReporte })
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-gimnasio-${mesReporte}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function cambiarContrasena() {
    setMsgPass('')
    if (passNueva !== passConfirm) return setMsgPass('Las contraseñas no coinciden')
    if (passNueva.length < 8) return setMsgPass('Mínimo 8 caracteres')
    const res = await fetch('/api/cambiar-contrasena', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: admin.email, actual: passActual, nueva: passNueva })
    })
    const data = await res.json()
    setMsgPass(data.ok ? '✅ Contraseña actualizada' : '❌ ' + (data.mensaje || 'Error'))
    if (data.ok) { setPassActual(''); setPassNueva(''); setPassConfirm('') }
  }

  function toggleHoraBloqueo(hora) {
    if (horasOcupadas.includes(hora)) return
    setHorasSelBloqueo(prev => prev.includes(hora) ? prev.filter(h => h !== hora) : [...prev, hora])
  }

  const totalReservas = reservasReporte.reduce((s, r) => s + (r.monto || 10000), 0)
  const totalBloqueosPagados = bloqueosReporte.filter(b => b.tipo === 'pagado').reduce((s, b) => s + (b.monto || 0), 0)

  if (!admin) return <div className="loading"><div className="spinner"></div>Verificando...</div>

  return (
    <>
      <Head><title>Panel Admin — Gimnasio Collico</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <div className="admin-container">
        <div className="admin-header">
          <div>
            <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '2rem', letterSpacing: '0.05em' }}>Panel Administrador</h1>
            <p style={{ opacity: 0.85, fontSize: '0.88rem' }}>Bienvenido, {admin.nombre} — {admin.email}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="/" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', textDecoration: 'none' }}>← Ver página pública</a>
            <button className="btn-admin" onClick={() => { sessionStorage.removeItem('admin_session'); router.push('/admin') }}>Cerrar sesión</button>
          </div>
        </div>

        <div className="admin-nav" style={{ marginBottom: '1.5rem' }}>
          {[
            { id: 'bloqueos', label: '🔒 Bloquear Horas' },
            { id: 'clubes', label: '🏃 Clubes Semanales' },
            { id: 'reporte', label: '📊 Reporte Mensual' },
            { id: 'reservas', label: '📋 Ver Reservas' },
            { id: 'cuenta', label: '⚙️ Mi Cuenta' }
          ].map(t => (
            <button key={t.id} className={`nav-btn ${tab === t.id ? 'activo' : 'inactivo'}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* TAB BLOQUEOS */}
        {tab === 'bloqueos' && (
          <>
            <div className="card">
              <div className="seccion-titulo">🔒 Bloquear Horas</div>

              <div className="form-grupo">
                <label className="form-label">Fecha</label>
                <input type="date" className="fecha-input" value={fechaBloqueo} onChange={e => setFechaBloqueo(e.target.value)} />
              </div>

              <div className="form-grupo">
                <label className="form-label">Selecciona las horas</label>
                <div className="horas-grid" style={{ marginTop: '8px' }}>
                  {HORAS.map(hora => {
                    const yaOcupada = horasOcupadas.includes(hora)
                    const yaBloqueada = horasBloqueadas.includes(hora)
                    const seleccionada = horasSelBloqueo.includes(hora)
                    let cls = 'hora-btn '
                    if (seleccionada) cls += 'hora-seleccionada'
                    else if (yaOcupada) cls += 'hora-ocupada'
                    else if (yaBloqueada) cls += 'hora-bloqueada'
                    else cls += 'hora-libre'
                    return (
                      <button key={hora} className={cls} onClick={() => toggleHoraBloqueo(hora)} disabled={yaOcupada || yaBloqueada}>
                        {formatHora(hora)}
                        <span className="hora-label">{seleccionada ? '✓ Selec.' : yaOcupada ? 'Con reserva' : yaBloqueada ? 'Bloqueada' : 'Libre'}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="form-grupo">
                <label className="form-label">Motivo</label>
                <input className="form-input" placeholder="Ej: Club de Fútbol Los Pumas" value={motivoBloqueo} onChange={e => setMotivoBloqueo(e.target.value)} />
              </div>

              <div className="form-grupo">
                <label className="form-label">Tipo de pago</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[{ val: 'gratuito', label: '🆓 Gratuito / Convenio' }, { val: 'pagado', label: '💰 Pagado' }].map(opt => (
                    <button key={opt.val} onClick={() => setTipoBloqueo(opt.val)} style={{ padding: '10px 16px', borderRadius: '8px', border: '2px solid', borderColor: tipoBloqueo === opt.val ? 'var(--verde)' : '#e5e7eb', background: tipoBloqueo === opt.val ? 'var(--verde)' : 'white', color: tipoBloqueo === opt.val ? 'white' : 'var(--gris-oscuro)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', fontWeight: 500 }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {tipoBloqueo === 'pagado' && (
                <div className="form-grupo">
                  <label className="form-label">Monto ($)</label>
                  <input className="form-input" type="number" placeholder="Ej: 10000" value={montoBloqueo} onChange={e => setMontoBloqueo(e.target.value)} />
                </div>
              )}

              <button className="btn-verde" onClick={guardarBloqueos} disabled={guardandoBloqueo || horasSelBloqueo.length === 0}>
                {guardandoBloqueo ? 'Guardando...' : `🔒 Bloquear ${horasSelBloqueo.length} hora(s) seleccionada(s)`}
              </button>
            </div>

            {bloqueoActual.length > 0 && (
              <div className="card">
                <div className="seccion-titulo">Bloqueos del {fechaBloqueo.split('-').reverse().join('/')}</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="tabla">
                    <thead><tr><th>Hora</th><th>Motivo</th><th>Tipo</th><th>Monto</th><th>Acción</th></tr></thead>
                    <tbody>
                      {bloqueoActual.map(b => (
                        <tr key={b.hora}>
                          <td><strong>{formatHora(b.hora)}</strong></td>
                          <td>{b.motivo}</td>
                          <td><span className={`badge ${b.tipo === 'pagado' ? 'badge-verde' : 'badge-amarillo'}`}>{b.tipo === 'pagado' ? 'Pagado' : 'Gratuito'}</span></td>
                          <td>{b.tipo === 'pagado' ? `$${b.monto?.toLocaleString('es-CL')}` : '—'}</td>
                          <td><button onClick={() => eliminarBloqueo(b.id)} style={{ color: 'var(--rojo)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>Eliminar</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB CLUBES SEMANALES */}
        {tab === 'clubes' && (
          <>
            <div className="card">
              <div className="seccion-titulo">➕ Agregar Club</div>
              <p style={{ color: 'var(--gris)', fontSize: '0.88rem', marginBottom: '1.2rem' }}>
                Crea un club con su horario semanal permanente. Las horas quedarán bloqueadas automáticamente cada semana.
              </p>

              <div className="form-grupo">
                <label className="form-label">Nombre del club</label>
                <input className="form-input" placeholder="Ej: Voleibol Tercer Tiempo" value={nuevoClub.motivo} onChange={e => setNuevoClub(p => ({ ...p, motivo: e.target.value }))} />
              </div>

              <div className="form-grupo">
                <label className="form-label">Días y horarios</label>
                {diasClub.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <select className="form-input" style={{ flex: '1', minWidth: '120px' }} value={d.dia} onChange={e => setDiasClub(prev => prev.map((x, j) => j === i ? { ...x, dia: parseInt(e.target.value) } : x))}>
                      {Object.entries(DIAS).map(([val, nombre]) => <option key={val} value={val}>{nombre}</option>)}
                    </select>
                    <select className="form-input" style={{ flex: '1', minWidth: '100px' }} value={d.hora_inicio} onChange={e => setDiasClub(prev => prev.map((x, j) => j === i ? { ...x, hora_inicio: parseInt(e.target.value) } : x))}>
                      {HORAS.map(h => <option key={h} value={h}>{formatHora(h)}</option>)}
                    </select>
                    <span style={{ color: 'var(--gris)' }}>a</span>
                    <select className="form-input" style={{ flex: '1', minWidth: '100px' }} value={d.hora_fin} onChange={e => setDiasClub(prev => prev.map((x, j) => j === i ? { ...x, hora_fin: parseInt(e.target.value) } : x))}>
                      {HORAS.filter(h => h > parseInt(d.hora_inicio)).map(h => <option key={h} value={h}>{formatHora(h)}</option>)}
                    </select>
                    {diasClub.length > 1 && (
                      <button onClick={() => setDiasClub(prev => prev.filter((_, j) => j !== i))} style={{ color: 'var(--rojo)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px' }}>✕</button>
                    )}
                  </div>
                ))}
                <button onClick={() => setDiasClub(prev => [...prev, { dia: 1, hora_inicio: 9, hora_fin: 10 }])} style={{ background: 'none', border: '1.5px dashed #d1d5db', borderRadius: '8px', padding: '8px 16px', color: 'var(--verde-oscuro)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', fontWeight: 600, marginTop: '4px' }}>
                  + Agregar otro día
                </button>
              </div>

              <div className="form-grupo">
                <label className="form-label">Tipo de pago</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[{ val: 'gratuito', label: '🆓 Gratuito / Convenio' }, { val: 'pagado', label: '💰 Pagado' }].map(opt => (
                    <button key={opt.val} onClick={() => setNuevoClub(p => ({ ...p, tipo: opt.val }))} style={{ padding: '10px 16px', borderRadius: '8px', border: '2px solid', borderColor: nuevoClub.tipo === opt.val ? 'var(--verde)' : '#e5e7eb', background: nuevoClub.tipo === opt.val ? 'var(--verde)' : 'white', color: nuevoClub.tipo === opt.val ? 'white' : 'var(--gris-oscuro)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', fontWeight: 500 }}>{opt.label}</button>
                  ))}
                </div>
              </div>

              {nuevoClub.tipo === 'pagado' && (
                <div className="form-grupo">
                  <label className="form-label">Monto por hora ($)</label>
                  <input className="form-input" type="number" placeholder="Ej: 10000" value={nuevoClub.monto} onChange={e => setNuevoClub(p => ({ ...p, monto: e.target.value }))} />
                </div>
              )}

              <button className="btn-verde" onClick={agregarClub} disabled={guardandoClub}>
                {guardandoClub ? 'Guardando...' : `➕ Agregar club — ${nuevoClub.motivo || 'sin nombre'} (${diasClub.length} día${diasClub.length > 1 ? 's' : ''})`}
              </button>
            </div>

            <div className="card">
              <div className="seccion-titulo">📋 Clubes Registrados</div>
              {clubes.length === 0 ? (
                <p style={{ color: 'var(--gris)', textAlign: 'center', padding: '2rem 0' }}>No hay clubes registrados aún.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(
                    clubes.reduce((acc, b) => {
                      if (!acc[b.motivo]) acc[b.motivo] = []
                      acc[b.motivo].push(b)
                      return acc
                    }, {})
                  ).map(([nombre, dias]) => {
                    const expandido = clubExpandido === nombre
                    const todosActivos = dias.every(d => d.activo)
                    return (
                      <div key={nombre} style={{ border: '1.5px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                        <div
                          onClick={() => setClubExpandido(expandido ? null : nombre)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: expandido ? '#f0fdf4' : 'white', cursor: 'pointer', gap: '12px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.2rem' }}>{expandido ? '▼' : '▶'}</span>
                            <strong style={{ fontSize: '0.95rem' }}>{nombre}</strong>
                            <span style={{ fontSize: '0.78rem', color: 'var(--gris)', background: '#f3f4f6', padding: '2px 8px', borderRadius: '10px' }}>{dias.length} día{dias.length > 1 ? 's' : ''}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span className={`badge ${todosActivos ? 'badge-verde' : 'badge-gris'}`}>{todosActivos ? '✓ Activo' : '⏸ Pausado'}</span>
                            <button
                              onClick={async e => { e.stopPropagation(); if(confirm(`¿Eliminar el club "${nombre}" y todos sus horarios?`)) { for(const d of dias) { await supabase.from('bloqueos_semanales').delete().eq('id', d.id) } await cargarClubes() } }}
                              style={{ color: 'var(--rojo)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}
                            >
                              🗑 Eliminar
                            </button>
                          </div>
                        </div>
                        {expandido && (
                          <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: '#fafafa' }}>
                            <table className="tabla" style={{ marginBottom: 0 }}>
                              <thead><tr><th>Día</th><th>Horario</th><th>Tipo</th><th>Estado</th></tr></thead>
                              <tbody>
                                {Object.entries(dias.reduce((acc, b) => {
                                  const key = b.dia_semana
                                  if (!acc[key]) acc[key] = { ...b, horas: [] }
                                  acc[key].horas.push(b.hora_inicio)
                                  return acc
                                }, {})).map(([dia, club]) => (
                                  <tr key={dia}>
                                    <td>{DIAS[club.dia_semana]}</td>
                                    <td>{formatHora(Math.min(...club.horas))} — {formatHora(Math.max(...club.horas) + 1)}</td>
                                    <td><span className={`badge ${club.tipo === 'pagado' ? 'badge-verde' : 'badge-amarillo'}`}>{club.tipo === 'pagado' ? 'Pagado' : 'Gratuito'}</span></td>
                                    <td>
                                      <button
                                        onClick={() => club.horas.forEach(h => { const b2 = dias.find(x => x.dia_semana === parseInt(dia) && x.hora_inicio === h); if(b2) toggleClub(b2.id, b2.activo) })}
                                        style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: club.activo ? '#dcfce7' : '#f3f4f6', color: club.activo ? '#15803d' : '#6b7280', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', fontFamily: 'DM Sans, sans-serif' }}
                                      >
                                        {club.activo ? '✓ Activo' : '⏸ Pausado'}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB REPORTE */}
        {tab === 'reporte' && (
          <div className="card">
            <div className="seccion-titulo">📊 Reporte Mensual</div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <label className="form-label">Mes</label>
                <input type="month" className="fecha-input" value={mesReporte} onChange={e => setMesReporte(e.target.value)} />
              </div>
              <button className="btn-verde" style={{ width: 'auto', padding: '10px 24px' }} onClick={cargarReporte} disabled={cargandoReporte}>
                {cargandoReporte ? 'Cargando...' : '🔍 Cargar'}
              </button>
              {(reservasReporte.length > 0 || bloqueosReporte.length > 0) && (
                <button className="btn-verde" style={{ width: 'auto', padding: '10px 24px', background: 'var(--verde-oscuro)' }} onClick={descargarExcel}>
                  📥 Descargar Excel
                </button>
              )}
            </div>

            {(reservasReporte.length > 0 || bloqueosReporte.length > 0) && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
                  {[
                    { label: 'Reservas pagadas', valor: reservasReporte.length, sub: `$${totalReservas.toLocaleString('es-CL')}`, color: '#f0fdf4', border: '#bbf7d0', textColor: 'var(--verde-oscuro)' },
                    { label: 'Horas bloqueadas', valor: bloqueosReporte.length, sub: `${bloqueosReporte.filter(b => b.tipo === 'gratuito').length} gratuitas`, color: '#fef9c3', border: '#fde68a', textColor: '#92400e' },
                    { label: 'Ingresos totales', valor: `$${(totalReservas + totalBloqueosPagados).toLocaleString('es-CL')}`, sub: 'reservas + pagados', color: '#eff6ff', border: '#bfdbfe', textColor: '#1d4ed8' }
                  ].map(item => (
                    <div key={item.label} style={{ background: item.color, border: `1.5px solid ${item.border}`, borderRadius: '10px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--gris)', marginBottom: '4px' }}>{item.label}</div>
                      <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.8rem', color: item.textColor, letterSpacing: '0.05em' }}>{item.valor}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--gris)' }}>{item.sub}</div>
                    </div>
                  ))}
                </div>

                {reservasReporte.length > 0 && (
                  <>
                    <h3 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.2rem', color: 'var(--verde-oscuro)', marginBottom: '0.8rem', letterSpacing: '0.05em' }}>Reservas del mes</h3>
                    <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                      <table className="tabla">
                        <thead><tr><th>Fecha</th><th>Hora</th><th>Nombre</th><th>Celular</th><th>Monto</th><th>Comprobante</th></tr></thead>
                        <tbody>
                          {reservasReporte.map(r => (
                            <tr key={r.id}>
                              <td>{r.fecha.split('-').reverse().join('/')}</td>
                              <td>{formatHora(r.hora)}</td>
                              <td>{r.nombre_reservante}</td>
                              <td>{r.celular}</td>
                              <td>${(r.monto || 10000).toLocaleString('es-CL')}</td>
                              <td>{r.comprobante_url ? <a href={r.comprobante_url} target="_blank" rel="noreferrer" style={{ color: 'var(--verde)', fontWeight: 600, fontSize: '0.85rem' }}>Ver 🔗</a> : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Seccion clubes semanales */}
            {clubesSemanales.length > 0 && (() => {
              const nombresMes = new Date(mesReporte + '-01').toLocaleString('es-CL', { month: 'long', year: 'numeric' })
              const clubsAgrupados = clubesSemanales.reduce((acc, b) => {
                if (!acc[b.motivo]) acc[b.motivo] = []
                acc[b.motivo].push(b)
                return acc
              }, {})

              return (
                <div style={{ marginTop: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.2rem', color: 'var(--verde-oscuro)', marginBottom: '0.8rem', letterSpacing: '0.05em' }}>
                    Clubes Semanales — {nombresMes}
                  </h3>
                  <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                    <table className="tabla">
                      <thead><tr><th>Club</th><th>Días/semana</th><th>Usos en el mes</th><th>Horas totales</th><th>Monto total</th><th>Estado pago</th></tr></thead>
                      <tbody>
                        {Object.entries(clubsAgrupados).map(([nombre, dias]) => {
                          const diasUnicos = [...new Set(dias.map(d => d.dia_semana))]
                          const horasPorUso = dias.reduce((s, d) => s + 1, 0) / diasUnicos.length
                          const usosEnMes = diasUnicos.reduce((s, dia) => {
                            const mockClub = { dia_semana: dia }
                            return s + calcularHorasClubEnMes(mockClub, mesReporte)
                          }, 0)
                          const horasTotales = usosEnMes * (dias.length / diasUnicos.length)
                          const precioPorHora = dias[0].monto > 0 ? dias[0].monto : 10000
                          const montoTotal = dias[0].tipo === 'pagado' ? horasTotales * precioPorHora : 0
                          const pagoRegistrado = pagosClubs.find(p => p.nombre_club === nombre)

                          return (
                            <tr key={nombre}>
                              <td><strong>{nombre}</strong></td>
                              <td>{diasUnicos.map(d => DIAS[d]).join(', ')}</td>
                              <td>{usosEnMes} veces</td>
                              <td>{horasTotales} hrs</td>
                              <td>{montoTotal > 0 ? `$${montoTotal.toLocaleString('es-CL')}` : 'Gratuito'}</td>
                              <td>
                                {montoTotal === 0 ? (
                                  <span className="badge badge-amarillo">Convenio</span>
                                ) : pagoRegistrado ? (
                                  <span className="badge badge-verde">✓ Pagado {pagoRegistrado.fecha_pago.split('-').reverse().join('/')}</span>
                                ) : (
                                  <span className="badge badge-rojo">⏳ Pendiente</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Registrar pago */}
                  <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '10px', padding: '1.2rem' }}>
                    <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1rem', color: 'var(--verde-oscuro)', letterSpacing: '0.05em', marginBottom: '1rem' }}>💰 Registrar Pago de Club</div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div>
                        <label className="form-label">Club</label>
                        <select className="form-input" style={{ minWidth: '180px' }} value={nuevoPago.nombre_club} onChange={e => setNuevoPago(p => ({ ...p, nombre_club: e.target.value }))}>
                          <option value="">Seleccionar...</option>
                          {Object.keys(clubsAgrupados).map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Monto pagado ($)</label>
                        <input className="form-input" type="number" placeholder="Ej: 80000" style={{ width: '140px' }} value={nuevoPago.monto_pagado} onChange={e => setNuevoPago(p => ({ ...p, monto_pagado: e.target.value }))} />
                      </div>
                      <div>
                        <label className="form-label">Fecha de pago</label>
                        <input className="form-input" type="date" style={{ width: '150px' }} value={nuevoPago.fecha_pago} onChange={e => setNuevoPago(p => ({ ...p, fecha_pago: e.target.value }))} />
                      </div>
                      <div>
                        <label className="form-label">Notas (opcional)</label>
                        <input className="form-input" placeholder="Ej: Pagó con transferencia" style={{ width: '200px' }} value={nuevoPago.notas} onChange={e => setNuevoPago(p => ({ ...p, notas: e.target.value }))} />
                      </div>
                      <button className="btn-verde" style={{ width: 'auto', padding: '10px 20px' }} onClick={registrarPago} disabled={guardandoPago}>
                        {guardandoPago ? 'Guardando...' : '✓ Registrar pago'}
                      </button>
                    </div>

                    {pagosClubs.length > 0 && (
                      <div style={{ marginTop: '1rem' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--verde-oscuro)', marginBottom: '6px' }}>Pagos registrados este mes:</div>
                        {pagosClubs.map(p => (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #dcfce7', fontSize: '0.85rem' }}>
                            <span><strong>{p.nombre_club}</strong> — ${p.monto_pagado.toLocaleString('es-CL')} — {p.fecha_pago.split('-').reverse().join('/')}{p.notas ? ` — ${p.notas}` : ''}</span>
                            <button onClick={() => eliminarPago(p.id)} style={{ color: 'var(--rojo)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {reservasReporte.length === 0 && bloqueosReporte.length === 0 && clubesSemanales.length === 0 && !cargandoReporte && (
              <p style={{ color: 'var(--gris)', textAlign: 'center', padding: '2rem 0' }}>Selecciona un mes y presiona "Cargar"</p>
            )}
          </div>
        )}

        {/* TAB RESERVAS */}
        {tab === 'reservas' && (
          <div className="card">
            <div className="seccion-titulo">📋 Todas las Reservas</div>
            {cargandoReservas ? (
              <div className="loading"><div className="spinner"></div>Cargando...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="tabla">
                  <thead><tr><th>Fecha</th><th>Hora</th><th>Nombre</th><th>Celular</th><th>Monto</th><th>Comprobante</th><th>Eliminar</th></tr></thead>
                  <tbody>
                    {todasReservas.map(r => (
                      <tr key={r.id}>
                        <td>{r.fecha?.split('-').reverse().join('/')}</td>
                        <td>{formatHora(r.hora)}</td>
                        <td>{r.nombre_reservante}</td>
                        <td>{r.celular}</td>
                        <td>${(r.monto || 10000).toLocaleString('es-CL')}</td>
                        <td>{r.comprobante_url ? <a href={r.comprobante_url} target="_blank" rel="noreferrer" style={{ color: 'var(--verde)', fontWeight: 600, fontSize: '0.85rem' }}>Ver 🔗</a> : '—'}</td>
                        <td>
                          <button onClick={() => eliminarReserva(r.id, r.fecha, r.hora)} style={{ color: 'var(--rojo)', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>
                            🗑 Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {todasReservas.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gris)', padding: '2rem' }}>No hay reservas</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB CUENTA */}
        {tab === 'cuenta' && (
          <div className="card" style={{ maxWidth: '480px' }}>
            <div className="seccion-titulo">⚙️ Cambiar Contraseña</div>
            <div className="form-grupo">
              <label className="form-label">Contraseña actual</label>
              <input className="form-input" type="password" value={passActual} onChange={e => setPassActual(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="form-grupo">
              <label className="form-label">Nueva contraseña</label>
              <input className="form-input" type="password" value={passNueva} onChange={e => setPassNueva(e.target.value)} placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="form-grupo">
              <label className="form-label">Confirmar nueva contraseña</label>
              <input className="form-input" type="password" value={passConfirm} onChange={e => setPassConfirm(e.target.value)} placeholder="Repite la nueva contraseña" />
            </div>
            {msgPass && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '1rem', background: msgPass.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${msgPass.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`, color: msgPass.startsWith('✅') ? 'var(--verde-oscuro)' : 'var(--rojo)', fontSize: '0.88rem' }}>
                {msgPass}
              </div>
            )}
            <button className="btn-verde" onClick={cambiarContrasena}>Actualizar contraseña</button>
          </div>
        )}
      </div>
    </>
  )
}
