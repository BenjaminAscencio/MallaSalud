# MallaSalud — Módulo Web, Backend y Canal Telefónico IA

Sistema omnicanal de gestión y asignación de horas médicas para Centros de Salud Pública Primaria (CESFAM). Integra reserva web, mesón presencial SOME y canal telefónico autónomo con inteligencia artificial (**VOZ_IVR**) respaldado por Twilio Voice y PostgreSQL.

---

## Requisito Único en el Computador

* **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** instalado y en ejecución en tu equipo (compatible con Windows, macOS y Linux). No requiere Node.js ni PostgreSQL instalados en la máquina anfitriona.

---

## 1. Inicio Rápido con Docker (1 Solo Comando)

Levanta todo el stack tecnológico en contenedores aislados:

```bash
# 1. Dentro de la carpeta mallasalud, compila e inicia los contenedores:
docker compose up -d --build
```

> **Servicios orquestados automáticamente:**
> - `mallasalud_app`: Servidor Next.js (puerto `3000`) con auto-sincronización de esquema Prisma (`prisma db push`).
> - `mallasalud_tunnel`: Túnel oficial Cloudflare que expone el puerto `3000` a Internet con HTTPS público para Twilio.
> - `mallasalud_postgres`: Base de datos PostgreSQL 16 (puerto `5433` local, `5432` interno).
> - `mallasalud_studio`: Prisma Studio activo de forma permanente en puerto `5555`.

### Ver la URL Pública de Cloudflare para Twilio

Para ver la URL pública generada automáticamente por el contenedor de túnel:

```bash
docker compose logs tunnel
```
> Verás una línea como:
> `Your quick Tunnel has been created! Visit it at: https://xxxx-xxxx.trycloudflare.com`

---

## 2. Enlaces de Acceso y Módulos Operativos

