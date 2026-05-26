import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'
import Link from 'next/link'

const HORAS = Array.from({ length: 15 }, (_, i) => i + 9) // 9 a 23

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
  const [comprobante, setComprobante] = useState(null)
  const [errores, setErrores] = useState({})

  useEffect(() => {
    cargarHoras()
  }, [fecha])

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

    setHorasOcupadas(reservas ? reservas.map(r => r.hora) : [])
    setHorasBloqueadas(bloqueos ? bloqueos.map(b => b.hora) : [])
    setLoading(false)
  }

  function getEstadoHora(hora) {
    const hoy = hoyChile()
    const ahoraH = ahoraChileHour()

    if (fecha === hoy && hora <= ahoraH + 1) return 'pasada'
    if (horasOcupadas.includes(hora)) return 'ocupada'
    if (horasBloqueadas.includes(hora)) return 'bloqueada'
    return 'libre'
  }

  function toggleHora(hora) {
    const estado = getEstadoHora(hora)
    if (estado !== 'libre') return

    setHorasSeleccionadas(prev => {
      if (prev.includes(hora)) {
        return prev.filter(h => h !== hora)
      }
      if (prev.length >= 2) {
        return [hora]
      }
      if (prev.length === 1) {
        const diff = Math.abs(hora - prev[0])
        if (diff === 1) {
          return [...prev, hora].sort((a, b) => a - b)
        }
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
    setComprobante(null)
    setErrores({})
  }

  function validar() {
    const e = {}
    if (!nombre.trim()) e.nombre = 'Ingresa tu nombre'
    if (!celular.trim() || celular.replace(/\D/g, '').length < 9) e.celular = 'Ingresa un celular válido'
    if (!comprobante) e.comprobante = 'Debes subir el comprobante de transferencia'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleReservar() {
    if (!validar()) return
    setEnviando(true)

    try {
      // Subir comprobante a Supabase Storage
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

      // Crear reservas
      const reservasData = horasSeleccionadas.map(hora => ({
        fecha,
        hora,
        nombre_reservante: nombre.trim(),
        celular: celular.trim(),
        comprobante_url: comprobanteUrl,
        monto: 10000 * horasSeleccionadas.length,
        estado: 'confirmada'
      }))

      const { error: reservaError } = await supabase
        .from('reservas')
        .insert(reservasData)

      if (reservaError) throw reservaError

      // Enviar correo
      await fetch('/api/enviar-correo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          celular,
          fecha,
          horas: horasSeleccionadas,
          comprobanteUrl,
          monto: 10000 * horasSeleccionadas.length
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
            Junta Vecinos N°25 Collico
          </div>
          <div>
            <div className="header-titulo">Gimnasio Collico</div>
            <div className="header-subtitulo">Junta de Vecinos N°25</div>
          </div>
        </div>
        <Link href="/admin" className="btn-admin">
          🔐 Admin
        </Link>
      </header>

      <main className="main">
        {/* Hero */}
        <div className="hero">
          <h1>Reserva el Gimnasio</h1>
          <p>Selecciona una fecha y elige el horario disponible. Puedes reservar 1 o 2 horas seguidas.</p>
          <div className="hero-info">
            <span className="hero-badge">📅 09:00 — 23:00 hrs</span>
            <span className="hero-badge">💰 $10.000 por hora</span>
            <span className="hero-badge">📍 Collico, Valdivia</span>
          </div>
        </div>

        {/* Selector fecha */}
        <div className="fecha-section">
          <div className="seccion-titulo">📅 Selecciona la fecha</div>
          <input
            type="date"
            className="fecha-input"
            value={fecha}
            min={hoyChile()}
            onChange={e => setFecha(e.target.value)}
          />
        </div>

        {/* Grid de horas */}
        <div className="fecha-section">
          <div className="seccion-titulo">🕐 Horarios disponibles — {fecha.split('-').reverse().join('/')}</div>

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
                  if (seleccionada) cls += 'hora-seleccionada'
                  else if (estado === 'libre') cls += 'hora-libre'
                  else if (estado === 'ocupada') cls += 'hora-ocupada'
                  else if (estado === 'bloqueada') cls += 'hora-bloqueada'
                  else cls += 'hora-pasada'

                  return (
                    <button
                      key={hora}
                      className={cls}
                      onClick={() => toggleHora(hora)}
                      disabled={estado !== 'libre'}
                    >
                      {formatHora(hora)}
                      <span className="hora-label">
                        {seleccionada ? '✓ Seleccionada' :
                         estado === 'ocupada' ? 'Reservada' :
                         estado === 'bloqueada' ? 'Bloqueada' :
                         estado === 'pasada' ? 'No disponible' : 'Disponible'}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="leyenda">
                <div className="leyenda-item">
                  <div className="leyenda-dot" style={{ background: '#dcfce7', border: '1.5px solid #bbf7d0' }}></div>
                  Disponible
                </div>
                <div className="leyenda-item">
                  <div className="leyenda-dot" style={{ background: '#6aaa1e' }}></div>
                  Seleccionada
                </div>
                <div className="leyenda-item">
                  <div className="leyenda-dot" style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}></div>
                  Reservada
                </div>
                <div className="leyenda-item">
                  <div className="leyenda-dot" style={{ background: '#f3f4f6', border: '1.5px solid #e5e7eb' }}></div>
                  Bloqueada
                </div>
              </div>
            </>
          )}
        </div>

        {/* Botón reservar */}
        {horasSeleccionadas.length > 0 && (
          <div style={{ position: 'sticky', bottom: '1.5rem', zIndex: 50 }}>
            <button className="btn-verde" onClick={abrirModal} style={{ boxShadow: '0 8px 24px rgba(106,170,30,0.4)' }}>
              Reservar {horasSeleccionadas.length === 1 ? formatHora(horasSeleccionadas[0]) : `${formatHora(horasSeleccionadas[0])} y ${formatHora(horasSeleccionadas[1])}`}
              {' '}— ${monto.toLocaleString('es-CL')}
            </button>
          </div>
        )}
      </main>

      {/* Modal reserva */}
      {modalAbierto && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setModalAbierto(false) }}>
          <div className="modal">
            {exito ? (
              <div className="exito-box">
                <div className="exito-icono">✅</div>
                <div className="exito-titulo">¡Reserva Confirmada!</div>
                <p className="exito-texto">
                  Tu reserva para el {fecha.split('-').reverse().join('/')} a las{' '}
                  {horasSeleccionadas.map(h => formatHora(h)).join(' y ')} ha sido registrada exitosamente.
                  <br /><br />
                  Recibirás confirmación una vez que el administrador revise tu comprobante.
                </p>
                <button className="btn-verde" style={{ marginTop: '1.5rem' }} onClick={() => { setModalAbierto(false); setHorasSeleccionadas([]) }}>
                  Volver al inicio
                </button>
              </div>
            ) : (
              <>
                <div className="modal-titulo">Confirmar Reserva</div>
                <div className="modal-subtitulo">
                  {fecha.split('-').reverse().join('/')} —{' '}
                  {horasSeleccionadas.map(h => formatHora(h)).join(' y ')}
                </div>

                {/* Datos transferencia */}
                <div className="transferencia-box">
                  <div className="transferencia-titulo">💳 Datos para la Transferencia</div>
                  <div className="transferencia-fila">
                    <span className="transferencia-label">Nombre</span>
                    <span className="transferencia-valor">Junta de Vecinos Urbana 25 Collico</span>
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
                    <span className="transferencia-label">Tipo de cuenta</span>
                    <span className="transferencia-valor">Chequera Electrónica</span>
                  </div>
                  <div className="transferencia-fila">
                    <span className="transferencia-label">N° de cuenta</span>
                    <span className="transferencia-valor">721-7-145070-6</span>
                  </div>
                  <div className="transferencia-fila" style={{ marginTop: '8px' }}>
                    <span className="transferencia-label">Monto a pagar</span>
                    <span className="monto-grande">${monto.toLocaleString('es-CL')}</span>
                  </div>
                </div>

                {/* Formulario */}
                <div className="form-grupo">
                  <label className="form-label">Nombre completo *</label>
                  <input
                    className={`form-input ${errores.nombre ? 'error' : ''}`}
                    placeholder="Ej: Juan Pérez González"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                  />
                  {errores.nombre && <p style={{ color: 'var(--rojo)', fontSize: '0.8rem', marginTop: '4px' }}>{errores.nombre}</p>}
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
                  {errores.celular && <p style={{ color: 'var(--rojo)', fontSize: '0.8rem', marginTop: '4px' }}>{errores.celular}</p>}
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
                        <span>📎</span>
                        <span className="upload-nombre">{comprobante.name}</span>
                        <span style={{ color: 'var(--verde)', fontWeight: 600, fontSize: '0.8rem' }}>✓</span>
                      </div>
                    ) : (
                      <>
                        <div className="upload-icono">📤</div>
                        <div className="upload-texto">
                          Toca aquí para subir tu comprobante<br />
                          <small>Imagen (JPG, PNG) o PDF — máx. 10MB</small>
                        </div>
                      </>
                    )}
                  </div>
                  {errores.comprobante && <p style={{ color: 'var(--rojo)', fontSize: '0.8rem', marginTop: '4px' }}>{errores.comprobante}</p>}
                </div>

                <button className="btn-verde" onClick={handleReservar} disabled={enviando}>
                  {enviando ? 'Procesando reserva...' : `✅ Confirmar Reserva — $${monto.toLocaleString('es-CL')}`}
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
