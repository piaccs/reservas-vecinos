import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'
import Link from 'next/link'
import Icon from '../components/Icon'

const HORAS = Array.from({ length: 15 }, (_, i) => i + 9) // 9 a 23
const DIAS_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function formatHora(h) {
  return `${h.toString().padStart(2, '0')}:00`
}

function hoyChile() {
  const now = new Date()
  const chile = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }))
  return chile.toISOString().split('T')[0]
}

function ahoraChileHour() {
  const now = new Date()
  const chile = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }))
  return chile.getHours()
}

function maxFechaChile() {
  const now = new Date()
  const chile = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }))
  chile.setDate(chile.getDate() + 14)
  return chile.toISOString().split('T')[0]
}

function fechaLarga(yyyymmdd) {
  if (!yyyymmdd) return ''
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  const obj = new Date(y, m - 1, d)
  return `${DIAS_CORTOS[obj.getDay()].toLowerCase().replace('ié', 'ié')} ${d} de ${MESES[m - 1]}`
}

function dayLabel(yyyymmdd) {
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  const obj = new Date(y, m - 1, d)
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  return `${dias[obj.getDay()]} ${d} de ${MESES[m - 1]}, ${y}`
}

// Genera lista de 7 días a partir de la fecha base, centrada
function siguientesDias(centerYmd, count = 7) {
  const [y, m, d] = centerYmd.split('-').map(Number)
  const base = new Date(y, m - 1, d)
  const today = new Date()
  const maxDate = new Date(today)
  maxDate.setDate(today.getDate() + 14)

  const result = []
  // Empezamos 1 día antes del seleccionado para mostrar contexto, pero nunca antes de hoy
  for (let offset = -1; offset < count - 1; offset++) {
    const dt = new Date(base)
    dt.setDate(base.getDate() + offset)
    if (dt < new Date(today.getFullYear(), today.getMonth(), today.getDate())) continue
    if (dt > maxDate) break
    result.push(dt)
    if (result.length >= count) break
  }
  // Si faltan días por inicio, completa hacia adelante
  while (result.length < count) {
    const last = result[result.length - 1] || base
    const dt = new Date(last)
    dt.setDate(last.getDate() + 1)
    if (dt > maxDate) break
    result.push(dt)
  }
  return result.map(dt => {
    const yy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    return { ymd: `${yy}-${mm}-${dd}`, dia: DIAS_CORTOS[dt.getDay()], num: dt.getDate() }
  })
}