* **Portal Pacientes (HU-001/002):** [http://localhost:3000](http://localhost:3000)
* **Central Telefónica IA (Canal VOZ_IVR):** [http://localhost:3000/ivr](http://localhost:3000/ivr)
* **Consola de Agendas SOME (HU-005):** [http://localhost:3000/some/agendas](http://localhost:3000/some/agendas)
* **Ventanilla Presencial SOME (HU-006):** [http://localhost:3000/some/ventanilla](http://localhost:3000/some/ventanilla)
* **Prisma Studio (Explorador de Base de Datos):** [http://localhost:5555](http://localhost:5555)

---

## 3. Demostración en Vivo: Agente Telefónico IA (VOZ_IVR)

El módulo telefónico permite a los pacientes llamar o recibir llamadas para agendar citas directamente sobre la base de datos PostgreSQL:

1. **Ingresa al panel:** Navega a [http://localhost:3000/ivr](http://localhost:3000/ivr) (o a la URL pública del túnel).
2. **Revisa la configuración:**
   - La URL del webhook se autodetecta (`https://xxxx.trycloudflare.com`).
   - El número telefónico destino está preconfigurado (`+56937772647`).
3. **Disparar llamada:**
   - Haz clic en **"Iniciar Llamada Telefónica (VOZ_IVR)"**.
   - Sonará tu teléfono celular a través de Twilio Voice.
4. **Al contestar:**
   - Al tratarse de una cuenta Trial de Twilio, escucharás un mensaje en inglés:  
     *“You have a trial account. You can press any key to execute your code.”*
   - **Presiona la tecla `1` en el teclado de tu teléfono** para que la recepcionista IA comience a hablarte de inmediato.
5. **Flujos de Conversación Validados en Vivo (Casos de Demostración):**

   * **Caso 1: Adulto Mayor (75a) - Negociación Inteligente y Confirmación**
     - **Tú:** *"Hola buenas tardes, soy Elena Valenzuela, mi RUT es 5555555-5 y quiero hora para las diez de la mañana"*.
     - **Recepcionista IA:** *"Hola Don o Señora Elena Rosa, la hora de las 10:00 en Medicina General ya está ocupada, pero tengo disponible a las 10:30 con el Dr(a). Valentina Silva Osorio. ¿Desea agendarla?"*.
     - **Tú:** *"Sí, me parece bien, por favor agéndela"*.
     - **Recepcionista IA:** *"Perfecto Don o Señora Elena Rosa, su cita para el RUT 5555555-5 ha quedado confirmada a las 10:30 en Medicina General con código MS-XXXXXX. ¡Muchas gracias y que tenga un excelente día!"*.

   * **Caso 2: Regla de Cita Única (Evitar Sobreagendamiento)**
     - Vuelve a llamar o pide hora nuevamente para Elena hoy en Medicina General.
     - **Recepcionista IA:** *"Hola Elena Rosa, ya tiene una cita agendada para hoy a las 10:30 en Medicina General con el Dr(a). Valentina Silva Osorio. Por normativa del CESFAM, solo se permite una cita activa por especialidad al día."*.

   * **Caso 3: Paciente No Inscrito en Padrón (Derivación a Ventanilla SOME)**
     - **Tú:** *"Hola quiero hora para las 10 de la mañana, mi RUT es 21.222.222-2"*.
     - **Recepcionista IA:** *"El RUT 21222222-2 no se encuentra inscrito en nuestro centro de salud. Para solicitar horas médicas, debe acercarse presencialmente a la ventanilla SOME del CESFAM con su cédula de identidad para realizar su inscripción."*.

6. **Verificación en Pantalla:**
   - Verás la transcripción en vivo del diálogo.
   - En la grilla de bloques de PostgreSQL, el bloque de las **10:30** cambiará automáticamente de `DISPONIBLE` a `RESERVADO`, mostrando el RUT del paciente, el código de reserva y la etiqueta verde **`VOZ_IVR`**.
7. **Reiniciar para repetir la prueba:**
   - Haz clic en el botón **"Reiniciar Horas en BD"** para liberar los bloques y volver al estado inicial en 1 segundo.

---

## 4. Despliegue en la Nube (Producción / Demo sin Laptop)

Para tener el sistema 100% online con dominio HTTPS permanente (sin necesidad de túneles ni de tener tu laptop encendida):

### Despliegue en Railway (Recomendado)

1. Ingresa a [railway.app](https://railway.app/) y conecta tu cuenta de GitHub.
2. Crea un **Nuevo Proyecto** y selecciona **"Provision PostgreSQL"** (creará una base de datos PostgreSQL administrada en la nube).
3. Haz clic en **"Add Service" -> "GitHub Repo"** y selecciona este repositorio `MallaSalud`.
4. En la configuración del servicio:
   - **Root Directory:** `mallasalud`
   - **Build Command:** Usa el [`Dockerfile`](Dockerfile) existente (Railway lo detecta automáticamente).
5. En la pestaña **Variables de Entorno**, define:
   - `DATABASE_URL`: URL provista por el PostgreSQL en la nube.
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`: Credenciales de Twilio.
   - `DEFAULT_TO_NUMBER`: Teléfono destino preconfigurado.
   - `PUBLIC_WEBHOOK_BASE_URL`: Dominio público del host (ej. `https://tu-proyecto.up.railway.app`).
   - `GEMINI_API_KEYS`: Claves de API de Gemini separadas por coma.
6. **Configuración en Twilio:**
   - En la consola de Twilio, ve a **Phone Numbers** -> selecciona `+17372508034`.
   - En **Voice Configuration** (webhook de llamada entrante), pon:  
     `https://tu-proyecto.up.railway.app/api/twilio/voice`
   - Guarda los cambios. Ahora cualquier llamada directa al número `+17372508034` será atendida por la IA las 24 horas del día.

---

## 5. Datos de Prueba Preconfigurados

### Pacientes de Demostración y Reglas de Negocio
* **Adulto Mayor (Cuota 60+):** `5.555.555-5` — Elena Rosa Valenzuela Castro (75 años). Accede a cuota protegida de adulto mayor y es tratada con vocativo respetuoso (*"Don o Señora Elena"*).
* **Adulto Joven en Padrón (0 NSP):** `21.111.111-1` — Ignacio Andrés Morales Soto (24 años).
* **Paciente con Inasistencias (NSP = 2):** `16.666.666-6` — Matías Sebastián Rojas (38 años, abre advertencia educativa).
* **No Inscritos (Regla de Padrón / Derivación a SOME):** `21.222.222-2` y `6.666.666-6`. Si el RUT no existe en el establecimiento, la recepcionista IA le explica amablemente que debe acudir presencialmente a la ventanilla SOME con su carnet de identidad para inscribirse.
* **Regla de Cita Única:** Un paciente solo puede registrar 1 cita médica activa al día por especialidad. Si intenta agendar nuevamente, el sistema le recuerda su cita agendada.

### Profesionales y Boxes
* **Box 101 (Medicina General):** Dra. Valentina Silva Osorio / Dr. Carlos Muñoz Valenzuela.
* **Box 201 (Dental):** Dr. Roberto Cárdenas Pinto.
* **Box 301 (Matronería):** Dra. Camila Fuentes Rivas.

---

## 6. Comandos Útiles

```bash
# Ver logs de la aplicación en tiempo real
docker compose logs -f app

# Ver logs del túnel Cloudflare
docker compose logs -f tunnel

# Cargar el seed demográfico completo
docker compose exec app npm run db:seed

# Detener los contenedores
docker compose down
```

---

## 7. Estructura del Proyecto

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
