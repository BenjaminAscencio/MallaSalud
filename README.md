# MALLASALUD

> **Sistema integral y omnicanal para la gestión, distribución y reserva de horas médicas en Centros de Salud Pública Primaria (CESFAM, SAPU y consultorios).**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![Twilio Voice](https://img.shields.io/badge/Twilio-Voice_IVR-F22F46?logo=twilio)](https://www.twilio.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

---

## Descripción del Proyecto

**MALLASALUD** nace como respuesta a la problemática en la salud pública chilena y la brecha digital que afecta a los adultos mayores con respecto a la reserva de horas médicas.

El sistema proporciona una plataforma omnicanal que sincroniza en tiempo real las agendas de especialidades médicas clave (Medicina General, Urgencia Dental y Matronería), garantizando cuotas prioritarias para adultos mayores y permitiendo la reserva por **ventanilla presencial**, **portal web** y **asistente telefónico autónomo con IA (Canal VOZ_IVR)**.

---

## Integrantes del Equipo y Roles

| Integrante | Rol Principal | Especialización y Responsabilidades |
| :--- | :--- | :--- |
| **Benjamín Ascencio** | **Backend Developer & Datos** | - Modelado relacional normalizado e integridad referencial.<br>- Persistencia con PostgreSQL y Prisma ORM.<br>- Lógica transaccional, concurrencia y módulo telefónico VOZ_IVR con Twilio.<br>- Documentación técnica y despliegue. |
| **Pablo Carrasco** | **Frontend Developer & Interfaces** | - Arquitectura de componentes e interfaz reactiva con Next.js y React.<br>- Sistema de diseño inclusivo y responsivo con Tailwind CSS.<br>- Accesibilidad y usabilidad orientada a adultos mayores.<br>- Desarrollo de interfaces: Portal Paciente, Consola SOME, Panel Box Médico y Monitor IVR. |

* **Carrera:** Ingeniería en Informática — **Institución:** Duoc UC Alameda  
* **Asignatura:** Proyecto Capstone (APT122) — **Docente Guía:** Felipe Krauss  

---

## Tecnologías Utilizadas

### Frontend
* **[Next.js (App Router)](https://nextjs.org/):** Framework React para SSR, generación estática y Server Actions.
* **[React 19](https://react.dev/):** Biblioteca para componentes reactivos y accesibles.
* **[Tailwind CSS](https://tailwindcss.com/):** Estilos utilitarios y soporte de alto contraste accesible.
* **[Lucide React](https://lucide.dev/):** Iconografía moderna en consola y monitores en tiempo real.

### Backend, Telefonía y Lógica de Negocio
* **[Node.js](https://nodejs.org/) & [TypeScript](https://www.typescriptlang.org/):** Tipado estricto en rutas de API y transacciones.
* **[Twilio Voice](https://www.twilio.com/voice):** Telefonía programable con transcripción de voz (`es-CL`), Barge-In y TwiML dinámico.
* **Motor Conversacional Híbrido:** Reconocimiento afirmativo ultrarrápido (<10ms), Gemini API y NLU local de respaldo inmediato ante contingencias de cuota o latencia.
* **Algoritmo Módulo 11:** Validación estricta de RUT chileno en backend y frontend.
* **Transacciones Atómicas:** Bloqueo y asignación inmediata de cupos evitando sobre-agendamiento entre canales.

### Base de Datos y Persistencia
* **[PostgreSQL 16](https://www.postgresql.org/):** Motor relacional con aislamiento ACID.
* **[Prisma ORM](https://www.prisma.io/):** Modelado de datos, migraciones automáticas y consultas tipadas.

### Infraestructura y Despliegue
* **[Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/):** Orquestación integral de aplicación, base de datos, Prisma Studio y túnel Cloudflare.
* **[Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/):** Conexión segura HTTPS hacia Twilio sin exponer puertos manuales.

---

## Requisito Único en el PC

Para ejecutar el proyecto solo se necesita tener instalado y abierto:
* **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** *(Compatible con Windows, Mac y Linux)*.

> *No requiere instalar Node.js ni PostgreSQL directamente en la máquina anfitriona.*

---

## Paso a Paso para Ejecutar en Local (1 Solo Comando)

### 1. Entrar a la carpeta del proyecto
```bash
cd mallasalud
```

### 2. Iniciar todos los contenedores con Docker
```bash
docker compose up -d --build
```
> *Este comando levantará automáticamente los 4 servicios integrados:*
> 1. **`mallasalud_app`**: Servidor Next.js en el puerto `3000` con sincronización automática de esquema Prisma.
> 2. **`mallasalud_tunnel`**: Túnel HTTPS de Cloudflare para recibir los webhooks de Twilio.
> 3. **`mallasalud_postgres`**: Base de datos relacional PostgreSQL 16 en el puerto `5433` (interno 5432).
> 4. **`mallasalud_studio`**: Prisma Studio (explorador visual de BD) en el puerto `5555`.

### 3. Obtener la URL Pública para la Demostración Telefónica
```bash
docker compose logs tunnel
```
> Busca la línea con tu enlace: `https://xxxx-xxxx.trycloudflare.com`

---

## Enlaces de Acceso a las Interfaces

| Módulo / Canal | Enlace Local | Descripción y Alcance |
| :--- | :--- | :--- |
| **Central Telefónica IA (VOZ_IVR)** | [http://localhost:3000/ivr](http://localhost:3000/ivr) | Disparador de llamadas reales a celular, consola de transcripción en vivo, monitor PostgreSQL en tiempo real y reinicio de horas. |
| **Portal Paciente (HU-001/002)** | [http://localhost:3000](http://localhost:3000) | Identificación por RUT (Módulo 11), detección de padrón, aviso educativo NSP y reserva web. |
| **Calendario SOME (HU-005)** | [http://localhost:3000/some/agendas](http://localhost:3000/some/agendas) | Matriz diaria por boxes, horario semanal, colación y cuota 60+. |
| **Ventanilla SOME (HU-006)** | [http://localhost:3000/some/ventanilla](http://localhost:3000/some/ventanilla) | Mesón presencial, Alta Rápida de pacientes y emisión de ticket. |
| **Base de Datos (Prisma Studio)** | [http://localhost:5555](http://localhost:5555) | Explorador visual permanente de tablas, relaciones y citas registradas. |

---

## Casos de Prueba Controlados para la Demostración

| Caso de Prueba | RUT de Prueba | Resultado Esperado en la Llamada |
| :--- | :--- | :--- |
| **1. Adulto Mayor (75a) - Hora Ocupada y Negociación** | `5.555.555-5` | Trato con vocativo (*"Don o Señora Elena"*), detecta 10:00 ocupada, propone 10:30, confirma al decir *"sí, me parece bien"* en <15ms con código de reserva. |
| **2. Paciente No Inscrito en Padrón** | `21.222.222-2` | Rechaza amablemente indicando que debe acercarse con su cédula de identidad a la ventanilla SOME presencial del CESFAM. |
| **3. Regla de Cita Única** | `5.555.555-5` (repetir) | Explica que ya tiene una cita agendada hoy a las 10:30 y que solo se permite 1 cita por especialidad al día. |
| **4. Elección de Especialidad (Dental)** | `21.111.111-1` | Detecta *"dentista"* o *"urgencia dental"*, asigna con Dr. Roberto Cárdenas en Box 201 Dental a las 11:30. |

---

## Cómo Probar el Canal Telefónico IA en Vivo

1. Entra a [http://localhost:3000/ivr](http://localhost:3000/ivr) (o a la URL del túnel Cloudflare).
2. Presiona **"Iniciar Llamada Telefónica (VOZ_IVR)"**.
3. Al sonar tu celular, contesta y **presiona la tecla 1** (requerimiento de locución inicial por cuenta Trial de Twilio).
4. Pide la hora de las 10:00:
   - *"Hola buenas tardes, soy Elena Valenzuela, mi RUT es 5555555-5 y quiero hora para las diez de la mañana"*.
5. La recepcionista te informará que las 10:00 ya está reservada y te sugerirá la más cercana (10:30):
   - Di: *"Sí, me parece bien, agéndela"*.
6. La cita se agendará al instante en PostgreSQL, verás la transcripción en vivo y el bloque pasará a `RESERVADO` con la etiqueta `VOZ_IVR` y su código de reserva.
7. Haz clic en **"Reiniciar Horas en BD"** para repetir la prueba cuantas veces desees frente a la comisión.

---

## Despliegue en la Nube (Hosting Permanente)

Para desplegar MallaSalud de forma permanente sin depender de tu laptop ni de túneles:

1. **Crear proyecto en [Railway](https://railway.app/):**
   - Agrega un servicio **PostgreSQL** administrado.
   - Agrega tu repositorio GitHub `MallaSalud` con raíz en la subcarpeta `mallasalud`.
2. **Variables de Entorno en el Host:**
   - `DATABASE_URL`: URL provista por el PostgreSQL en la nube.
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`: Credenciales de Twilio.
   - `PUBLIC_WEBHOOK_BASE_URL`: Dominio público del host (ej. `https://mallasalud.up.railway.app`).
   - `GEMINI_API_KEYS`: Claves de API de Gemini.
3. **Configuración en Twilio:**
   - En la consola de Twilio, configura en el número `+17372508034` la URL del webhook entrante:  
     `https://mallasalud.up.railway.app/api/twilio/voice`
   - Con esto, cualquier persona puede llamar directamente al número telefónico y la central atenderá de forma autónoma.

---

## Comandos de Mantenimiento

* **Ver logs de la aplicación:**
  ```bash
  docker compose logs -f app
  ```
* **Ver logs del túnel Cloudflare:**
  ```bash
  docker compose logs -f tunnel
  ```
* **Poblar la base de datos con el seed completo:**
  ```bash
  docker compose exec app npm run db:seed
  ```
* **Detener los contenedores:**
  ```bash
  docker compose down
  ```

---

## Estructura del Proyecto

```text
mallasalud/src/
├── app/                                        # Next.js App Router (Rutas Limpias)
│   │
│   ├── (web)/                                  # DOMINIO WEB
│   │   ├── (paciente)/                         # Subdominio Pacientes
│   │   │   ├── page.tsx                        # Portal Paciente (/)
│   │   │   ├── page.css                        # Estilos aislados del portal
│   │   │   └── reservar/                       # Flujo de Reserva (/reservar)
│   │   │       ├── page.tsx
│   │   │       └── reservar.css                # Estilos aislados de reserva
│   │   │
│   │   ├── (personal)/                         # Subdominio Personal de Salud (SOME)
│   │   │   └── some/
│   │   │       ├── agendas/                    # Matriz de Agendas (/some/agendas)
│   │   │       │   ├── page.tsx
│   │   │       │   └── agendas.css             # Estilos de agendas
│   │   │       └── ventanilla/                 # Mesón Presencial (/some/ventanilla)
│   │   │           ├── page.tsx
│   │   │           └── ventanilla.css          # Estilos de ventanilla
│   │   │
│   │   └── doctor/                             # Subdominio Medico (Futuro)
│   │       └── .gitkeep                        # Preservado para ficha clinica medica
│   │
│   ├── (ivr)/                                  # DOMINIO TELEFONIA IA (VOZ_IVR)
│   │   └── ivr/                                # Central Telefonica y Monitor (/ivr)
│   │       ├── page.tsx                        # Componente React reactivo
│   │       └── ivr.css                         # Estilos aislados, animaciones y consola
│   │
│   ├── api/                                    # Capa de Endpoints REST
│   │   ├── call/start/route.ts                 # Disparo de llamada Twilio
│   │   ├── ivr/status/route.ts                 # Monitor en tiempo real y simulacion
│   │   ├── ivr/reset/route.ts                  # Limpieza de base de datos
│   │   ├── twilio/voice/route.ts               # Webhook TwiML de Twilio
│   │   └── v1/ (citas, pacientes, some)        # API REST corporativa
│   │
│   ├── favicon.ico
│   ├── globals.css                             # Tokens y variables de Tailwind
│   └── layout.tsx                              # Layout raiz con Header, Footer y DevNavbar
│
├── components/                                 # Componentes Visuales Reutilizables
│   ├── common/                                 # Componentes compartidos globales
│   │   ├── Header.tsx & Header.css
│   │   ├── Footer.tsx & Footer.css
│   │   └── DevNavbar.tsx & DevNavbar.css
│   └── index.ts                                # Exportacion centralizada (@/components)
│
└── lib/                                        # Capa de Negocio, Servicios y Datos
    ├── core/                                   # Nucleo de Base de Datos
    │   ├── prisma.ts                           # PrismaClient Singleton con Connection Pooling
    │   └── index.ts
    │
    ├── shared/                                 # Utilidades Compartidas
    │   └── utils/
    │       ├── rut.ts                          # Algoritmo Modulo 11
    │       ├── edad.ts                         # Clasificador Adulto Mayor (60+)
    │       └── codigo-reserva.ts               # Generador de codigos unicos (MS-XXXXXX)
    │
    ├── web/                                    # Servicios del Canal Web / SOME
    │   └── services/
    │       ├── pacientes.service.ts            # Padron y verificacion
    │       ├── agendas.service.ts              # Generacion de bloques y colaciones
    │       └── ventanilla.service.ts           # Emision de tickets y alta rapida
    │
    └── ivr/                                    # Servicios de Telefonia IVR
        ├── ivrScheduleService.ts               # Logica de agendamiento por voz con Prisma
        ├── voiceAgent.ts                       # Motor IA con Gemini y fallback NLU (<15ms)
        ├── types.ts                            # Tipos TypeScript para llamadas y bloques
        └── index.ts                            # Exportacion del modulo telefonico
```
