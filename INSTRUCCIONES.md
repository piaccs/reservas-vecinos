# 🏋️ Gimnasio Collico — Guía de Instalación

## ¿Qué contiene este proyecto?
Una página web completa para reservar horas en el Gimnasio Collico con:
- Página pública para vecinos (ver disponibilidad y reservar)
- Panel de administrador (bloquear horas, ver reportes, descargar Excel)
- Correo automático al hacer una reserva
- Bloqueo automático de horas con menos de 2 hrs de anticipación

---

## PASO 1 — Configurar Supabase

### 1.1 Ejecutar el SQL
1. Entra a https://supabase.com → tu proyecto
2. En el menú izquierdo, haz clic en **SQL Editor**
3. Copia y pega TODO el contenido del archivo `SUPABASE_SQL.sql`
4. Haz clic en **Run**
5. Deberías ver al final una tabla con los conteos de cada tabla

### 1.2 Crear el bucket de archivos
1. En el menú izquierdo, haz clic en **Storage**
2. Haz clic en **New bucket**
3. Nombre: `comprobantes`
4. Marca la opción **Public bucket** ✓
5. Haz clic en **Save**

---

## PASO 2 — Subir el proyecto a Vercel

### 2.1 Crear cuenta en GitHub (si no tienes)
1. Ve a https://github.com y crea una cuenta gratuita

### 2.2 Subir el proyecto
1. En GitHub, haz clic en **New repository**
2. Nombre: `gimnasio-collico`
3. Deja todo como está y haz clic en **Create repository**
4. Sigue las instrucciones para subir los archivos

### 2.3 Conectar con Vercel
1. Ve a https://vercel.com → entra con tu cuenta
2. Haz clic en **Add New Project**
3. Conecta con tu repositorio de GitHub → selecciona `gimnasio-collico`
4. **IMPORTANTE**: Antes de hacer Deploy, agrega las variables de entorno:

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fleuqfitebthelwcbtex.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_ckeQK5HFPIJmLp7nwfZElQ_brWxwj7C` |
| `RESEND_API_KEY` | `re_gdRpj3L8_NnTGcnKnGdqX8vJjPE44G2fi` |
| `ADMIN_EMAIL` | `junta.vecinos.collico@gmail.com` |
| `ADMIN_PASSWORD` | `jjvvvecinos25.collico` |

5. Haz clic en **Deploy**
6. Espera 2-3 minutos → Vercel te dará una URL tipo `gimnasio-collico.vercel.app`

---

## PASO 3 — Configurar Resend (para que lleguen los correos)

1. Entra a https://resend.com
2. Ve a **Domains** → Add Domain
3. Agrega `gmail.com` NO, necesitas un dominio propio.
   **Alternativa fácil**: Usa el dominio de Vercel:
   - En Resend → Domains → agrega el dominio que te dio Vercel
   - O contacta a un técnico para configurar un dominio personalizado

---

## Administradores

Los tres administradores son:
- junta.vecinos.collico@gmail.com
- ceciliasanhueza672@gmail.com  
- pia.ccsanhueza757@gmail.com

Todos usan la contraseña inicial: `jjvvvecinos25.collico`
Cada uno puede cambiarla desde el panel en **Mi Cuenta**.

---

## URL del panel de administrador
`https://tu-sitio.vercel.app/admin`

---

## ¿Problemas? Escríbele a Claude y explícale en qué paso estás.
