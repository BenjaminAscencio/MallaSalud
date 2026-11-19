# MallaSalud — Módulo Web, Backend y Canal Telefónico IA

Sistema omnicanal de gestión y asignación de horas médicas para Centros de Salud Pública Primaria (CESFAM). Integra reserva web (`WEB`) con retención temporal de 120s, mesón presencial SOME (`VENTANILLA_SOME`), panel clínico de box (`HU-007`) y canal telefónico autónomo (**`VOZ_IVR`**) con separación estricta entre **Voz** y **Teclado DTMF**, envío real de tickets **SMS GSM-7** vía Twilio y persistencia transaccional en PostgreSQL bajo control RBAC.

---

## Requisito Único en el Computador

* **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** instalado y en ejecución *(Windows, macOS o Linux)*. No requiere instalar Node.js ni PostgreSQL en el equipo anfitrión.

---

## 1. Inicio Rápido con Docker (1 Solo Comando)

Puedes ejecutar el comando desde esta carpeta (`mallasalud/`) o desde la raíz del repositorio (`MallaSalud/`):

```bash
docker compose up -d --build
```

> **Cómo arranca automáticamente sin fricción:**
> - **Sin `.env` obligatorio:** `docker-compose.yml` marca `.env` como opcional (`required: false`) usando valores seguros por defecto para base de datos, puerto y sesión local.
> - **Auto-seed en BD vacía:** al iniciar, `scripts/seed-if-empty.mjs` revisa si PostgreSQL está vacío y carga automáticamente pacientes, profesionales, boxes, agendas y credenciales RBAC sin sobrescribir cambios posteriores.
> - **Servicios orquestados:** `mallasalud_app` (Next.js `:3000`), `mallasalud_postgres` (PostgreSQL 16 `:5433`), `mallasalud_studio` (Prisma Studio `:5555`) y `mallasalud_tunnel` (túnel HTTPS Cloudflare con métricas internas en `:20241` autodetectadas por `src/lib/ivr/tunnelUrl.ts`).

### (Opcional) Activar telefonía real Twilio y Gemini API
```bash
cp .env.example .env
# Completa TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, DEFAULT_TO_NUMBER y GEMINI_API_KEYS
docker compose up -d --force-recreate app
```

---

## 2. Enlaces de Acceso y Roles RBAC

