const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

// URL pública del otro servicio (configurable por variable de entorno)
const FACTURACION_SERVICE_URL = process.env.FACTURACION_SERVICE_URL || 'http://localhost:5000';

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'citas-service' });
});

// GET /setup — crea las tablas y carga datos de ejemplo (solo para inicializar)
app.get('/setup', async (_req, res) => {
  try {
    await db.query('DROP TABLE IF EXISTS recordatorios_enviados, citas, pacientes, horarios_disponibles, doctores, especialidades CASCADE');

    await db.query(`
      CREATE TABLE especialidades (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL UNIQUE
      )`);

    await db.query(`
      CREATE TABLE doctores (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        especialidad_id INTEGER REFERENCES especialidades(id),
        ciudad TEXT,
        tarifa_consulta NUMERIC(10,2) NOT NULL DEFAULT 0,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

    await db.query(`
      CREATE TABLE horarios_disponibles (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER REFERENCES doctores(id) ON DELETE CASCADE,
        dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
        hora_inicio TIME NOT NULL,
        hora_fin TIME NOT NULL
      )`);

    await db.query(`
      CREATE TABLE pacientes (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        correo TEXT NOT NULL UNIQUE,
        telefono TEXT,
        fecha_nacimiento DATE,
        numero_seguro TEXT,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

    await db.query(`
      CREATE TABLE citas (
        id SERIAL PRIMARY KEY,
        paciente_id INTEGER REFERENCES pacientes(id),
        doctor_id INTEGER REFERENCES doctores(id),
        fecha_hora TIMESTAMPTZ NOT NULL,
        modalidad TEXT NOT NULL CHECK (modalidad IN ('presencial', 'virtual')),
        estado TEXT NOT NULL DEFAULT 'pendiente'
          CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada')),
        creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

    await db.query(`
      CREATE TABLE recordatorios_enviados (
        id SERIAL PRIMARY KEY,
        cita_id INTEGER REFERENCES citas(id) ON DELETE CASCADE,
        canal TEXT NOT NULL CHECK (canal IN ('email', 'sms')),
        estado_envio TEXT,
        intentos INTEGER NOT NULL DEFAULT 0,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

    await db.query(`INSERT INTO especialidades (nombre) VALUES ('Cardiología'), ('Dermatología'), ('Pediatría')`);
    await db.query(`INSERT INTO doctores (nombre, especialidad_id, ciudad, tarifa_consulta) VALUES
      ('Dra. Ana Torres', 1, 'Bogotá', 150000),
      ('Dr. Luis Pérez', 2, 'Medellín', 120000),
      ('Dra. María Gómez', 3, 'Cali', 130000)`);
    await db.query(`INSERT INTO horarios_disponibles (doctor_id, dia_semana, hora_inicio, hora_fin) VALUES
      (1, 1, '08:00', '12:00'),
      (1, 3, '14:00', '18:00'),
      (2, 2, '09:00', '13:00'),
      (3, 4, '10:00', '14:00')`);
    await db.query(`INSERT INTO pacientes (nombre, correo, telefono, fecha_nacimiento) VALUES
      ('Carlos Ruiz', 'carlos.ruiz@example.com', '3001234567', '1990-05-20')`);
    await db.query(`INSERT INTO citas (paciente_id, doctor_id, fecha_hora, modalidad, estado) VALUES
      (1, 1, now() + interval '1 day', 'virtual', 'pendiente')`);

    res.json({ status: 'ok', message: 'Base inicializada con tablas y datos de ejemplo' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /doctores  — búsqueda por especialidad y/o ciudad
app.get('/doctores', async (req, res) => {
  try {
    const { especialidad, ciudad } = req.query;
    let sql = `
      SELECT d.id, d.nombre, d.ciudad, d.tarifa_consulta, d.activo, e.nombre AS especialidad
      FROM doctores d
      JOIN especialidades e ON e.id = d.especialidad_id
      WHERE d.activo = TRUE
    `;
    const params = [];
    if (especialidad) {
      params.push(especialidad);
      sql += ` AND e.nombre = $${params.length}`;
    }
    if (ciudad) {
      params.push(ciudad);
      sql += ` AND d.ciudad = $${params.length}`;
    }
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /doctores/:id — perfil del doctor
app.get('/doctores/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT d.id, d.nombre, d.ciudad, d.tarifa_consulta, d.activo, e.nombre AS especialidad
       FROM doctores d JOIN especialidades e ON e.id = d.especialidad_id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Doctor no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /doctores/:id/horarios — horarios libres del doctor
app.get('/doctores/:id/horarios', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, dia_semana, hora_inicio, hora_fin
       FROM horarios_disponibles WHERE doctor_id = $1`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /citas — agendar (verifica que el doctor exista y esté activo)
app.post('/citas', async (req, res) => {
  try {
    const { paciente_id, doctor_id, fecha_hora, modalidad } = req.body;
    if (!paciente_id || !doctor_id || !fecha_hora || !modalidad) {
      return res.status(400).json({ error: 'Faltan campos: paciente_id, doctor_id, fecha_hora, modalidad' });
    }
    const doctor = await db.query(
      'SELECT id FROM doctores WHERE id = $1 AND activo = TRUE', [doctor_id]
    );
    if (doctor.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor no encontrado o inactivo' });
    }
    const { rows } = await db.query(
      `INSERT INTO citas (paciente_id, doctor_id, fecha_hora, modalidad, estado)
       VALUES ($1, $2, $3, $4, 'pendiente')
       RETURNING *`,
      [paciente_id, doctor_id, fecha_hora, modalidad]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /citas — listar citas
app.get('/citas', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*, p.nombre AS paciente, d.nombre AS doctor
       FROM citas c
       JOIN pacientes p ON p.id = c.paciente_id
       JOIN doctores d ON d.id = c.doctor_id`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /citas/:id/completar — marca la cita como completada y
// dispara la facturación llamando al facturacion-service (otro microservicio)
app.post('/citas/:id/completar', async (req, res) => {
  try {
    const cita = await db.query(
      `SELECT c.id, c.doctor_id, c.paciente_id, c.estado, d.tarifa_consulta
       FROM citas c JOIN doctores d ON d.id = c.doctor_id
       WHERE c.id = $1`, [req.params.id]
    );
    if (cita.rows.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });
    if (cita.rows[0].estado === 'pendiente') {
      await db.query(
        `UPDATE citas SET estado = 'completada', actualizado_en = now() WHERE id = $1`,
        [req.params.id]
      );
    }

    // Comunicación entre servicios: llamamos a facturacion-service
    const facturacionResp = await fetch(`${FACTURACION_SERVICE_URL}/api/facturas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cita_id: req.params.id,
        paciente_id: cita.rows[0].paciente_id,
        tarifa_snapshot: cita.rows[0].tarifa_consulta,
      }),
    });

    const factura = facturacionResp.ok ? await facturacionResp.json() : null;
    res.json({ cita_id: req.params.id, estado: 'completada', factura });
  } catch (err) {
    res.status(500).json({
      error: 'Cita completada pero falló la llamada a facturacion-service: ' + err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`citas-service escuchando en http://localhost:${PORT}`);
});
