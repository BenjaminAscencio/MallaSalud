# MallaSalud — Módulo Web, Backend y Canal Telefónico IA

Sistema omnicanal de gestión y asignación de horas médicas para Centros de Salud Pública Primaria (CESFAM). Integra reserva web (`WEB`), mesón presencial SOME (`VENTANILLA_SOME`) y canal telefónico autónomo con inteligencia artificial (**`VOZ_IVR`**) respaldado por Twilio Voice y PostgreSQL.

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

* **Portal Pacientes (HU-001/002):** [http://localhost:3000](http://localhost:3000) *(reservas web persistidas con `canal_origen = WEB`, `hora_atencion` y anulación oportuna con `CANCELADA_OPORTUNA`)*
* **Central Telefónica IA (Canal VOZ_IVR):** [http://localhost:3000/ivr](http://localhost:3000/ivr) *(llamadas reales Twilio, pruebas rápidas por regla, botón `Nueva Llamada / Limpiar Flujo` y monitor PostgreSQL)*
* **Consola de Agendas SOME (HU-005):** [http://localhost:3000/some/agendas](http://localhost:3000/some/agendas)
* **Ventanilla Presencial SOME (HU-006):** [http://localhost:3000/some/ventanilla](http://localhost:3000/some/ventanilla) *(reservas presenciales con `canal_origen = VENTANILLA_SOME`)*
* **Prisma Studio (Explorador de Base de Datos):** [http://localhost:5555](http://localhost:5555)

---

## 3. Demostración en Vivo: Agente Telefónico IA (VOZ_IVR)

El módulo telefónico permite a los pacientes llamar o recibir llamadas para agendar citas directamente sobre la base de datos PostgreSQL:

1. **Ingresa al panel:** Navega a [http://localhost:3000/ivr](http://localhost:3000/ivr) (o a la URL pública del túnel).
2. **Revisa la configuración:**
   - La URL del webhook se autodetecta (`https://xxxx.trycloudflare.com`).
   - El número telefónico destino está preconfigurado (`+56937772647`).
3. **Disparar llamada o probar reglas:**
   - Haz clic en **"Iniciar Llamada Telefónica (VOZ_IVR)"** (sonará tu teléfono vía Twilio Voice), o utiliza el panel **"Pruebas Rápidas de Reglas de Negocio"** para ejecutar cada escenario paso a paso.
4. **Al contestar (llamada real):**
   - Al tratarse de una cuenta Trial de Twilio, escucharás un mensaje en inglés:  
     *“You have a trial account. You can press any key to execute your code.”*
   - **Presiona la tecla `1` en el teclado de tu teléfono** para que la central automatizada comience a hablarte de inmediato.
5. **Flujos de Conversación Validados en Vivo (Reglas de Negocio):**

   * **Caso 1: Paciente No Inscrito en Padrón (Derivación a Ventanilla SOME)**
     - **Paciente:** *"Hola quiero pedir hora para las diez de la mañana, mi RUT es 21.222.222-2"*.
     - **Central MallaSalud:** Indica amablemente que el RUT `21222222-2` no se encuentra inscrito en el centro de salud y debe acudir presencialmente a la ventanilla SOME del CESFAM con su cédula de identidad para realizar su inscripción.

   * **Caso 2: Hora Ocupada — Recomendación Antes y Después + Confirmación (`21.111.111-1`)**
     - **Paciente:** *"Hola, quiero hora para medicina a las 11 de la mañana, mi RUT es 21.111.111-1"*.
     - **Central MallaSalud:** *"Hola Ignacio Andrés, la hora de las 11:00 en Medicina General ya está ocupada. Puedo ofrecerle una hora antes a las 10:30, o después a las 11:30 con Dr(a). Valentina Silva Osorio. ¿Cuál prefiere agendar?"*.
     - **Paciente:** *"Prefiero la de después, a las 11:30"*.
     - **Central MallaSalud:** Confirma la cita al instante en PostgreSQL con código `MS-XXXXXX` y etiqueta `VOZ_IVR`.

   * **Caso 3: Regla de Cita Duplicada y Reagendamiento (`21.111.111-1` / `5.555.555-5`)**
     - Inicia una llamada limpia con **"Nueva Llamada / Limpiar Flujo"** (sin borrar las citas en BD) y pide otra hora el mismo día (ej. *"Hola quiero pedir otra hora a las 12:00, mi RUT es 21.111.111-1"*).
     - **Central MallaSalud:** Informa la cita activa actual (`11:30`) y la norma de una cita por especialidad al día, preguntando si desea **anular la hora anterior y reagendar para las `12:00`**.
     - **Paciente:** *"Sí, por favor anula la anterior y reagenda a las 12:00"*.
     - **Resultado en BD:** Marca la cita previa como `CANCELADA_OPORTUNA`, libera el bloque de las `11:30` a `DISPONIBLE`, y registra la nueva cita de las `12:00` como `RESERVADO` (`canal_origen = VOZ_IVR`).

   * **Caso 4: Adulto Mayor 75a — Cuota Protegida 60+ (`5.555.555-5`)**
     - Atiende con vocativo respetuoso (*"Don o Señora Elena Rosa"*), habilita acceso prioritario a cuotas protegidas 60+ y negocia bloques disponibles ante horas ocupadas.

6. **Verificación en Pantalla:**
   - Verás la transcripción paso a paso en **Flujo de Atención Telefónica en Vivo**.
   - En el **Monitor de Base de Datos PostgreSQL**, los bloques cambian en tiempo real entre `DISPONIBLE` y `RESERVADO`, mostrando paciente, código `MS-XXXXXX` y la etiqueta **`VOZ_IVR`**.
7. **Limpiar flujo o reiniciar agenda:**
   - Usa **"Nueva Llamada / Limpiar Flujo"** para limpiar únicamente la conversación en pantalla conservando la base de datos intacta, o **"Reiniciar Horas en BD"** para restaurar los bloques y volver al estado inicial en 1 segundo.

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
   - `GEMINI_API_KEYS` (o `GEMINI_API_KEY`): Claves de API de Gemini separadas por coma.
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
* **Paciente con Inasistencias (NSP = 2):** `16.666.666-6` — Matías Sebastián Rojas Herrera (38 años, abre advertencia educativa y permite probar flujo web completo con `canal_origen = WEB` y anulación oportuna).
* **No Inscritos (Regla de Padrón / Derivación a SOME):** `21.222.222-2` y `6.666.666-6`. Si el RUT no existe en el establecimiento, la recepcionista IA le explica amablemente que debe acudir presencialmente a la ventanilla SOME con su carnet de identidad para inscribirse.
* **Regla de Cita Única con Reagendamiento:** Un paciente puede registrar 1 cita médica activa al día por especialidad. Si intenta agendar nuevamente teniendo otra hora ese día, el canal telefónico informa su cita vigente y ofrece **anular la cita anterior (`CANCELADA_OPORTUNA`, liberando el cupo) y reagendar en el nuevo horario disponible**.

### Profesionales y Boxes
* **Box 101 / Box 102 (Medicina General):** Dr. Carlos Muñoz Valenzuela / Dra. Valentina Silva Osorio.
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