* **Portal Pacientes Público (HU-001/002/008):** [http://localhost:3000](http://localhost:3000) *(bloqueo temporal **TTL 120s**, reserva `WEB`, comprobante imprimible/PDF y anulación oportuna `>= 30 min`)*
* **Acceso Funcionarios / Login RBAC:** [http://localhost:3000/login](http://localhost:3000/login) *(cookie `HttpOnly` firmada `HMAC-SHA256` validada por `src/proxy.ts`)*
* **Consola de Agendas SOME (HU-005):** [http://localhost:3000/some/agendas](http://localhost:3000/some/agendas) *(Rol `SOME`)*
* **Ventanilla Presencial SOME (HU-006):** [http://localhost:3000/some/ventanilla](http://localhost:3000/some/ventanilla) *(Rol `SOME` · `VENTANILLA_SOME`)*
* **Central Telefónica IA (Canal `VOZ_IVR`):** [http://localhost:3000/ivr](http://localhost:3000/ivr) *(Rol `SOME` · llamadas entrantes/salientes, simulador Voz/DTMF y Bandeja SMS GSM-7)*
* **Panel Box Clínico (HU-007):** [http://localhost:3000/doctor](http://localhost:3000/doctor) *(Rol `PROFESIONAL` · nómina operativa Zero Dashboard para `ATENDIDA` / `NO_ASISTE` con tolerancia de 15 min)*
* **Prisma Studio (Base de Datos):** [http://localhost:5555](http://localhost:5555)

### Credenciales Institucionales de Prueba (Auto-Seed)

| Rol | Correo / RUT | Contraseña | Acceso |
| :--- | :--- | :--- | :--- |
| **`SOME`** | `some@cesfam.cl` / `13648291-2` | `Some2026!` | Agendas, Ventanilla y Monitor IVR |
| **`PROFESIONAL` (Box 101 Med.)** | `carlos.munoz@cesfam.cl` / `14258369-0` | `Doctor2026!` | `/doctor` (incluye citas demo `MS-BOX001..003`) |
| **`PROFESIONAL` (Box 102 Med.)** | `valentina.silva@cesfam.cl` / `16789456-9` | `Doctor2026!` | `/doctor` (nómina propia) |
| **`PROFESIONAL` (Box 201 Dental)** | `roberto.cardenas@cesfam.cl` / `15321654-1` | `Doctor2026!` | `/doctor` (nómina propia) |
| **`PROFESIONAL` (Box 301 Matrona)** | `camila.fuentes@cesfam.cl` / `17896321-K` | `Doctor2026!` | `/doctor` (nómina propia) |

---

## 3. Central Telefónica Híbrida (`VOZ_IVR`) y SMS Transaccional

1. **Inicia sesión (`SOME`)** en [http://localhost:3000/login](http://localhost:3000/login) y abre [http://localhost:3000/ivr](http://localhost:3000/ivr).
2. **URL pública automática:** `src/lib/ivr/tunnelUrl.ts` detecta en vivo la URL del contenedor `tunnel` (`https://xxxx.trycloudflare.com`) o prioriza `PUBLIC_WEBHOOK_BASE_URL` en producción.
3. **Separación estricta Voz vs. Teclado DTMF (`modoInteraccion`):**
   - El saludo inicial ofrece elegir entre teclado (`1` pedir / `2` anular) o hablar directo.
   - Si el paciente responde por **Voz**, la central conversa sin mencionar teclas, botones, numeral ni asterisco, tolerando pausas de RUT y rotacismo (`lut`, `router`, `taide`, `matlona`).
   - Si el paciente usa **Teclado DTMF** (`*` o `0` = `K` + `#`), las instrucciones son 100% de marcación y el webhook cambia `<Gather input="dtmf">` para evitar interferencias por ruido ambiente.
4. **Ticket SMS real vía Twilio (`src/lib/ivr/twilioSms.ts`):**
   - Solo se envía SMS real en llamadas telefónicas Twilio reales (`CallSid` `CA...`); simulaciones web y pruebas QA auditan en PostgreSQL sin consumir cuota.
   - Ticket GSM-7 `<= 160` caracteres con código, especialidad, fecha, box y aviso de reagendamiento/anulación llamando (`30m` antes). En cuentas **Twilio Free Trial** que devuelvan error `572006`, reintenta automáticamente con la plantilla `TWILIO_TRIAL_SMS_TEMPLATE` (`sms_appointment_reminders`) registrando estado `ENVIADO_TWILIO_TRIAL`.

---

## 4. Despliegue en la Nube (Railway / Docker)

1. Crea un proyecto en [Railway](https://railway.app/), agrega **PostgreSQL** y apunta el repositorio a `Root Directory: mallasalud` (`Dockerfile`).
2. Define variables según [`.env.example`](.env.example) (`DATABASE_URL`, `SESSION_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `DEFAULT_TO_NUMBER`, `PUBLIC_WEBHOOK_BASE_URL`, `GEMINI_API_KEYS`).
3. El arranque de producción ejecuta `npx prisma db push && node scripts/seed-if-empty.mjs && npm run start`. Luego pulsa **"Activar Llamadas Entrantes en este Webhook"** en `/ivr` para vincular tu número Twilio.

---

## 5. Datos de Prueba Controlados y Concurrencia

* **Adulto Mayor (Cuota 60+):** `5.842.319-K` — Elena Rosa Valenzuela Castro (75 años).
* **Adulto Joven en Padrón (0 NSP):** `21.758.467-1` — Ignacio Andrés Morales Soto (24 años).
* **Paciente con Inasistencias (NSP = 2):** `16.842.915-0` — Matías Sebastián Rojas Herrera (38 años, activa modal educativo NSP y flujo web `WEB`).
* **No Inscritos (Derivación SOME / Alta Rápida):** `21.483.926-1` y `6.419.832-7`.
* **Panel Box Clínico (`/doctor`):** Citas demo de hoy `MS-BOX001` (`NO_ASISTE` +1 NSP), `MS-BOX002` (`ATENDIDA` / rechazo `<30m` HTTP 422) y `MS-BOX003` (futura).
* **Índice Único Parcial (`idx_citas_bloque_activa_unique`):** Previene doble reserva concurrente sobre citas `AGENDADA` o `ATENDIDA` mientras permite reciclar bloques tras `CANCELADA_OPORTUNA`.

---

## 6. Comandos Útiles y Suite QA

```bash
# Levantar stack completo (auto-seed si la BD está vacía)
docker compose up -d --build

# Ver logs de la aplicación o del túnel Cloudflare
docker compose logs -f app
docker compose logs -f tunnel

# Reiniciar seed completo manualmente (limpia y repuebla datos demo)
docker compose exec app npm run db:seed

# Ejecutar suite QA integral end-to-end (11 suites)
node scripts/test-api.mjs

# Verificar tipos TypeScript
npx tsc --noEmit

# Detener los contenedores
docker compose down
```

---

## 7. Estructura del Proyecto

```text
mallasalud/
├── .env.example                                # Plantilla segura de variables de entorno
├── Dockerfile                                  # Build producción Next.js + Prisma + auto-seed
├── docker-compose.yml                          # app + postgres + studio + tunnel (--metrics 0.0.0.0:20241)
├── scripts/
│   ├── seed-if-empty.mjs                       # Auto-seed al primer arranque con BD vacía
│   └── test-api.mjs                            # Suite QA (11 suites E2E)
└── src/
    ├── proxy.ts                                # Protección RBAC de rutas (/some, /ivr, /doctor, /login)
    ├── app/
    │   ├── (web)/
    │   │   ├── (paciente)/                     # Portal Paciente limpio (Header + Footer)
    │   │   ├── (personal)/                     # Intranet SOME (/some/agendas, /some/ventanilla)
    │   │   └── doctor/                         # Panel Box Clínico HU-007 (/doctor)
    │   ├── (ivr)/ivr/                          # Central Telefónica IA VOZ_IVR (/ivr)
    │   ├── login/                              # Autenticación Institucional RBAC (/login)
    │   └── api/
    │       ├── call/start/route.ts
    │       ├── ivr/{configure-inbound,status,reset}/route.ts
    │       ├── twilio/voice/route.ts           # Webhook público Twilio (Voz/DTMF separados)
    │       └── v1/{auth,box,citas,pacientes,some}/**
    ├── components/common/                      # Header, IntranetHeader, Footer
    └── lib/
        ├── core/                               # prisma, ensureDbIndexes, sessionToken, password, authServer
        ├── shared/utils/                       # rut, edad, codigo-reserva, sms (GSM-7 <= 160)
        ├── web/services/                       # pacientes, agendas, bloqueo (TTL 120s), ventanilla, box
        └── ivr/                                # ivrScheduleService, voiceAgent, twilioSms, tunnelUrl, types
```
