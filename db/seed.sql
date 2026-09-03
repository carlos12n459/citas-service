-- Datos de ejemplo para el citas-service
-- (los números son ficticios con fines de demostración)

INSERT INTO especialidades (nombre) VALUES
  ('Cardiología'),
  ('Dermatología'),
  ('Pediatría');

INSERT INTO doctores (nombre, especialidad_id, ciudad, tarifa_consulta) VALUES
  ('Dra. Ana Torres', 1, 'Bogotá', 150000),
  ('Dr. Luis Pérez', 2, 'Medellín', 120000),
  ('Dra. María Gómez', 3, 'Cali', 130000);

INSERT INTO horarios_disponibles (doctor_id, dia_semana, hora_inicio, hora_fin) VALUES
  (1, 1, '08:00', '12:00'),
  (1, 3, '14:00', '18:00'),
  (2, 2, '09:00', '13:00'),
  (3, 4, '10:00', '14:00');

INSERT INTO pacientes (nombre, correo, telefono, fecha_nacimiento) VALUES
  ('Carlos Ruiz', 'carlos.ruiz@example.com', '3001234567', '1990-05-20');

INSERT INTO citas (paciente_id, doctor_id, fecha_hora, modalidad, estado) VALUES
  (1, 1, now() + interval '1 day', 'virtual', 'pendiente');
