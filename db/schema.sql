-- ============================================================
-- citas-service · Esquema de base de datos (PostgreSQL)
-- Tablas asignadas: pacientes, doctores, especialidades,
-- horarios_disponibles, citas, recordatorios_enviados
-- ============================================================

CREATE TABLE IF NOT EXISTS especialidades (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS doctores (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    especialidad_id INTEGER REFERENCES especialidades(id),
    ciudad TEXT,
    tarifa_consulta NUMERIC(10,2) NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS horarios_disponibles (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER REFERENCES doctores(id) ON DELETE CASCADE,
    dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS pacientes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL UNIQUE,
    telefono TEXT,
    fecha_nacimiento DATE,
    numero_seguro TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS citas (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER REFERENCES pacientes(id),
    doctor_id INTEGER REFERENCES doctores(id),
    fecha_hora TIMESTAMPTZ NOT NULL,
    modalidad TEXT NOT NULL CHECK (modalidad IN ('presencial', 'virtual')),
    estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recordatorios_enviados (
    id SERIAL PRIMARY KEY,
    cita_id INTEGER REFERENCES citas(id) ON DELETE CASCADE,
    canal TEXT NOT NULL CHECK (canal IN ('email', 'sms')),
    estado_envio TEXT,
    intentos INTEGER NOT NULL DEFAULT 0,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
