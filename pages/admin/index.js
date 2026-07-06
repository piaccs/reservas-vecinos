import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    const data = await res.json()
    if (data.ok) {
      sessionStorage.setItem('admin_session', JSON.stringify({ email, nombre: data.nombre }))
      router.push('/admin/panel')
    } else {
      setError(data.mensaje || 'Credenciales incorrectas')
    }
    setLoading(false)
  }

  return (
    <>
      <Head>
        <title>Administrador — Gimnasio Collico</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-box">
              <span className="login-logo-text">Junta Vecinos N°25 Collico</span>
            </div>
            <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '2rem', color: 'var(--verde-oscuro)', letterSpacing: '0.05em' }}>
              Panel Administrador
            </h1>
            <p style={{ color: 'var(--gris)', fontSize: '0.88rem' }}>Gimnasio Collico</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-grupo">
              <label className="form-label">Correo electrónico</label>
              <input
                className="form-input"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-grupo">
              <label className="form-label">Contraseña</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '1rem', color: '#dc2626', fontSize: '0.88rem' }}>
                ❌ {error}
              </div>
            )}

            <button className="btn-verde" type="submit" disabled={loading}>
              {loading ? 'Verificando...' : '🔐 Ingresar al Panel'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <a href="/" style={{ color: 'var(--gris)', fontSize: '0.85rem', textDecoration: 'none' }}>
              ← Volver a la página principal
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
