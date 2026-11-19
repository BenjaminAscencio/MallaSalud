# MALLASALUD

> **Sistema integral y omnicanal para la gestión, distribución y reserva de horas médicas en Centros de Salud Pública Primaria (CESFAM, SAPU y consultorios).**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![Twilio Voice](https://img.shields.io/badge/Twilio-Voice_%26_SMS-F22F46?logo=twilio)](https://www.twilio.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

---

## Descripción del Proyecto

**MALLASALUD** nace como respuesta a la problemática en la salud pública chilena y la brecha digital que afecta a los adultos mayores respecto a la reserva de horas médicas.

El sistema proporciona una plataforma omnicanal que sincroniza en tiempo real las agendas de especialidades médicas clave (Medicina General, Urgencia Dental y Matronería), garantizando cuotas prioritarias protegidas para adultos mayores (`60+`) y permitiendo la reserva mediante **ventanilla presencial (`VENTANILLA_SOME`)**, **portal web (`WEB`)** y **central telefónica autónoma (`VOZ_IVR`)**, además del control clínico diario en box médico.

---

## Integrantes del Equipo y Roles

| Integrante | Rol Principal | Especialización y Responsabilidades |
| :--- | :--- | :--- |
| **Benjamín Ascencio** | **Backend Developer & Datos** | - Modelado relacional normalizado e integridad referencial.<br>- Persistencia con PostgreSQL y Prisma ORM.<br>- Lógica transaccional, concurrencia, RBAC y módulo telefónico/SMS (`VOZ_IVR`) con Twilio.<br>- Documentación técnica y despliegue Docker. |
| **Pablo Carrasco** | **Frontend Developer & Interfaces** | - Arquitectura de componentes e interfaz reactiva con Next.js y React.<br>- Sistema de diseño inclusivo y responsivo con Tailwind CSS.<br>- Accesibilidad y usabilidad orientada a adultos mayores.<br>- Desarrollo de interfaces: Portal Paciente, Consola SOME, Panel Box Médico y Monitor IVR. |

* **Carrera:** Ingeniería en Informática — **Institución:** Duoc UC Alameda
* **Asignatura:** Proyecto Capstone (APT122) — **Docente Guía:** Felipe Krauss

---

## Tecnologías Utilizadas

### Frontend
* **[Next.js 16 (App Router)](https://nextjs.org/):** Framework React para SSR, rutas aisladas y APIs REST.
* **[React 19](https://react.dev/):** Biblioteca para componentes reactivos y accesibles.
* **[Tailwind CSS 4](https://tailwindcss.com/):** Estilos utilitarios y soporte de alto contraste accesible.
* **[Lucide React](https://lucide.dev/):** Iconografía moderna en consola, box y monitores en tiempo real.

### Backend, Telefonía e IA
* **[Node.js](https://nodejs.org/) & [TypeScript](https://www.typescriptlang.org/):** Tipado estricto en rutas de API y servicios transaccionales.
* **[Twilio Voice & Messaging](https://www.twilio.com/):** Telefonía programable (`Polly.Mia-Neural`, captura `es-CL` y DTMF con separación estricta Voz vs. Teclado) y despacho real de tickets SMS GSM-7 (`<= 160` caracteres), con respaldo automático para cuentas Free Trial (`572006`).
* **Motor Conversacional Híbrido:** Reglas deterministas (`<10ms`), acumulación de RUT en pausas, tolerancia fonética/rotacismo y respaldo semántico con **Google Gemini API**.
* **Algoritmo Módulo 11:** Validación estricta de RUT chileno en backend y frontend.
* **Transacciones Atómicas & Seguridad RBAC:** Retención temporal `TTL 120s`, índice único parcial en PostgreSQL y cookies `HttpOnly` firmadas (`HMAC-SHA256` vía Web Crypto API).

### Base de Datos e Infraestructura
* **[PostgreSQL 16](https://www.postgresql.org/) & [Prisma ORM](https://www.prisma.io/):** Aislamiento ACID, índice único parcial (`idx_citas_bloque_activa_unique`) y esquema tipado.
* **[Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/):** Levantamiento completo en **1 comando**, con auto-seed inteligente al iniciar con la BD vacía y **[Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/)** autodetectado por `http://tunnel:20241/quicktunnel`.

---

## Requisito Único en el PC

* **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** instalado y en ejecución *(Windows, macOS o Linux)*.

> *No requiere instalar Node.js ni PostgreSQL directamente en tu máquina anfitriona.*

---

## Levantamiento en 1 Solo Comando (`docker compose up`)

Puedes ejecutarlo **directamente desde la raíz `MallaSalud/`** (o dentro de `MallaSalud/mallasalud/`):

```bash
docker compose up -d --build
```

> *El proyecto arranca **incluso sin archivo `.env`**: si PostgreSQL está vacío, `scripts/seed-if-empty.mjs` carga automáticamente pacientes, profesionales, credenciales RBAC, boxes y agendas del día y de mañana.*

### Servicios levantados automáticamente
1. **`mallasalud_app`**: Aplicación Next.js en [http://localhost:3000](http://localhost:3000) (sincroniza esquema Prisma y ejecuta auto-seed inicial).
2. **`mallasalud_postgres`**: Base de datos PostgreSQL 16 en el puerto `5433` (interno `5432`).
3. **`mallasalud_studio`**: Explorador visual Prisma Studio en [http://localhost:5555](http://localhost:5555).
4. **`mallasalud_tunnel`**: Túnel HTTPS Cloudflare autodetectado automáticamente en `/ivr` y `/api/twilio/voice`.

### (Opcional) Habilitar llamadas reales y SMS vía Twilio + Gemini
Si quieres probar llamadas telefónicas y SMS reales con tus credenciales:

```bash
cp mallasalud/.env.example mallasalud/.env
# Completa TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, DEFAULT_TO_NUMBER y GEMINI_API_KEYS
docker compose up -d --force-recreate app
```

---

## Enlaces de Acceso a las Interfaces

| Módulo / Canal | Enlace Local | Acceso / Rol RBAC | Descripción y Alcance |
| :--- | :--- | :--- | :--- |
| **Portal Paciente (HU-001/002/008)** | [http://localhost:3000](http://localhost:3000) | **Público (Pacientes)** | Identificación por RUT (Módulo 11), aviso educativo NSP en 1 clic, retención temporal atómica **TTL 120s** (`BLOQUEO_TEMPORAL`), reserva web (`WEB`) con comprobante `MS-XXXXXX`, impresión/PDF y anulación oportuna (`>= 30 min`, `CANCELADA_OPORTUNA`). |
| **Acceso Funcionarios (RBAC)** | [http://localhost:3000/login](http://localhost:3000/login) | **Intranet** | Inicio de sesión institucional con cookie `HttpOnly` firmada (`HMAC-SHA256`) y protección en `src/proxy.ts` para separar el Portal Paciente de las vistas internas. |
| **Calendario SOME (HU-005)** | [http://localhost:3000/some/agendas](http://localhost:3000/some/agendas) | **Rol `SOME`** | Matriz diaria por boxes, vista semanal, exclusión automática de colación (`13:00–14:00`), cuota 60+ intercalada y pausa de agendas (`BLOQUEADO_SOME`). |
| **Ventanilla SOME (HU-006)** | [http://localhost:3000/some/ventanilla](http://localhost:3000/some/ventanilla) | **Rol `SOME`** | Mesón presencial (`VENTANILLA_SOME`), Alta Rápida de pacientes, atajos de teclado, ticket térmico 80mm (`@media print`) y prioridad de cupos `⚡ Liberado`. |
| **Central Telefónica IA (VOZ_IVR)** | [http://localhost:3000/ivr](http://localhost:3000/ivr) | **Rol `SOME`** | Monitor en vivo, simulador de voz y teclado DTMF, detección automática de túnel HTTPS, llamadas entrantes/salientes Twilio (`Polly.Mia-Neural`) y **Bandeja de Auditoría SMS GSM-7**. |
| **Panel Box Clínico (HU-007)** | [http://localhost:3000/doctor](http://localhost:3000/doctor) | **Rol `PROFESIONAL`** | Vista operativa **Zero Dashboard** exclusiva del tratante: registra `ATENDIDA` o `NO_ASISTE` (validando tolerancia de **15 min** e incrementando `contador_inasistencias + 1`), bloqueando citas futuras (`422`) y accesos cruzados (`403`). |
| **Base de Datos (Prisma Studio)** | [http://localhost:5555](http://localhost:5555) | **Local / Admin** | Explorador visual de tablas, relaciones, índice único parcial (`idx_citas_bloque_activa_unique`), `canal_origen` y `registro_sms`. |

---

## Credenciales Institucionales de Prueba (Seed RBAC)

| Rol | Correo / RUT | Contraseña | Acceso Permitido |
| :--- | :--- | :--- | :--- |
| **`SOME`** | `some@cesfam.cl` / `13648291-2` | `Some2026!` | `/some/agendas`, `/some/ventanilla`, `/ivr` |
| **`PROFESIONAL` (Box 101 Med.)** | `carlos.munoz@cesfam.cl` / `14258369-0` | `Doctor2026!` | `/doctor` (nómina propia; incluye citas demo `MS-BOX001..003`) |
| **`PROFESIONAL` (Box 102 Med.)** | `valentina.silva@cesfam.cl` / `16789456-9` | `Doctor2026!` | `/doctor` (nómina propia) |
| **`PROFESIONAL` (Box 201 Dental)** | `roberto.cardenas@cesfam.cl` / `15321654-1` | `Doctor2026!` | `/doctor` (nómina propia) |
| **`PROFESIONAL` (Box 301 Matrona)** | `camila.fuentes@cesfam.cl` / `17896321-K` | `Doctor2026!` | `/doctor` (nómina propia) |

---

## Casos de Prueba Controlados para la Demostración

| Caso de Prueba | RUT de Prueba | Resultado Esperado en la Llamada / Sistema |
| :--- | :--- | :--- |
| **1. Paciente No Inscrito en Padrón** | `6.419.832-7` / `21.483.926-1` | Rechaza amablemente indicando acercarse con su cédula de identidad a ventanilla presencial SOME. |
| **2. Hora Ocupada — Antes y Después** | `21.758.467-1` (pide `11:00`) | Sugiere alternativa antes (`10:40`) y después (`11:20`). Confirma en PostgreSQL (`VOZ_IVR`) con ticket deletreado y SMS GSM-7 (`<= 160` chars). |
| **3. Regla de Cita Duplicada / Reagendar** | `21.758.467-1` (pide `12:00` con cita hoy) | Recuerda la cita activa y ofrece **anular la anterior (`CANCELADA_OPORTUNA`) y reagendar a las `12:00`** sin perder historial. |
| **4. Cancelación Oportuna (`>= 30 min`)** | `21.758.467-1` / `16.842.915-0` | Diciendo *"Quiero cancelar mi hora médica"* o por DTMF `2` verifica `>= 30 min`, libera el bloque a `DISPONIBLE` y registra SMS de anulación. |
| **5. Adulto Mayor (75a) — Cuota 60+** | `5.842.319-K` (pide `10:00` o DTMF `5842319*#`) | Vocativo respetuoso (*"Don o Señora Elena Rosa"*), cuota protegida 60+ y modo 100% DTMF sin menciones de voz (o 100% voz sin mencionar botones). |
| **6. Flujo Web + TTL 120s + Panel Box** | `16.842.915-0` / `MS-BOX001..003` | En `/` activa modal educativo NSP, retención **120s** (`WEB`), anulación `>= 30 min` y demostración clínica en `/doctor` (`NO_ASISTE` -> `+1 NSP`). |

---

## Canal Telefónico Híbrido (Voz + DTMF) y Ticket SMS Real

1. Inicia sesión como **SOME** en [http://localhost:3000/login](http://localhost:3000/login) y abre [http://localhost:3000/ivr](http://localhost:3000/ivr).
2. El sistema detecta automáticamente la URL HTTPS del túnel (`http://tunnel:20241/quicktunnel`) o usa `PUBLIC_WEBHOOK_BASE_URL` en la nube.
3. Puedes probar sin teléfono usando el **simulador de voz** y el **teclado DTMF en pantalla**, o con llamadas reales Twilio:
   - **Separación estricta de modalidad (`modoInteraccion`):** tras la bienvenida inicial, si el usuario habla (`VOZ`), las respuestas eliminan toda referencia a botones/teclas; si marca (`TECLADO`), el `<Gather input="dtmf">` escucha solo tonos y no menciona hablar.
   - **Envío real de SMS (`twilioSms.ts`):** únicamente en llamadas Twilio reales (`CallSid` `CA...`) envía el ticket SMS GSM-7 (`MallaSalud Ticket MS-XXXXXX: ... Para reagendar o anular (30m antes) llame al CESFAM o use web.`). Si Twilio está en **Free Trial** (`572006`), reintenta automáticamente con la plantilla `sms_appointment_reminders` (`ENVIADO_TWILIO_TRIAL`) conservando el ticket completo en `registro_sms`.

---

## Despliegue en la Nube (Railway / Docker)

1. Crea un proyecto en [Railway](https://railway.app/) con un servicio **PostgreSQL** y conecta el repositorio con **Root Directory:** `mallasalud` (usará [`mallasalud/Dockerfile`](mallasalud/Dockerfile)).
2. Configura las variables de entorno usando [`mallasalud/.env.example`](mallasalud/.env.example) como plantilla (`DATABASE_URL`, `SESSION_SECRET`, `TWILIO_*`, `PUBLIC_WEBHOOK_BASE_URL` y `GEMINI_API_KEYS`).
3. Al arrancar por primera vez, el contenedor ejecuta `npx prisma db push && node scripts/seed-if-empty.mjs && npm run start` cargando los datos demo automáticamente.
4. En `/ivr`, pulsa **"Activar Llamadas Entrantes en este Webhook"** para apuntar tu número Twilio a `https://<tu-dominio>/api/twilio/voice`.

---

## Comandos de Mantenimiento y Pruebas QA

```bash
# Levantar todo (desde MallaSalud/ o MallaSalud/mallasalud/)
docker compose up -d --build

# Ver logs de aplicación y túnel Cloudflare
docker compose logs -f app
docker compose logs -f tunnel

# Reiniciar seed completo manualmente en PostgreSQL
docker compose exec app npm run db:seed

# Ejecutar suite QA integral end-to-end (11 suites: RBAC, concurrencia 120s, GSM-7, Box e IVR)
cd mallasalud && node scripts/test-api.mjs

# Verificar tipos TypeScript
cd mallasalud && npx tsc --noEmit

# Detener contenedores
docker compose down
```

---

## Estructura del Proyecto

```text
MallaSalud/
├── .gitignore                                  # Bloquea .env, llaves *.pem/*.key y temporales
├── docker-compose.yml                          # Punto de entrada raíz (include mallasalud/docker-compose.yml)
├── README.md                                   # Documentación principal del repositorio
└── mallasalud/
    ├── .env.example                            # Plantilla documentada de variables (sin secretos)
    ├── Dockerfile                              # Imagen producción Next.js + Prisma + auto-seed
    ├── docker-compose.yml                      # Orquestación app + postgres + studio + tunnel
    ├── scripts/
    │   ├── seed-if-empty.mjs                   # Auto-seed seguro si la BD arranca vacía
    │   └── test-api.mjs                        # Suite QA end-to-end (11 suites automatizadas)
    └── src/
        ├── proxy.ts                            # Protección RBAC de rutas (/some, /ivr, /doctor, /login)
        ├── app/                                # Next.js App Router
        │   ├── (web)/
        │   │   ├── (paciente)/                 # Portal Paciente (/ y /reservar)
        │   │   ├── (personal)/                 # Intranet SOME (/some/agendas y /some/ventanilla)
        │   │   └── doctor/                     # Panel Box Clínico HU-007 (/doctor)
        │   ├── (ivr)/ivr/                      # Central Telefónica IA VOZ_IVR (/ivr)
        │   ├── login/                          # Autenticación Institucional RBAC (/login)
        │   └── api/
        │       ├── call/start/route.ts         # Inicio de llamada saliente Twilio (Rol SOME)
        │       ├── ivr/                        # configure-inbound, status, reset (Rol SOME)
        │       ├── twilio/voice/route.ts       # Webhook público TwiML (Voz neural + DTMF aislado)
        │       └── v1/                         # auth, box, citas, pacientes, some
        ├── components/common/                  # Header, IntranetHeader y Footer
        └── lib/
            ├── core/                           # prisma, ensureDbIndexes, sessionToken, password, authServer
            ├── shared/utils/                   # rut, edad, codigo-reserva, sms (GSM-7 <= 160)
            ├── web/services/                   # pacientes, agendas, bloqueo (120s), ventanilla, box
            └── ivr/                            # ivrScheduleService, voiceAgent, twilioSms, tunnelUrl, types
```
