import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import Head from 'next/head'

const HORAS = Array.from({ length: 15 }, (_, i) => i + 9)

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
  const [loading, setLoading] = useState(false)

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

  // Reporte
  const [mesReporte, setMesReporte] = useState(new Date().toISOString().slice(0, 7))
  const [reservasReporte, setReservasReporte] = useState([])
  const [bloqueosReporte, setBloqueosReporte] = useState([])
  const [cargandoReporte, setCargandoReporte] = useState(false)

  // Reservas
  const [todasReservas, setTodasReservas] = useState([])
  const [cargandoReservas, setCargandoReservas] = useState(false)

  // Cambiar contraseña
  const [passActual, setPassActual] = useState('')
  const [passNueva, setPassNueva] = useState('')
  const [passConfirm, setPassConfirm] = useState('')
  const [msgPass, setMsgPass] = useState('')

  useEffect(() => {
    const session = sessionStorage.getItem('admin_session')
    if (!session) {
      router.push('/admin')
      return
    }
    setAdmin(JSON.parse(session))
  }, [])

  useEffect(() => {
    if (tab === 'bloqueos') cargarHorasBloqueo()
    if (tab === 'reservas') cargarTodasReservas()
  }, [tab, fechaBloqueo])

  async function cargarHorasBloqueo() {
    const { data: reservas } = await supabase
      .from('reservas')
      .select('hora')
      .eq('fecha', fechaBloqueo)
      .eq('estado', 'confirmada')

    const { data: bloqueos } = await supabase
      .from('bloqueos')
      .select('hora, motivo, tipo, monto')
      .eq('fecha', fechaBloqueo)

    setHorasOcupadas(reservas ? reservas.map(r => r.hora) : [])
    setHorasBloqueadas(bloqueos ? bloqueos.map(b => b.hora) : [])
    setBloqueoActual(bloqueos || [])
  }

  async function cargarTodasReservas() {
    setCargandoReservas(true)
    const { data } = await supabase
      .from('reservas')
      .select('*')
      .order('fecha', { ascending: false })
      .order('hora', { ascending: true })
      .limit(100)
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
      bloqueado_por: admin.email
    }))

    const { error } = await supabase.from('bloqueos').insert(bloqueos)

    if (error) {
      alert('Error al guardar los bloqueos: ' + error.message)
    } else {
      setHorasSelBloqueo([])
      setMotivoBloqueo('')
      setMontoBloqueo('')
      await cargarHorasBloqueo()
      alert('✅ Horas bloqueadas correctamente')
    }
    setGuardandoBloqueo(false)
  }

  async function eliminarBloqueo(fecha, hora) {
    if (!confirm('¿Eliminar este bloqueo?')) return
    await supabase.from('bloqueos').delete().eq('fecha', fecha).eq('hora', hora)
    await cargarHorasBloqueo()
  }

  async function cargarReporte() {
    setCargandoReporte(true)
    const [year, month] = mesReporte.split('-')
    const inicio = `${year}-${month}-01`
    const fin = `${year}-${month}-31`

    const { data: reservas } = await supabase
      .from('reservas')
      .select('*')
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .eq('estado', 'confirmada')
      .order('fecha')
      .order('hora')

    const { data: bloqueos } = await supabase
      .from('bloqueos')
      .select('*')
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .order('fecha')
      .order('hora')

    setReservasReporte(reservas || [])
    setBloqueosReporte(bloqueos || [])
    setCargandoReporte(false)
  }

  async function descargarExcel() {
    if (reservasReporte.length === 0 && bloqueosReporte.length === 0) {
      return alert('No hay datos para descargar. Carga el reporte primero.')
    }

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
    if (passNueva !== passConfirm) return setMsgPass('Las contraseñas nuevas no coinciden')
    if (passNueva.length < 8) return setMsgPass('La contraseña debe tener al menos 8 caracteres')

    const res = await fetch('/api/cambiar-contrasena', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: admin.email, actual: passActual, nueva: passNueva })
    })
    const data = await res.json()
    if (data.ok) {
      setMsgPass('✅ Contraseña actualizada correctamente')
      setPassActual('')
      setPassNueva('')
      setPassConfirm('')
    } else {
      setMsgPass('❌ ' + (data.mensaje || 'Error al cambiar contraseña'))
    }
  }

  function toggleHoraBloqueo(hora) {
    if (horasOcupadas.includes(hora)) return
    setHorasSelBloqueo(prev =>
      prev.includes(hora) ? prev.filter(h => h !== hora) : [...prev, hora]
    )
  }

  const totalReservas = reservasReporte.reduce((s, r) => s + (r.monto || 10000), 0)
  const totalBloqueosPagados = bloqueosReporte.filter(b => b.tipo === 'pagado').reduce((s, b) => s + (b.monto || 0), 0)

  if (!admin) return <div className="loading"><div className="spinner"></div>Verificando acceso...</div>

  return (
    <>
      <Head>
        <title>Panel Admin — Gimnasio Collico</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="admin-container">
        {/* Header admin */}
        <div className="admin-header">
          <div>
            <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '2rem', letterSpacing: '0.05em' }}>
              Panel Administrador
            </h1>
            <p style={{ opacity: 0.85, fontSize: '0.88rem' }}>Bienvenido, {admin.nombre} — {admin.email}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <a href="/" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', textDecoration: 'none' }}>
              ← Ver página pública
            </a>
            <button
              className="btn-admin"
              onClick={() => { sessionStorage.removeItem('admin_session'); router.push('/admin') }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Nav tabs */}
        <div className="admin-nav" style={{ marginBottom: '1.5rem' }}>
          {[
            { id: 'bloqueos', label: '🔒 Bloquear Horas' },
            { id: 'reporte', label: '📊 Reporte Mensual' },
            { id: 'reservas', label: '📋 Ver Reservas' },
            { id: 'cuenta', label: '⚙️ Mi Cuenta' }
          ].map(t => (
            <button
              key={t.id}
              className={`nav-btn ${tab === t.id ? 'activo' : 'inactivo'}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: BLOQUEOS */}
        {tab === 'bloqueos' && (
          <>
            <div className="card">
              <div className="seccion-titulo">🔒 Bloquear Horas</div>
              <p style={{ color: 'var(--gris)', fontSize: '0.88rem', marginBottom: '1.2rem' }}>
                Bloquea horas para clubes mensuales, actividades municipales o de la junta.
              </p>

              <div className="form-grupo">
                <label className="form-label">Fecha</label>
                <input
                  type="date"
                  className="fecha-input"
                  value={fechaBloqueo}
                  onChange={e => setFechaBloqueo(e.target.value)}
                />
              </div>

              <div className="form-grupo">
                <label className="form-label">Selecciona las horas a bloquear</label>
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
                      <button
                        key={hora}
                        className={cls}
                        onClick={() => toggleHoraBloqueo(hora)}
                        disabled={yaOcupada || yaBloqueada}
                      >
                        {formatHora(hora)}
                        <span className="hora-label">
                          {seleccionada ? '✓ Selec.' :
                           yaOcupada ? 'Con reserva' :
                           yaBloqueada ? 'Bloqueada' : 'Libre'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="form-grupo">
                <label className="form-label">Motivo del bloqueo</label>
                <input
                  className="form-input"
                  placeholder="Ej: Club de Fútbol Los Pumas — Arriendo mensual"
                  value={motivoBloqueo}
                  onChange={e => setMotivoBloqueo(e.target.value)}
                />
              </div>

              <div className="form-grupo">
                <label className="form-label">Tipo de pago</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[
                    { val: 'gratuito', label: '🆓 Gratuito / Convenio' },
                    { val: 'pagado', label: '💰 Pagado' }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setTipoBloqueo(opt.val)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: '2px solid',
                        borderColor: tipoBloqueo === opt.val ? 'var(--verde)' : '#e5e7eb',
                        background: tipoBloqueo === opt.val ? 'var(--verde)' : 'white',
                        color: tipoBloqueo === opt.val ? 'white' : 'var(--gris-oscuro)',
                        cursor: 'pointer',
                        fontFamily: 'DM Sans, sans-serif',
                        fontSize: '0.88rem',
                        fontWeight: 500,
                        transition: 'all 0.18s'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {tipoBloqueo === 'pagado' && (
                <div className="form-grupo">
                  <label className="form-label">Monto pagado ($)</label>
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
                className="btn-verde"
                onClick={guardarBloqueos}
                disabled={guardandoBloqueo || horasSelBloqueo.length === 0}
              >
                {guardandoBloqueo ? 'Guardando...' : `🔒 Bloquear ${horasSelBloqueo.length} hora(s) seleccionada(s)`}
              </button>
            </div>

            {/* Bloqueos existentes en la fecha */}
            {bloqueoActual.length > 0 && (
              <div className="card">
                <div className="seccion-titulo">Bloqueos del {fechaBloqueo.split('-').reverse().join('/')}</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Hora</th>
                        <th>Motivo</th>
                        <th>Tipo</th>
                        <th>Monto</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bloqueoActual.map(b => (
                        <tr key={b.hora}>
                          <td><strong>{formatHora(b.hora)}</strong></td>
                          <td>{b.motivo}</td>
                          <td>
                            <span className={`badge ${b.tipo === 'pagado' ? 'badge-verde' : 'badge-amarillo'}`}>
                              {b.tipo === 'pagado' ? 'Pagado' : 'Gratuito'}
                            </span>
                          </td>
                          <td>{b.tipo === 'pagado' ? `$${b.monto?.toLocaleString('es-CL')}` : '—'}</td>
                          <td>
                            <button
                              onClick={() => eliminarBloqueo(fechaBloqueo, b.hora)}
                              style={{ color: 'var(--rojo)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}
                            >
                              Eliminar
                            </button>
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

        {/* TAB: REPORTE */}
        {tab === 'reporte' && (
          <div className="card">
            <div className="seccion-titulo">📊 Reporte Mensual</div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <label className="form-label">Mes</label>
                <input
                  type="month"
                  className="fecha-input"
                  value={mesReporte}
                  onChange={e => setMesReporte(e.target.value)}
                />
              </div>
              <button
                className="btn-verde"
                style={{ width: 'auto', padding: '10px 24px' }}
                onClick={cargarReporte}
                disabled={cargandoReporte}
              >
                {cargandoReporte ? 'Cargando...' : '🔍 Cargar Reporte'}
              </button>
              {(reservasReporte.length > 0 || bloqueosReporte.length > 0) && (
                <button
                  className="btn-verde"
                  style={{ width: 'auto', padding: '10px 24px', background: 'var(--verde-oscuro)' }}
                  onClick={descargarExcel}
                >
                  📥 Descargar Excel
                </button>
              )}
            </div>

            {(reservasReporte.length > 0 || bloqueosReporte.length > 0) && (
              <>
                {/* Resumen */}
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

                {/* Tabla reservas */}
                {reservasReporte.length > 0 && (
                  <>
                    <h3 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.2rem', color: 'var(--verde-oscuro)', marginBottom: '0.8rem', letterSpacing: '0.05em' }}>
                      Reservas del mes
                    </h3>
                    <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                      <table className="tabla">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Hora</th>
                            <th>Nombre</th>
                            <th>Celular</th>
                            <th>Monto</th>
                            <th>Comprobante</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reservasReporte.map(r => (
                            <tr key={r.id}>
                              <td>{r.fecha.split('-').reverse().join('/')}</td>
                              <td>{formatHora(r.hora)}</td>
                              <td>{r.nombre_reservante}</td>
                              <td>{r.celular}</td>
                              <td>${(r.monto || 10000).toLocaleString('es-CL')}</td>
                              <td>
                                {r.comprobante_url ? (
                                  <a href={r.comprobante_url} target="_blank" rel="noreferrer" style={{ color: 'var(--verde)', fontWeight: 600, fontSize: '0.85rem' }}>
                                    Ver 🔗
                                  </a>
                                ) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Tabla bloqueos */}
                {bloqueosReporte.length > 0 && (
                  <>
                    <h3 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.2rem', color: 'var(--verde-oscuro)', marginBottom: '0.8rem', letterSpacing: '0.05em' }}>
                      Horas bloqueadas del mes
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="tabla">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Hora</th>
                            <th>Motivo</th>
                            <th>Tipo</th>
                            <th>Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bloqueosReporte.map(b => (
                            <tr key={`${b.fecha}-${b.hora}`}>
                              <td>{b.fecha.split('-').reverse().join('/')}</td>
                              <td>{formatHora(b.hora)}</td>
                              <td>{b.motivo}</td>
                              <td>
                                <span className={`badge ${b.tipo === 'pagado' ? 'badge-verde' : 'badge-amarillo'}`}>
                                  {b.tipo === 'pagado' ? 'Pagado' : 'Gratuito/Convenio'}
                                </span>
                              </td>
                              <td>{b.tipo === 'pagado' ? `$${b.monto?.toLocaleString('es-CL')}` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}

            {reservasReporte.length === 0 && bloqueosReporte.length === 0 && !cargandoReporte && (
              <p style={{ color: 'var(--gris)', textAlign: 'center', padding: '2rem 0' }}>
                Selecciona un mes y presiona "Cargar Reporte"
              </p>
            )}
          </div>
        )}

        {/* TAB: RESERVAS */}
        {tab === 'reservas' && (
          <div className="card">
            <div className="seccion-titulo">📋 Todas las Reservas</div>
            {cargandoReservas ? (
              <div className="loading"><div className="spinner"></div>Cargando...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Hora</th>
                      <th>Nombre</th>
                      <th>Celular</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th>Comprobante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todasReservas.map(r => (
                      <tr key={r.id}>
                        <td>{r.fecha?.split('-').reverse().join('/')}</td>
                        <td>{formatHora(r.hora)}</td>
                        <td>{r.nombre_reservante}</td>
                        <td>{r.celular}</td>
                        <td>${(r.monto || 10000).toLocaleString('es-CL')}</td>
                        <td><span className="badge badge-verde">Confirmada</span></td>
                        <td>
                          {r.comprobante_url ? (
                            <a href={r.comprobante_url} target="_blank" rel="noreferrer" style={{ color: 'var(--verde)', fontWeight: 600, fontSize: '0.85rem' }}>
                              Ver 🔗
                            </a>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                    {todasReservas.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--gris)', padding: '2rem' }}>No hay reservas aún</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: CUENTA */}
        {tab === 'cuenta' && (
          <div className="card" style={{ maxWidth: '480px' }}>
            <div className="seccion-titulo">⚙️ Cambiar Contraseña</div>
            <p style={{ color: 'var(--gris)', fontSize: '0.88rem', marginBottom: '1.2rem' }}>
              Cambia tu contraseña de acceso al panel de administrador.
            </p>

            <div className="form-grupo">
              <label className="form-label">Contraseña actual</label>
              <input
                className="form-input"
                type="password"
                value={passActual}
                onChange={e => setPassActual(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="form-grupo">
              <label className="form-label">Nueva contraseña</label>
              <input
                className="form-input"
                type="password"
                value={passNueva}
                onChange={e => setPassNueva(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="form-grupo">
              <label className="form-label">Confirmar nueva contraseña</label>
              <input
                className="form-input"
                type="password"
                value={passConfirm}
                onChange={e => setPassConfirm(e.target.value)}
                placeholder="Repite la nueva contraseña"
              />
            </div>

            {msgPass && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '1rem',
                background: msgPass.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${msgPass.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`,
                color: msgPass.startsWith('✅') ? 'var(--verde-oscuro)' : 'var(--rojo)',
                fontSize: '0.88rem'
              }}>
                {msgPass}
              </div>
            )}

            <button className="btn-verde" onClick={cambiarContrasena}>
              Actualizar contraseña
            </button>
          </div>
        )}
      </div>
    </>
  )
}
