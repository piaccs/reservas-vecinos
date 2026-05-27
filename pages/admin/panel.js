import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Head from 'next/head'
import Icon from '../../components/Icon'

const HORAS = Array.from({ length: 15 }, (_, i) => i + 9)
const DIAS = { 0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' }
const DIAS_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

function formatHora(h) { return `${h.toString().padStart(2, '0')}:00` }

function hoyChile() {
  const now = new Date()
  const chile = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }))
  return chile.toISOString().split('T')[0]
}

function formatFechaCorta(yyyymmdd) {
  if (!yyyymmdd) return ''
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  const obj = new Date(y, m - 1, d)
  return `${DIAS_CORTOS[obj.getDay()]} ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`
}

function initials(name) {
  if (!name) return 'AD'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'AD'
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
  const [filtroReservas, setFiltroReservas] = useState('todas')
  const [busquedaReservas, setBusquedaReservas] = useState('')

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
    if (tab === 'bloqueos') cargarHorasBloqueo()
    if (tab === 'clubes') cargarClubes()
    if (tab === 'reservas') cargarTodasReservas()
  }, [tab, fechaBloqueo])

  async function cargarHorasBloqueo() {
    const { data: reservas } = await supabase
      .from('reservas').select('hora').eq('fecha', fechaBloqueo).eq('estado', 'confirmada')
    const { data: bloqueos } = await supabase
      .from('bloqueos').select('hora, motivo, tipo, monto, indefinido, id').eq('fecha', fechaBloqueo)
    setHorasOcupadas(reservas ? reservas.map(r => r.hora) : [])
    setHorasBloqueadas(bloqueos ? bloqueos.map(b => b.hora) : [])
    setBloqueoActual(bloqueos || [])
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
          hora_inicio: h, hora_fin: h + 1,
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
      alert('✓ Club agregado correctamente')
    }
    setGuardandoClub(false)
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
      alert('✓ Pago registrado')
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
      fecha: fechaBloqueo, hora,
      motivo: motivoBloqueo.trim(),
      tipo: tipoBloqueo,
      monto: tipoBloqueo === 'pagado' ? parseInt(montoBloqueo) : 0,
      bloqueado_por: admin.email,
      indefinido: false
    }))
    const { error } = await supabase.from('bloqueos').insert(bloqueos)
    if (error) alert('Error: ' + error.message)
    else { alert('✓ Horas bloqueadas'); await cargarHorasBloqueo() }

    setHorasSelBloqueo([])
    setMotivoBloqueo('')
    setMontoBloqueo('')
    setGuardandoBloqueo(false)
  }

  async function eliminarBloqueo(id) {
    if (!confirm('¿Eliminar este bloqueo?')) return
    await supabase.from('bloqueos').delete().eq('id', id)
    await cargarHorasBloqueo()
  }

  async function eliminarReserva(id, fecha, hora) {
    if (!confirm(`¿Eliminar la reserva del ${fecha.split('-').reverse().join('/')} a las ${formatHora(hora)}? La hora quedará disponible nuevamente.`)) return
    const { error } = await supabase.from('reservas').delete().eq('id', id)
    if (error) alert('Error al eliminar: ' + error.message)
    else { await cargarTodasReservas(); alert('✓ Reserva eliminada. La hora está disponible nuevamente.') }
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
    setMsgPass(data.ok ? '✓ Contraseña actualizada' : '✕ ' + (data.mensaje || 'Error'))
    if (data.ok) { setPassActual(''); setPassNueva(''); setPassConfirm('') }
  }

  function toggleHoraBloqueo(hora) {
    if (horasOcupadas.includes(hora)) return
    setHorasSelBloqueo(prev => prev.includes(hora) ? prev.filter(h => h !== hora) : [...prev, hora])
  }

  const totalReservas = reservasReporte.reduce((s, r) => s + (r.monto || 10000), 0)
  const totalBloqueosPagados = bloqueosReporte.filter(b => b.tipo === 'pagado').reduce((s, b) => s + (b.monto || 0), 0)

  // Filtros de reservas
  const reservasFiltradas = todasReservas.filter(r => {
    const hoy = hoyChile()
    if (filtroReservas === 'proximas' && r.fecha < hoy) return false
    if (filtroReservas === 'pasadas' && r.fecha >= hoy) return false
    if (busquedaReservas) {
      const q = busquedaReservas.toLowerCase()
      if (!r.nombre_reservante?.toLowerCase().includes(q) && !r.celular?.includes(q)) return false
    }
    return true
  })

  const totalProximas = todasReservas.filter(r => r.fecha >= hoyChile()).length
  const totalPasadas = todasReservas.filter(r => r.fecha < hoyChile()).length

  if (!admin) return <div className="loading"><div className="spinner"></div>Verificando…</div>

  const tabs = [
    { id: 'bloqueos', label: 'Bloquear horas', icon: 'lock' },
    { id: 'clubes',   label: 'Clubes semanales', icon: 'users' },
    { id: 'reporte',  label: 'Reporte mensual', icon: 'chart' },
    { id: 'reservas', label: 'Ver reservas', icon: 'list' },
    { id: 'cuenta',   label: 'Mi cuenta', icon: 'settings' },
  ]

  return (
    <>
      <Head>
        <title>Panel Admin — Gimnasio Collico</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="admin-shell">
        {/* Top header */}
        <header className="admin-header">
          <div className="admin-header-info">
            <div className="header-logo-box">
              <span>JV</span>
              <span className="logo-sub">N°25</span>
            </div>
            <div>
              <h1>Gimnasio Collico · Administración</h1>
              <p>Junta de Vecinos N°25 · Valdivia</p>
            </div>
          </div>
          <div className="admin-header-actions">
            <a href="/" className="link-public">Ver página pública →</a>
            <div className="admin-user-chip">
              <div className="avatar">{initials(admin.nombre)}</div>
              <div className="name">{admin.nombre || admin.email}</div>
              <button
                onClick={() => { sessionStorage.removeItem('admin_session'); router.push('/admin') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-dim)', fontSize: '0.74rem', padding: '2px 6px' }}
              >
                Salir
              </button>
            </div>
          </div>
        </header>

        <div className="admin-body">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-section">Gestión</div>
            {tabs.map(t => (
              <button
                key={t.id}
                className={`nav-btn ${tab === t.id ? 'activo' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <Icon name={t.icon} size={16} className="icon" />
                {t.label}
              </button>
            ))}

            <div className="sidebar-resumen">
              <div className="title">Resumen del mes</div>
              <div className="row">
                <div>{reservasReporte.length || todasReservas.filter(r => r.fecha?.startsWith(mesReporte)).length} reservas</div>
                <div>{clubes.filter(c => c.activo).length > 0 ? `${[...new Set(clubes.filter(c => c.activo).map(c => c.motivo))].length} clubes activos` : 'Sin clubes activos'}</div>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="admin-main">

            {/* ============ TAB BLOQUEOS ============ */}
            {tab === 'bloqueos' && (
              <>
                <div className="admin-page-header">
                  <div>
                    <div className="kicker">Bloqueos de calendario</div>
                    <h1>Bloquear horas</h1>
                    <p className="subtitle">
                      Reserva horas para eventos puntuales o usuarios externos. Para clubes recurrentes, usa la pestaña <em>Clubes semanales</em>.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 20 }} className="bloqueos-grid">
                  {/* Form */}
                  <div className="card">
                    <div className="flex-between" style={{ marginBottom: 14 }}>
                      <div className="seccion-titulo" style={{ marginBottom: 0 }}>
                        Día a bloquear
                      </div>
                      <input
                        type="date"
                        className="fecha-input"
                        style={{ maxWidth: 180, padding: '7px 10px', fontSize: '0.86rem' }}
                        value={fechaBloqueo}
                        onChange={e => setFechaBloqueo(e.target.value)}
                      />
                    </div>

                    <div className="form-grupo">
                      <label className="form-label">Selecciona las horas</label>
                      <div className="horas-grid">
                        {HORAS.map(hora => {
                          const yaOcupada = horasOcupadas.includes(hora)
                          const yaBloqueada = horasBloqueadas.includes(hora)
                          const seleccionada = horasSelBloqueo.includes(hora)
                          let cls = 'hora-btn '
                          let lbl = 'Libre'
                          if (seleccionada) { cls += 'hora-seleccionada'; lbl = '✓ Selec.' }
                          else if (yaOcupada) { cls += 'hora-ocupada'; lbl = 'Reservada' }
                          else if (yaBloqueada) { cls += 'hora-bloqueada'; lbl = 'Bloqueada' }
                          else cls += 'hora-libre'
                          return (
                            <button
                              key={hora}
                              className={cls}
                              onClick={() => toggleHoraBloqueo(hora)}
                              disabled={yaOcupada || yaBloqueada}
                              type="button"
                            >
                              <span className="hora-num">{formatHora(hora)}</span>
                              <span className="hora-label">{lbl}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-grupo" style={{ marginBottom: 0 }}>
                        <label className="form-label">Motivo</label>
                        <input
                          className="form-input"
                          placeholder="Ej: Mantención cancha"
                          value={motivoBloqueo}
                          onChange={e => setMotivoBloqueo(e.target.value)}
                        />
                      </div>
                      <div className="form-grupo" style={{ marginBottom: 0 }}>
                        <label className="form-label">Tipo de pago</label>
                        <div className="toggle-row">
                          {[
                            { val: 'gratuito', label: 'Gratuito' },
                            { val: 'pagado', label: 'Pagado' },
                          ].map(opt => (
                            <button
                              key={opt.val}
                              type="button"
                              className={`toggle-opt ${tipoBloqueo === opt.val ? 'active' : ''}`}
                              onClick={() => setTipoBloqueo(opt.val)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {tipoBloqueo === 'pagado' && (
                      <div className="form-grupo" style={{ marginTop: 12 }}>
                        <label className="form-label">Monto ($)</label>
                        <input
                          className="form-input"
                          type="number"
                          placeholder="Ej: 10000"
                          value={montoBloqueo}
                          onChange={e => setMontoBloqueo(e.target.value)}
                        />
                      </div>
                    )}

                    <button
                      className="btn-verde btn-split"
                      onClick={guardarBloqueos}
                      disabled={guardandoBloqueo || horasSelBloqueo.length === 0}
                      style={{ marginTop: 16 }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="lock" size={14} color="#fff" />
                        {guardandoBloqueo
                          ? 'Guardando…'
                          : `Bloquear ${horasSelBloqueo.length || ''} hora${horasSelBloqueo.length !== 1 ? 's' : ''}`}
                      </span>
                      {!guardandoBloqueo && horasSelBloqueo.length > 0 && (
                        <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                          {horasSelBloqueo.map(formatHora).join(' · ')}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Right: existing blocks today */}
                  <div className="card">
                    <div className="seccion-titulo">
                      Ocupado el {fechaBloqueo.split('-').reverse().join('/')}
                    </div>
                    {bloqueoActual.length === 0 && horasOcupadas.length === 0 ? (
                      <p style={{ color: 'var(--ink-dim)', textAlign: 'center', padding: '2rem 0', fontSize: '0.88rem' }}>
                        No hay bloqueos ni reservas en este día.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {bloqueoActual.map(b => (
                          <div key={b.id} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 12px', borderRadius: 9,
                            background: 'var(--bg)', border: '1px solid var(--border-soft)',
                          }}>
                            <div className="font-display" style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink)', width: 50 }}>
                              {formatHora(b.hora)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', color: 'var(--ink)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {b.motivo}
                              </div>
                              <div className="small-caps" style={{ marginTop: 2 }}>
                                {b.tipo === 'pagado' ? `Pagado · $${b.monto?.toLocaleString('es-CL')}` : 'Gratuito'}
                              </div>
                            </div>
                            <button className="link-action danger" onClick={() => eliminarBloqueo(b.id)}>Eliminar</button>
                          </div>
                        ))}
                        {horasOcupadas.map(h => (
                          <div key={`r-${h}`} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 12px', borderRadius: 9,
                            background: 'var(--bg)', border: '1px solid var(--border-soft)',
                          }}>
                            <div className="font-display" style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink)', width: 50 }}>
                              {formatHora(h)}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.82rem', color: 'var(--ink)', fontWeight: 500 }}>Reserva confirmada</div>
                              <div className="small-caps" style={{ marginTop: 2 }}>De vecino</div>
                            </div>
                            <span className="badge badge-verde"><span className="dot"></span>$10.000</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ============ TAB CLUBES ============ */}
            {tab === 'clubes' && (
              <>
                <div className="admin-page-header">
                  <div>
                    <div className="kicker">Bloqueos recurrentes</div>
                    <h1>Clubes semanales</h1>
                    <p className="subtitle">
                      Crea horarios fijos que se bloquean automáticamente cada semana. Útil para clubes y talleres.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 20 }} className="clubes-grid">
                  {/* Form */}
                  <div className="card">
                    <div className="seccion-titulo">Nuevo club</div>
                    <p style={{ color: 'var(--ink-dim)', fontSize: '0.82rem', marginBottom: '1rem', marginTop: '-0.5rem' }}>
                      Quedará bloqueado automáticamente cada semana.
                    </p>

                    <div className="form-grupo">
                      <label className="form-label">Nombre del club</label>
                      <input
                        className="form-input"
                        placeholder="Ej: Voleibol Tercer Tiempo"
                        value={nuevoClub.motivo}
                        onChange={e => setNuevoClub(p => ({ ...p, motivo: e.target.value }))}
                      />
                    </div>

                    <div className="form-grupo">
                      <label className="form-label">Días y horarios</label>
                      {diasClub.map((d, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                          <select
                            className="form-input"
                            style={{ flex: 1, minWidth: 110 }}
                            value={d.dia}
                            onChange={e => setDiasClub(prev => prev.map((x, j) => j === i ? { ...x, dia: parseInt(e.target.value) } : x))}
                          >
                            {Object.entries(DIAS).map(([val, nombre]) => <option key={val} value={val}>{nombre}</option>)}
                          </select>
                          <select
                            className="form-input"
                            style={{ flex: 1, minWidth: 90 }}
                            value={d.hora_inicio}
                            onChange={e => setDiasClub(prev => prev.map((x, j) => j === i ? { ...x, hora_inicio: parseInt(e.target.value) } : x))}
                          >
                            {HORAS.map(h => <option key={h} value={h}>{formatHora(h)}</option>)}
                          </select>
                          <span style={{ color: 'var(--ink-dim)', fontSize: '0.82rem' }}>a</span>
                          <select
                            className="form-input"
                            style={{ flex: 1, minWidth: 90 }}
                            value={d.hora_fin}
                            onChange={e => setDiasClub(prev => prev.map((x, j) => j === i ? { ...x, hora_fin: parseInt(e.target.value) } : x))}
                          >
                            {HORAS.filter(h => h > parseInt(d.hora_inicio)).map(h => <option key={h} value={h}>{formatHora(h)}</option>)}
                          </select>
                          {diasClub.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setDiasClub(prev => prev.filter((_, j) => j !== i))}
                              style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px' }}
                            >
                              <Icon name="x" size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDiasClub(prev => [...prev, { dia: 1, hora_inicio: 9, hora_fin: 10 }])}
                        style={{
                          background: 'none', border: '1.5px dashed var(--border)', borderRadius: 9,
                          padding: '8px 16px', color: 'var(--verde)', cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, marginTop: 4,
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <Icon name="plus" size={13} /> Agregar otro día
                      </button>
                    </div>

                    <div className="form-grupo">
                      <label className="form-label">Tipo de pago</label>
                      <div className="toggle-row">
                        {[
                          { val: 'gratuito', label: 'Gratuito / convenio' },
                          { val: 'pagado', label: 'Pagado' },
                        ].map(opt => (
                          <button
                            key={opt.val}
                            type="button"
                            className={`toggle-opt ${nuevoClub.tipo === opt.val ? 'active' : ''}`}
                            onClick={() => setNuevoClub(p => ({ ...p, tipo: opt.val }))}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {nuevoClub.tipo === 'pagado' && (
                      <div className="form-grupo">
                        <label className="form-label">Monto por hora ($)</label>
                        <input
                          className="form-input"
                          type="number"
                          placeholder="Ej: 10000"
                          value={nuevoClub.monto}
                          onChange={e => setNuevoClub(p => ({ ...p, monto: e.target.value }))}
                        />
                      </div>
                    )}

                    <button className="btn-verde" onClick={agregarClub} disabled={guardandoClub}>
                      <Icon name="plus" size={14} color="#fff" />
                      {guardandoClub
                        ? 'Guardando…'
                        : `Agregar club ${nuevoClub.motivo ? `— ${nuevoClub.motivo}` : ''} (${diasClub.length} día${diasClub.length > 1 ? 's' : ''})`}
                    </button>
                  </div>

                  {/* List */}
                  <div>
                    <div className="flex-between" style={{ marginBottom: 12 }}>
                      <div className="seccion-titulo" style={{ marginBottom: 0 }}>Registrados</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--ink-dim)' }}>
                        {[...new Set(clubes.map(c => c.motivo))].length} clubes
                      </div>
                    </div>

                    {clubes.length === 0 ? (
                      <p style={{ color: 'var(--ink-dim)', textAlign: 'center', padding: '2rem 0', fontSize: '0.88rem' }}>
                        No hay clubes registrados aún.
                      </p>
                    ) : (
                      <div>
                        {Object.entries(
                          clubes.reduce((acc, b) => {
                            if (!acc[b.motivo]) acc[b.motivo] = []
                            acc[b.motivo].push(b)
                            return acc
                          }, {})
                        ).map(([nombre, dias]) => {
                          const expandido = clubExpandido === nombre
                          const todosActivos = dias.every(d => d.activo)
                          const diasAgrupados = Object.entries(dias.reduce((acc, b) => {
                            const key = b.dia_semana
                            if (!acc[key]) acc[key] = { ...b, horas: [] }
                            acc[key].horas.push(b.hora_inicio)
                            return acc
                          }, {}))

                          return (
                            <div key={nombre} className="club-card">
                              <div
                                className={`club-head ${expandido ? 'expanded' : ''}`}
                                onClick={() => setClubExpandido(expandido ? null : nombre)}
                              >
                                <div className="left">
                                  <Icon name={expandido ? 'chevron-down' : 'arrow-right'} size={14} color="var(--ink-dim)" />
                                  <div>
                                    <div className="name">{nombre}</div>
                                    <div className="meta">
                                      {diasAgrupados.length} día{diasAgrupados.length > 1 ? 's' : ''} ·{' '}
                                      {dias[0].tipo === 'pagado' ? `$${dias[0].monto?.toLocaleString('es-CL')}/hr` : 'Gratuito'}
                                    </div>
                                  </div>
                                </div>
                                <span className={`badge ${todosActivos ? 'badge-verde' : 'badge-gris'}`}>
                                  <span className="dot"></span>
                                  {todosActivos ? 'Activo' : 'Pausado'}
                                </span>
                              </div>
                              {expandido && (
                                <div className="club-body">
                                  <table className="tabla">
                                    <thead>
                                      <tr>
                                        <th>Día</th>
                                        <th>Horario</th>
                                        <th style={{ textAlign: 'right' }}>Acción</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {diasAgrupados.map(([diaSem, club]) => (
                                        <tr key={diaSem}>
                                          <td>{DIAS[club.dia_semana]}</td>
                                          <td className="num-strong">
                                            {formatHora(Math.min(...club.horas))} — {formatHora(Math.max(...club.horas) + 1)}
                                          </td>
                                          <td style={{ textAlign: 'right' }}>
                                            <button
                                              className="link-action"
                                              onClick={() => club.horas.forEach(h => {
                                                const b2 = dias.find(x => x.dia_semana === parseInt(diaSem) && x.hora_inicio === h)
                                                if (b2) toggleClub(b2.id, b2.activo)
                                              })}
                                            >
                                              {club.activo ? 'Pausar' : 'Activar'}
                                            </button>
                                            <button
                                              className="link-action danger"
                                              onClick={async (e) => {
                                                e.stopPropagation()
                                                if (confirm(`¿Eliminar los horarios de "${nombre}" del ${DIAS[club.dia_semana]}?`)) {
                                                  for (const h of club.horas) {
                                                    const b2 = dias.find(x => x.dia_semana === parseInt(diaSem) && x.hora_inicio === h)
                                                    if (b2) await supabase.from('bloqueos_semanales').delete().eq('id', b2.id)
                                                  }
                                                  await cargarClubes()
                                                }
                                              }}
                                            >
                                              Eliminar
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
                </div>
              </>
            )}

            {/* ============ TAB REPORTE ============ */}
            {tab === 'reporte' && (
              <>
                <div className="admin-page-header">
                  <div>
                    <div className="kicker">Estado financiero del mes</div>
                    <h1>Reporte mensual</h1>
                    <p className="subtitle">Resumen de ingresos por reservas y clubes.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <input
                      type="month"
                      className="fecha-input"
                      style={{ maxWidth: 180, padding: '8px 12px' }}
                      value={mesReporte}
                      onChange={e => setMesReporte(e.target.value)}
                    />
                    <button className="btn-outline" onClick={cargarReporte} disabled={cargandoReporte}>
                      <Icon name="search" size={13} />
                      {cargandoReporte ? 'Cargando…' : 'Cargar'}
                    </button>
                    {(reservasReporte.length > 0 || bloqueosReporte.length > 0) && (
                      <button className="btn-outline" onClick={descargarExcel} style={{ borderColor: 'var(--verde)', color: 'var(--verde)' }}>
                        <Icon name="download" size={13} />
                        Descargar Excel
                      </button>
                    )}
                  </div>
                </div>

                {(reservasReporte.length > 0 || bloqueosReporte.length > 0) && (
                  <>
                    <div className="stats-row">
                      <div className="stat-card verde">
                        <div className="label">Reservas pagadas</div>
                        <div className="value">{reservasReporte.length}</div>
                        <div className="sub">${totalReservas.toLocaleString('es-CL')} recaudados</div>
                      </div>
                      <div className="stat-card amber">
                        <div className="label">Horas bloqueadas</div>
                        <div className="value">{bloqueosReporte.length}</div>
                        <div className="sub">{bloqueosReporte.filter(b => b.tipo === 'gratuito').length} gratuitas</div>
                      </div>
                      <div className="stat-card accent">
                        <div className="label">Clubes pagados</div>
                        <div className="value">${totalBloqueosPagados.toLocaleString('es-CL')}</div>
                        <div className="sub">{bloqueosReporte.filter(b => b.tipo === 'pagado').length} bloqueos</div>
                      </div>
                      <div className="stat-card">
                        <div className="label">Ingresos totales</div>
                        <div className="value">${(totalReservas + totalBloqueosPagados).toLocaleString('es-CL')}</div>
                        <div className="sub">reservas + pagados</div>
                      </div>
                    </div>

                    {reservasReporte.length > 0 && (
                      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <div className="seccion-titulo" style={{ marginBottom: 0 }}>Reservas del mes</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--ink-dim)' }}>{reservasReporte.length} reservas · ${totalReservas.toLocaleString('es-CL')}</div>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table className="tabla">
                            <thead>
                              <tr>
                                <th style={{ paddingLeft: 22 }}>Fecha</th>
                                <th>Hora</th>
                                <th>Nombre</th>
                                <th>Celular</th>
                                <th style={{ textAlign: 'right' }}>Monto</th>
                                <th style={{ textAlign: 'right', paddingRight: 22 }}>Comprobante</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reservasReporte.map(r => (
                                <tr key={r.id}>
                                  <td style={{ paddingLeft: 22 }} className="num-strong">{formatFechaCorta(r.fecha)}</td>
                                  <td className="num-strong">{formatHora(r.hora)}</td>
                                  <td>{r.nombre_reservante}</td>
                                  <td className="text-dim">{r.celular}</td>
                                  <td style={{ textAlign: 'right', color: 'var(--verde)', fontWeight: 600 }}>${(r.monto || 10000).toLocaleString('es-CL')}</td>
                                  <td style={{ textAlign: 'right', paddingRight: 22 }}>
                                    {r.comprobante_url ? (
                                      <a className="link-action" href={r.comprobante_url} target="_blank" rel="noreferrer">
                                        <Icon name="eye" size={12} /> Ver
                                      </a>
                                    ) : <span className="text-dim">—</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {clubesSemanales.length > 0 && (() => {
                  const clubsAgrupados = clubesSemanales.reduce((acc, b) => {
                    if (!acc[b.motivo]) acc[b.motivo] = []
                    acc[b.motivo].push(b)
                    return acc
                  }, {})

                  return (
                    <div className="card" style={{ marginTop: 20 }}>
                      <div className="seccion-titulo">Clubes semanales</div>
                      <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                        <table className="tabla">
                          <thead>
                            <tr>
                              <th>Club</th>
                              <th>Días/semana</th>
                              <th>Usos en el mes</th>
                              <th>Horas totales</th>
                              <th>Monto total</th>
                              <th>Estado pago</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(clubsAgrupados).map(([nombre, dias]) => {
                              const diasUnicos = [...new Set(dias.map(d => d.dia_semana))]
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
                                      <span className="badge badge-amarillo"><span className="dot"></span>Convenio</span>
                                    ) : pagoRegistrado ? (
                                      <span className="badge badge-verde"><span className="dot"></span>Pagado {pagoRegistrado.fecha_pago.split('-').reverse().join('/')}</span>
                                    ) : (
                                      <span className="badge badge-rojo"><span className="dot"></span>Pendiente</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Registrar pago */}
                      <div style={{
                        background: 'var(--verde-pale)', border: '1px solid var(--border-soft)',
                        borderRadius: 12, padding: '1.1rem',
                      }}>
                        <div className="seccion-titulo" style={{ marginBottom: 12 }}>
                          <Icon name="wallet" size={15} />
                          Registrar pago de club
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div style={{ minWidth: 180 }}>
                            <label className="form-label">Club</label>
                            <select className="form-input" value={nuevoPago.nombre_club} onChange={e => setNuevoPago(p => ({ ...p, nombre_club: e.target.value }))}>
                              <option value="">Seleccionar…</option>
                              {Object.keys(clubsAgrupados).map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                          <div style={{ width: 140 }}>
                            <label className="form-label">Monto ($)</label>
                            <input className="form-input" type="number" placeholder="Ej: 80000" value={nuevoPago.monto_pagado} onChange={e => setNuevoPago(p => ({ ...p, monto_pagado: e.target.value }))} />
                          </div>
                          <div style={{ width: 150 }}>
                            <label className="form-label">Fecha</label>
                            <input className="form-input" type="date" value={nuevoPago.fecha_pago} onChange={e => setNuevoPago(p => ({ ...p, fecha_pago: e.target.value }))} />
                          </div>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <label className="form-label">Notas (opcional)</label>
                            <input className="form-input" placeholder="Ej: Pagó con transferencia" value={nuevoPago.notas} onChange={e => setNuevoPago(p => ({ ...p, notas: e.target.value }))} />
                          </div>
                          <button className="btn-verde" style={{ width: 'auto', padding: '11px 20px' }} onClick={registrarPago} disabled={guardandoPago}>
                            {guardandoPago ? 'Guardando…' : 'Registrar pago'}
                          </button>
                        </div>

                        {pagosClubs.length > 0 && (
                          <div style={{ marginTop: '1rem' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--verde)', marginBottom: 6 }}>
                              Pagos registrados este mes:
                            </div>
                            {pagosClubs.map(p => (
                              <div key={p.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '6px 0', borderBottom: '1px solid #dcfce7', fontSize: '0.82rem'
                              }}>
                                <span>
                                  <strong>{p.nombre_club}</strong> — ${p.monto_pagado.toLocaleString('es-CL')} —{' '}
                                  {p.fecha_pago.split('-').reverse().join('/')}{p.notas ? ` — ${p.notas}` : ''}
                                </span>
                                <button className="link-action danger" onClick={() => eliminarPago(p.id)}>Eliminar</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {reservasReporte.length === 0 && bloqueosReporte.length === 0 && clubesSemanales.length === 0 && !cargandoReporte && (
                  <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--ink-dim)' }}>
                    <Icon name="chart" size={32} color="var(--ink-soft)" />
                    <p style={{ marginTop: 12, fontSize: '0.9rem' }}>Selecciona un mes y presiona "Cargar" para ver el reporte.</p>
                  </div>
                )}
              </>
            )}

            {/* ============ TAB RESERVAS ============ */}
            {tab === 'reservas' && (
              <>
                <div className="admin-page-header">
                  <div>
                    <div className="kicker">Listado completo</div>
                    <h1>Reservas confirmadas</h1>
                    <p className="subtitle">Todas las reservas registradas en el sistema.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--card)', width: 280 }}>
                    <Icon name="search" size={14} color="var(--ink-dim)" />
                    <input
                      placeholder="Buscar por nombre o celular…"
                      value={busquedaReservas}
                      onChange={e => setBusquedaReservas(e.target.value)}
                      style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '0.84rem', color: 'var(--ink)', outline: 'none' }}
                    />
                  </div>
                </div>

                {/* Filter chips */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                  {[
                    { id: 'todas', label: 'Todas', count: todasReservas.length },
                    { id: 'proximas', label: 'Próximas', count: totalProximas },
                    { id: 'pasadas', label: 'Pasadas', count: totalPasadas },
                  ].map(f => (
                    <button
                      key={f.id}
                      className={`btn-pill ${filtroReservas === f.id ? 'active' : ''}`}
                      onClick={() => setFiltroReservas(f.id)}
                    >
                      {f.label}
                      <span className="count">{f.count}</span>
                    </button>
                  ))}
                </div>

                {cargandoReservas ? (
                  <div className="loading"><div className="spinner"></div>Cargando…</div>
                ) : (
                  <div className="tabla-wrap">
                    <div style={{ overflowX: 'auto' }}>
                      <table className="tabla">
                        <thead>
                          <tr>
                            <th>Estado</th>
                            <th>Fecha</th>
                            <th>Hora</th>
                            <th>Vecino</th>
                            <th>Celular</th>
                            <th style={{ textAlign: 'right' }}>Monto</th>
                            <th style={{ textAlign: 'right' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reservasFiltradas.map(r => {
                            const esProxima = r.fecha >= hoyChile()
                            return (
                              <tr key={r.id}>
                                <td>
                                  <span className={`badge ${esProxima ? 'badge-verde' : 'badge-gris'}`}>
                                    <span className="dot"></span>
                                    {esProxima ? 'Próxima' : 'Pasada'}
                                  </span>
                                </td>
                                <td className="num-strong">{formatFechaCorta(r.fecha)}</td>
                                <td className="num-strong">{formatHora(r.hora)}</td>
                                <td>{r.nombre_reservante}</td>
                                <td className="text-dim">{r.celular}</td>
                                <td style={{ textAlign: 'right', color: 'var(--verde)', fontWeight: 600 }}>${(r.monto || 10000).toLocaleString('es-CL')}</td>
                                <td style={{ textAlign: 'right' }}>
                                  {r.comprobante_url && (
                                    <a className="link-action" href={r.comprobante_url} target="_blank" rel="noreferrer">
                                      <Icon name="eye" size={12} /> Comprobante
                                    </a>
                                  )}
                                  <button className="link-action danger" onClick={() => eliminarReserva(r.id, r.fecha, r.hora)}>Eliminar</button>
                                </td>
                              </tr>
                            )
                          })}
                          {reservasFiltradas.length === 0 && (
                            <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--ink-dim)', padding: '2rem' }}>
                              No hay reservas que coincidan con los filtros.
                            </td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 22px', borderTop: '1px solid var(--border-soft)',
                      background: 'var(--bg)', fontSize: '0.78rem', color: 'var(--ink-dim)',
                    }}>
                      Mostrando {reservasFiltradas.length} de {todasReservas.length} reservas
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ============ TAB CUENTA ============ */}
            {tab === 'cuenta' && (
              <>
                <div className="admin-page-header">
                  <div>
                    <div className="kicker">Configuración personal</div>
                    <h1>Mi cuenta</h1>
                    <p className="subtitle">Tu perfil y contraseña.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, maxWidth: 880 }}>
                  {/* Profile */}
                  <div className="card">
                    <div className="seccion-titulo">Tu perfil</div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                      <div style={{
                        width: 62, height: 62, borderRadius: 999,
                        background: 'var(--verde)', color: 'white',
                        fontFamily: 'Schibsted Grotesk, sans-serif', fontWeight: 700, fontSize: '1.3rem',
                        display: 'grid', placeItems: 'center', letterSpacing: '-0.02em'
                      }}>
                        {initials(admin.nombre)}
                      </div>
                      <div>
                        <div className="font-display" style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--ink)' }}>{admin.nombre || 'Administrador'}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--ink-dim)' }}>{admin.email}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--verde)', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--verde)' }}></span>
                          Sesión activa
                        </div>
                      </div>
                    </div>

                    <div className="exito-note">
                      <span className="icon"><Icon name="lock" size={16} color="var(--accent)" /></span>
                      <div>
                        Tu contraseña inicial era compartida.{' '}
                        <strong>Cambiarla por una propia es recomendable</strong>{' '}
                        ya que tres administradores tienen acceso al sistema.
                      </div>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="card">
                    <div className="seccion-titulo">Cambiar contraseña</div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--ink-dim)', marginBottom: 18, marginTop: '-0.5rem' }}>
                      Mínimo 8 caracteres. Recomendado: mezcla letras y números.
                    </p>

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
                      <div style={{
                        padding: '10px 14px', borderRadius: 9, marginBottom: '1rem',
                        background: msgPass.startsWith('✓') ? 'var(--verde-pale)' : 'var(--danger-pale)',
                        border: `1px solid ${msgPass.startsWith('✓') ? 'var(--verde-soft)' : '#f1cdcd'}`,
                        color: msgPass.startsWith('✓') ? 'var(--verde)' : 'var(--danger)',
                        fontSize: '0.84rem',
                      }}>
                        {msgPass}
                      </div>
                    )}

                    <button className="btn-verde" onClick={cambiarContrasena}>Actualizar contraseña</button>
                  </div>
                </div>
              </>
            )}

          </main>
        </div>
      </div>

      {/* Responsive grid fixes */}
      <style jsx>{`
        @media (max-width: 900px) {
          :global(.bloqueos-grid),
          :global(.clubes-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  )
}
