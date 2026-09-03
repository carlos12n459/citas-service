# citas-service

Microservicio de **agendamiento y catálogo médico** de MediCitas.

## Responsabilidad
Catálogo de doctores (búsqueda, perfil, horarios) + agendamiento de citas y su estado.

## Base de datos propia (PostgreSQL)
Tablas: `pacientes`, `doctores`, `especialidades`, `horarios_disponibles`, `citas`, `recordatorios_enviados`.

El esquema y datos de ejemplo están en `db/schema.sql` y `db/seed.sql`.

## Variables de entorno
Crea un archivo `.env` a partir de `.env.example`:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL de **este** servicio |
| `PORT` | Puerto (local: 4000) |
| `FACTURACION_SERVICE_URL` | URL pública del **facturacion-service** para la comunicación |

## Puesta en marcha (local)
```bash
npm install
cp .env.example .env   # edita DATABASE_URL
npm start
```

Responde en `http://localhost:4000`.

## Endpoints
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado de salud |
| GET | `/doctores?especialidad=&ciudad=` | Búsqueda de doctores |
| GET | `/doctores/:id` | Perfil de un doctor |
| GET | `/doctores/:id/horarios` | Horarios disponibles |
| POST | `/citas` | Agendar cita |
| GET | `/citas` | Listar citas |
| POST | `/citas/:id/completar` | Completa la cita y **llama a facturacion-service** |

## Despliegue
En **Render**: crea un *Web Service* conectado a este repositorio + una instancia **Render PostgreSQL**;
configura `DATABASE_URL` (la genera Render) y `FACTURACION_SERVICE_URL` con la URL pública del facturacion-service (Vercel).
Ver `../documentacion/03-despliegue.md`.
