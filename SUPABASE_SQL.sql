-- ============================================
-- SCRIPT COMPLETO PARA GIMNASIO COLLICO
-- Ejecutar en Supabase > SQL Editor
-- ============================================

-- 1. Tabla de reservas
CREATE TABLE IF NOT EXISTS reservas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  hora INTEGER NOT NULL CHECK (hora >= 9 AND hora <= 23),
  nombre_reservante TEXT NOT NULL,
  celular TEXT NOT NULL,
  comprobante_url TEXT NOT NULL,
  monto INTEGER NOT NULL DEFAULT 10000,
  estado TEXT NOT NULL DEFAULT 'confirmada',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fecha, hora)
);

-- 2. Tabla de bloqueos
CREATE TABLE IF NOT EXISTS bloqueos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  hora INTEGER NOT NULL CHECK (hora >= 9 AND hora <= 23),
  motivo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'gratuito' CHECK (tipo IN ('gratuito', 'pagado')),
  monto INTEGER DEFAULT 0,
  bloqueado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fecha, hora)
);

-- 3. Tabla de administradores (actualizar la existente si ya existe)
-- Si la tabla ya existe, solo agrega la columna password_hash:
ALTER TABLE administradores ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Si la tabla NO existe (ejecuta esto si da error en el ALTER):
-- CREATE TABLE IF NOT EXISTS administradores (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   email TEXT UNIQUE NOT NULL,
--   nombre TEXT NOT NULL,
--   password_hash TEXT,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- 4. Actualizar contraseñas de administradores
UPDATE administradores SET password_hash = 'jjvvvecinos25.collico' WHERE email IN (
  'junta.vecinos.collico@gmail.com',
  'ceciliasanhueza672@gmail.com',
  'pia.ccsanhueza757@gmail.com'
);

-- 5. Habilitar Row Level Security
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueos ENABLE ROW LEVEL SECURITY;
ALTER TABLE administradores ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de seguridad para reservas
-- Cualquiera puede leer fecha y hora (para ver disponibilidad)
CREATE POLICY "Lectura publica reservas" ON reservas
  FOR SELECT USING (true);

-- Cualquiera puede insertar una reserva
CREATE POLICY "Insertar reservas" ON reservas
  FOR INSERT WITH CHECK (true);

-- 7. Políticas para bloqueos
CREATE POLICY "Lectura publica bloqueos" ON bloqueos
  FOR SELECT USING (true);

CREATE POLICY "Insertar bloqueos" ON bloqueos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Eliminar bloqueos" ON bloqueos
  FOR DELETE USING (true);

-- 8. Políticas para administradores
CREATE POLICY "Lectura administradores" ON administradores
  FOR SELECT USING (true);

CREATE POLICY "Actualizar administradores" ON administradores
  FOR UPDATE USING (true);

-- 9. Crear bucket de storage para comprobantes
-- (Esto se hace en Supabase Dashboard > Storage, no en SQL)
-- Nombre del bucket: comprobantes
-- Acceso: Public

-- ============================================
-- VERIFICAR QUE TODO QUEDÓ BIEN:
-- ============================================
SELECT 'reservas' as tabla, count(*) FROM reservas
UNION ALL
SELECT 'bloqueos', count(*) FROM bloqueos
UNION ALL
SELECT 'administradores', count(*) FROM administradores;
