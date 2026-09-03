const { Pool } = require('pg');

// Normaliza la cadena de conexión: a veces Render muestra el host sin el dominio
// completo (ej. "dpg-xxxx-a" en lugar de "dpg-xxxx-a.virginia-postgres.render.com").
// Esto reconstruye el host válido si falta, sin dejar de leer DATABASE_URL del entorno.
function normalizarUrl(url) {
  if (!url) return url;
  const m = url.match(/^postgres(ql)?:\/\/([^@]+)@([^\/]+)(\/.*)$/);
  if (!m) return url;
  const credenciales = m[2];
  let host = m[3];
  const db = m[4];
  if (host.includes('.') === false || !/.+\.\w{2,}$/.test(host)) {
    if (!host.endsWith('-a')) {
      host = `${host}-a`;
    }
    host = `${host}.virginia-postgres.render.com`;
  }
  const esquema = m[1] ? 'postgresql' : 'postgres';
  return `${esquema}://${credenciales}@${host}${db}`;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
    ? normalizarUrl(process.env.DATABASE_URL)
    : undefined,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