export default function Home() {
  const [fecha, setFecha] = useState(hoyChile())
  const [horasOcupadas, setHorasOcupadas] = useState([])
  const [horasBloqueadas, setHorasBloqueadas] = useState([])
  const [horasSeleccionadas, setHorasSeleccionadas] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [exito, setExito] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const [nombre, setNombre] = useState('')
  const [celular, setCelular] = useState('')
  const [email, setEmail] = useState('')
  const [comprobante, setComprobante] = useState(null)
  const [errores, setErrores] = useState({})

  useEffect(() => { cargarHoras() }, [fecha])

  async function cargarHoras() {
    setLoading(true)
    setHorasSeleccionadas([])

    const { data: reservas } = await supabase
      .from('reservas')
      .select('hora')
      .eq('fecha', fecha)
      .eq('estado', 'confirmada')

    const { data: bloqueos } = await supabase
      .from('bloqueos')
      .select('hora')
      .eq('fecha', fecha)

    const fechaObj = new Date(fecha + 'T12:00:00')
    const diaSemana = fechaObj.getDay()
    const { data: semanales } = await supabase
      .from('bloqueos_semanales')
      .select('hora_inicio')
      .eq('dia_semana', diaSemana)
      .eq('activo', true)

    const horasBloqSemanales = semanales ? semanales.map(s => s.hora_inicio) : []
    const horasBloqFecha = bloqueos ? bloqueos.map(b => b.hora) : []

    setHorasOcupadas(reservas ? reservas.map(r => r.hora) : [])
    setHorasBloqueadas([...new Set([...horasBloqFecha, ...horasBloqSemanales])])
    setLoading(false)
  }

  function getEstadoHora(hora) {
    const hoy = hoyChile()
    const ahoraH = ahoraChileHour()
    if (fecha === hoy && hora <= Math.min(ahoraH + 1, 23)) return 'pasada'
    if (horasOcupadas.includes(hora)) return 'ocupada'
    if (horasBloqueadas.includes(hora)) return 'bloqueada'
    return 'libre'
  }

  function toggleHora(hora) {
    const estado = getEstadoHora(hora)
    if (estado !== 'libre') return
    setHorasSeleccionadas(prev => {
      if (prev.includes(hora)) return prev.filter(h => h !== hora)
      if (prev.length >= 2) return [hora]
      if (prev.length === 1) {
        const diff = Math.abs(hora - prev[0])
        if (diff === 1) return [...prev, hora].sort((a, b) => a - b)
        return [hora]
      }
      return [hora]
    })
  }

  function abrirModal() {
    if (horasSeleccionadas.length === 0) return
    setModalAbierto(true)
    setExito(false)
    setNombre('')
    setCelular('')
    setEmail('')
    setComprobante(null)
    setErrores({})
  }

  function validar() {
    const e = {}
    if (!nombre.trim()) e.nombre = 'Ingresa tu nombre'
    if (!celular.trim() || celular.replace(/\D/g, '').length < 9) e.celular = 'Ingresa un celular válido'
    if (!email.trim() || !email.includes('@')) e.email = 'Ingresa un correo válido'
    if (!comprobante) e.comprobante = 'Debes subir el comprobante de transferencia'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleReservar() {
    if (!validar()) return
    setEnviando(true)
    try {
      const ext = comprobante.name.split('.').pop()
      const nombreArchivo = `${fecha}_${horasSeleccionadas.join('-')}_${Date.now()}.${ext}`
      const { data: upload, error: uploadError } = await supabase.storage
        .from('comprobantes')
        .upload(nombreArchivo, comprobante)
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('comprobantes')
        .getPublicUrl(nombreArchivo)
      const comprobanteUrl = urlData.publicUrl

      const reservasData = horasSeleccionadas.map(hora => ({
        fecha, hora,
        nombre_reservante: nombre.trim(),
        celular: celular.trim(),
        email_reservante: email.trim(),
        comprobante_url: comprobanteUrl,
        monto: 10000,
        estado: 'pendiente'
      }))

      const { data: reservaInsertada, error: reservaError } = await supabase
        .from('reservas')
        .insert(reservasData)
        .select('id')
      if (reservaError) throw reservaError

      const reservaId = reservaInsertada?.[0]?.id

      await fetch('/api/enviar-correo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre, celular, email, fecha,
          horas: horasSeleccionadas, comprobanteUrl,
          monto: 10000 * horasSeleccionadas.length,
          reservaId
        })
      })

      setExito(true)
      await cargarHoras()
    } catch (err) {
      console.error(err)
      alert('Hubo un error al procesar la reserva. Por favor intenta nuevamente.')
    } finally {
      setEnviando(false)
    }
  }

  const monto = horasSeleccionadas.length * 10000
  const dias = siguientesDias(fecha, 7)

  return (
    <>
      <Head>
        <title>Gimnasio Collico — Reserva de Horas</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Reserva horas en el Gimnasio de Collico — Junta de Vecinos N°25" />
      </Head>

      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div className="header-logo-box">
            <span>JV</span>
            <span className="logo-sub">N°25</span>
          </div>
          <div>
            <div className="header-titulo">Gimnasio Collico</div>
            <div className="header-subtitulo">Junta de Vecinos N°25 · Valdivia</div>
          </div>
        </div>
        <Link href="/admin" className="btn-admin">
          <Icon name="lock" size={13} />
          Admin
        </Link>
      </header>

      <main className="main">
        {/* Hero */}
        <section className="hero">
          <div className="kicker">Reserva tu hora — gimnasio</div>
          <h1>
            Un espacio <span className="hl">de todos</span><span className="accent">.</span>
          </h1>
          <p>
            Reserva 1 o 2 horas seguidas en el gimnasio de la Junta de Vecinos N°25.
            Hasta dos semanas de anticipación, confirmación por transferencia.
          </p>
          <div className="hero-info">
            <div className="hero-cell">
              <span className="hero-cell-icon"><Icon name="clock" size={16} /></span>
              <div className="hero-cell-label">Horario</div>
              <div className="hero-cell-value">09:00 – 23:00</div>
            </div>
            <div className="hero-cell">
              <span className="hero-cell-icon"><Icon name="wallet" size={16} /></span>
              <div className="hero-cell-label">Valor</div>
              <div className="hero-cell-value">$10.000 / hr</div>
            </div>
            <div className="hero-cell">
              <span className="hero-cell-icon"><Icon name="pin" size={16} /></span>
              <div className="hero-cell-label">Lugar</div>
              <div className="hero-cell-value">Collico, Valdivia</div>
            </div>
            <div className="hero-cell">
              <span className="hero-cell-icon"><Icon name="users" size={16} /></span>
              <div className="hero-cell-label">Aforo</div>
              <div className="hero-cell-value">Un grupo</div>
            </div>
          </div>
        </section>

        {/* Selector fecha */}
        <div className="card fecha-section">
          <div className="seccion-titulo">
            <Icon name="calendar" size={17} />
            Elige el día
            <span className="pill-meta">
              <Icon name="calendar" size={13} color="var(--verde-mid)" />
              {fecha.split('-').reverse().join('/')}
            </span>
          </div>
          <input
            type="date"
            className="fecha-input"
            value={fecha}
            min={hoyChile()}
            max={maxFechaChile()}
            onChange={e => { if (e.target.value <= maxFechaChile()) setFecha(e.target.value) }}
          />
          {/* Day pills row */}
          <div className="day-row">
            {dias.map(d => (
              <button
                key={d.ymd}
                className={`day-pill ${d.ymd === fecha ? 'selected' : ''}`}
                onClick={() => setFecha(d.ymd)}
                type="button"
              >
                <div className="dia">{d.dia}</div>
                <div className="num">{d.num}</div>
                <div className="dot"></div>
              </button>
            ))}
          </div>
          <p style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--ink-dim)' }}>
            Hasta <strong style={{ color: 'var(--ink)' }}>2 semanas</strong> de anticipación. Para fechas más lejanas,
            contacta a la directiva.
          </p>
        </div>

        <div className="booking-grid">
          {/* Hours grid */}
          <div className="card fecha-section">
            <div className="seccion-titulo">
              <Icon name="clock" size={17} />
              {dayLabel(fecha)}
            </div>

            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
                Cargando disponibilidad...
              </div>
            ) : (
              <>
                <div className="horas-grid">
                  {HORAS.map(hora => {
                    const estado = getEstadoHora(hora)
                    const seleccionada = horasSeleccionadas.includes(hora)
                    let cls = 'hora-btn '
                    let label = 'Disponible'
                    if (seleccionada) { cls += 'hora-seleccionada'; label = 'Tu selección' }
                    else if (estado === 'libre') { cls += 'hora-libre'; label = 'Disponible' }
                    else if (estado === 'ocupada') { cls += 'hora-ocupada'; label = 'Reservada' }
                    else if (estado === 'bloqueada') { cls += 'hora-bloqueada'; label = 'No disponible' }
                    else { cls += 'hora-pasada'; label = 'No disponible' }

                    return (
                      <button
                        key={hora}
                        className={cls}
                        onClick={() => toggleHora(hora)}
                        disabled={estado !== 'libre'}
                        type="button"
                      >
                        <span className="hora-num">{formatHora(hora)}</span>
                        <span className="hora-label">{label}</span>
                        {seleccionada && (
                          <span className="hora-check">
                            <Icon name="check" size={12} color="#fff" />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="leyenda">
                  <div className="leyenda-item">
                    <span className="leyenda-dot" style={{ background: 'var(--card)' }}></span>
                    Disponible
                  </div>
                  <div className="leyenda-item">
                    <span className="leyenda-dot" style={{ background: 'var(--verde)', borderColor: 'var(--verde)' }}></span>
                    Tu selección
                  </div>
                  <div className="leyenda-item">
                    <span className="leyenda-dot" style={{ background: 'var(--bg)' }}></span>
                    Reservada
                  </div>
                  <div className="leyenda-item">
                    <span className="leyenda-dot" style={{ background: 'var(--verde-pale)', borderColor: 'var(--border-soft)' }}></span>
                    Club / no disponible
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sidebar */}
          <aside className="booking-sidebar">
            <div className="summary-card">
              <div className="summary-kicker">Tu reserva</div>
              <div className="summary-when">
                {horasSeleccionadas.length === 0 ? (
                  <>Aún no<br />elegida</>
                ) : (
                  <>
                    {dayLabel(fecha).split(',')[0]}<br />
                    {horasSeleccionadas.map(formatHora).join(' y ')} hrs
                  </>
                )}
              </div>
              <div className="summary-divider"></div>
              <div className="summary-row">
                <span className="label">
                  {horasSeleccionadas.length === 0 ? 'Selecciona horas' : `${horasSeleccionadas.length} hora${horasSeleccionadas.length > 1 ? 's' : ''}`}
                </span>
                <span className="summary-price">${monto.toLocaleString('es-CL')}</span>
              </div>
              <button
                className="btn-summary"
                onClick={abrirModal}
                disabled={horasSeleccionadas.length === 0}
              >
                <span>{horasSeleccionadas.length === 0 ? 'Elige una hora' : 'Continuar a pago'}</span>
                <Icon name="arrow-right" size={16} color="var(--verde)" />
              </button>
            </div>

            <div className="how-card">
              <div className="how-title">Cómo funciona</div>
              <div className="how-step">
                <div className="n">1</div>
                <div>
                  <div className="t">Elige día y hora</div>
                  <div className="d">Puedes reservar 1 o 2 horas seguidas, hasta 2 semanas antes.</div>
                </div>
              </div>
              <div className="how-step">
                <div className="n">2</div>
                <div>
                  <div className="t">Transfiere $10.000</div>
                  <div className="d">Los datos de la cuenta aparecen en el siguiente paso.</div>
                </div>
              </div>
              <div className="how-step">
                <div className="n">3</div>
                <div>
                  <div className="t">Sube tu comprobante</div>
                  <div className="d">La directiva confirma en unas horas vía correo.</div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Sticky CTA (móvil) */}
        {horasSeleccionadas.length > 0 && (
          <div className="sticky-cta">
            <button className="btn-verde btn-split" onClick={abrirModal} type="button">
              <span>
                Reservar {horasSeleccionadas.map(formatHora).join(' y ')}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                ${monto.toLocaleString('es-CL')}
                <Icon name="arrow-right" size={16} color="#fff" />
              </span>
            </button>
          </div>
        )}
      </main>

      {/* Modal */}
      {modalAbierto && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setModalAbierto(false) }}>
          <div className="modal">
            {exito ? (
              <div className="exito-box">
                <div className="exito-icono">
                  <Icon name="check" size={32} color="var(--verde)" />
                </div>
                <div className="kicker" style={{ marginBottom: 6 }}>Reserva confirmada</div>
                <div className="exito-titulo">¡Listo, {nombre.split(' ')[0]}!</div>
                <p className="exito-texto">
                  Tu reserva del <strong style={{ color: 'var(--ink)' }}>{dayLabel(fecha).toLowerCase()}</strong>{' '}
                  a las <strong style={{ color: 'var(--ink)' }}>{horasSeleccionadas.map(formatHora).join(' y ')}</strong>{' '}
                  quedó registrada.
                </p>

                <div className="exito-card">
                  <div className="row"><span className="k">Fecha</span><span className="v">{dayLabel(fecha)}</span></div>
                  <div className="row"><span className="k">Hora</span><span className="v">{horasSeleccionadas.map(formatHora).join(' y ')} hrs</span></div>
                  <div className="row"><span className="k">Monto</span><span className="v" style={{ color: 'var(--verde)', fontWeight: 600 }}>${monto.toLocaleString('es-CL')}</span></div>
                </div>

                <div className="exito-note">
                  <span className="icon"><Icon name="phone" size={16} color="var(--accent)" /></span>
                  <div>La directiva confirmará tu comprobante en las próximas horas. Te llegará un correo cuando esté listo.</div>
                </div>

                <button
                  className="btn-verde"
                  onClick={() => { setModalAbierto(false); setHorasSeleccionadas([]) }}
                >
                  Volver al inicio
                </button>
              </div>
            ) : (
              <>
                <div className="modal-step">Paso 2 de 2</div>
                <div className="modal-titulo">Confirmar reserva</div>
                <div className="modal-subtitulo">
                  {dayLabel(fecha)} · {horasSeleccionadas.map(formatHora).join(' y ')} hrs
                </div>

                {/* Datos transferencia */}
                <div className="transferencia-box">
                  <div className="transferencia-titulo">
                    <Icon name="wallet" size={13} />
                    Datos para la transferencia
                  </div>
                  <div className="transferencia-fila">
                    <span className="transferencia-label">Nombre</span>
                    <span className="transferencia-valor">JV Urbana 25 Collico</span>
                  </div>
                  <div className="transferencia-fila">
                    <span className="transferencia-label">RUT</span>
                    <span className="transferencia-valor">72.805.000-4</span>
                  </div>
                  <div className="transferencia-fila">
                    <span className="transferencia-label">Banco</span>
                    <span className="transferencia-valor">Banco Estado</span>
                  </div>
                  <div className="transferencia-fila">
                    <span className="transferencia-label">Tipo cuenta</span>
                    <span className="transferencia-valor">Chequera Electrónica</span>
                  </div>
                  <div className="transferencia-fila">
                    <span className="transferencia-label">N° cuenta</span>
                    <span className="transferencia-valor">721-7-145070-6</span>
                  </div>
                  <div className="transferencia-fila" style={{ marginTop: 6, alignItems: 'baseline' }}>
                    <span className="transferencia-label">Monto</span>
                    <span className="monto-grande">${monto.toLocaleString('es-CL')}</span>
                  </div>
                </div>

                {/* Form */}
                <div className="form-grupo">
                  <label className="form-label">Nombre completo *</label>
                  <input
                    className={`form-input ${errores.nombre ? 'error' : ''}`}
                    placeholder="Ej: Juan Pérez González"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                  />
                  {errores.nombre && <p className="form-error">{errores.nombre}</p>}
                </div>

                <div className="form-grupo">
                  <label className="form-label">Número de celular *</label>
                  <input
                    className={`form-input ${errores.celular ? 'error' : ''}`}
                    placeholder="Ej: +56 9 1234 5678"
                    value={celular}
                    onChange={e => setCelular(e.target.value)}
                    type="tel"
                  />
                  {errores.celular && <p className="form-error">{errores.celular}</p>}
                </div>

                <div className="form-grupo">
                  <label className="form-label">Correo electrónico *</label>
                  <input
                    className={`form-input ${errores.email ? 'error' : ''}`}
                    placeholder="Ej: juan@gmail.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    type="email"
                  />
                  {errores.email && <p className="form-error">{errores.email}</p>}
                </div>

                <div className="form-grupo">
                  <label className="form-label">Comprobante de transferencia *</label>
                  <div className={`upload-area ${comprobante ? 'active' : ''}`}>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={e => setComprobante(e.target.files[0] || null)}
                    />
                    {comprobante ? (
                      <div className="upload-archivo">
                        <Icon name="check" size={16} color="var(--verde)" />
                        <span className="nombre">{comprobante.name}</span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--ink-dim)' }}>
                          {(comprobante.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="upload-icono">
                          <Icon name="upload" size={26} />
                        </div>
                        <div className="upload-texto">
                          Toca aquí para subir tu comprobante<br />
                          <span style={{ fontSize: '0.74rem' }}>Imagen (JPG, PNG) o PDF — máx. 10MB</span>
                        </div>
                      </>
                    )}
                  </div>
                  {errores.comprobante && <p className="form-error">{errores.comprobante}</p>}
                </div>

                <button className="btn-verde btn-split" onClick={handleReservar} disabled={enviando}>
                  <span>{enviando ? 'Procesando reserva...' : 'Confirmar reserva'}</span>
                  {!enviando && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      ${monto.toLocaleString('es-CL')}
                      <Icon name="arrow-right" size={15} color="#fff" />
                    </span>
                  )}
                </button>
                <button className="btn-gris" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
