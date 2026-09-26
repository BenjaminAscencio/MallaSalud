# MALLASALUD

> **Sistema integral y omnicanal para la gestión, distribución y reserva de horas médicas en Centros de Salud Pública Primaria (CESFAM, SAPU y consultorios).**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

---

## Descripción del Proyecto

**MALLASALUD** nace como respuesta a la problemática en la salud pública chilena y la brecha digital que afecta a los adultos mayores con respecto a la reserva de horas médicas.

El sistema proporciona una plataforma omnicanal que sincroniza en tiempo real las agendas de especialidades médicas clave (Medicina General, Urgencia Dental y Matronería), garantizando cuotas prioritarias para adultos mayores y permitiendo la reserva por ventanilla presencial, pagina web y por via telefonica.

---

## Integrantes del Equipo y Roles

| Integrante | Rol Principal | Especialización y Responsabilidades |
| :--- | :--- | :--- |
| **Benjamín Ascencio** | **Backend Developer & Datos** | • Modelado relacional normalizado e integridad referencial.<br>• Persistencia con PostgreSQL y Prisma ORM.<br>• Lógica transaccional y concurrencia.<br>• Documentación técnica. |
| **Pablo Carrasco** | **Frontend Developer & Interfaces** | • Arquitectura de componentes e interfaz reactiva con Next.js y React.<br>• Sistema de diseño inclusivo y responsivo con Tailwind CSS.<br>• Accesibilidad y usabilidad orientada a adultos mayores.<br>• Desarrollo de interfaces: Portal Paciente, Consola SOME y Panel Box Médico. |

* **Carrera:** Ingeniería en Informática — **Institución:** Duoc UC Alameda  
* **Asignatura:** Proyecto Capstone (APT122) — **Docente Guía:** Felipe Krauss  

---

## Tecnologías Utilizadas

### Frontend
* **[Next.js (App Router)](https://nextjs.org/):** Framework React para renderizado del lado del servidor (SSR), generación estática y Server Actions.
* **[React](https://react.dev/):** Biblioteca para construcción de componentes modulares y reactivos.
* **[Tailwind CSS](https://tailwindcss.com/):** Framework utilitario para diseño responsivo, accesible y de alta coherencia visual.
* **[Lucide React](https://lucide.dev/):** Iconografía moderna y accesible.

### Backend y Lógica de Negocio
* **[Node.js](https://nodejs.org/) & [TypeScript](https://www.typescriptlang.org/):** Entorno de ejecución con tipado estricto para lógica de dominio y Server Actions/API Routes.
* **Algoritmo Módulo 11:** Validación estricta de RUT chileno en backend y frontend.
* **Gestión de Concurrencia Temporal:** Mecanismo transaccional para retención temporal de cupos con expiración automática de 2 minutos para evitar colisiones entre canales.

### Base de Datos y Persistencia
* **[PostgreSQL 16](https://www.postgresql.org/):** Motor de base de datos relacional para garantizar aislamiento transaccional (ACID).
* **[Prisma ORM](https://www.prisma.io/):** Modelado de datos declarativo, migraciones estructuradas y consultas seguras tipadas.

### Infraestructura, DevOps y Herramientas
* **[Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/):** Contenedorización de aplicación y base de datos para despliegue y desarrollo homogéneo.
* **[Faker.js](https://fakerjs.dev/):** Generación de datos sintéticos realistas con población chilena de prueba.
* **Git & GitHub Projects:** Control de versiones distribuido y gestión de tableros ágiles.

---

## Metodología de Trabajo

El equipo adoptó un marco de trabajo ágil basado en **Scrumban**, combinando la estructura por ciclos de **Scrum** con la flexibilidad y control de flujo continuo de **Kanban**:

* **Gestión Visual y Flujo (Kanban):** Seguimiento del ciclo de desarrollo mediante un tablero en GitHub Projects, dividiendo las tareas en Backlog, Por Hacer, En Progreso, Revisión y Terminado, con límites de trabajo en curso (WIP) para evitar cuellos de botella.
* **Planificación y Estimación:** Uso de sesiones de *Poker Planning* bajo la escala Fibonacci para dimensionar la complejidad e incertidumbre de cada funcionalidad del backlog.
* **Fases del Proyecto (18 Semanas):**
  * **Fase 1 (Definición):** Levantamiento de requisitos, diseño de la arquitectura del sistema, modelado de la base de datos y validación de reglas de negocio.
  * **Fase 2 (Desarrollo):** Construcción modular de las interfaces (portal de pacientes, SOME y box médico), lógica de backend, control de concurrencia e integración del canal de voz.
  * **Fase 3 (Pruebas y Cierre):** Pruebas de estrés y concurrencia ante alta demanda de reservas, despliegue continuo (CI/CD), elaboración de manuales y entrega final.

---

## Arquitectura de la Solución

MALLASALUD está estructurado bajo una **arquitectura omnicanal modular desacoplada**, diseñada para que múltiples canales de atención operen de forma sincronizada sobre un núcleo transaccional unificado:

* **1. Capa de Canales (Presentación y Acceso):**
  * **Portal Web Pacientes:** Permite la búsqueda y reserva directa de citas médicas validando el RUT y aplicando cupos prioritarios.
  * **Consola SOME (Ventanilla):** Interfaz para personal administrativo encargada de la apertura de turnos y gestión de cuotas protegidas.
  * **Panel Box Clínico:** Vista para el profesional de salud para registrar asistencia médica y liberar de inmediato cupos no utilizados.
  * **Canal Telefónico (Asistente de Voz):** Servicio automatizado pensado en adultos mayores o personas sin acceso a internet, que interactúa vía webhook con la plataforma central.

* **2. Capa de Aplicación y Lógica de Negocio (Next.js):**
  * Centraliza las reglas del sistema mediante Server Actions y API Routes en TypeScript.
  * Valida la identidad y formato de RUT mediante el algoritmo chileno Módulo 11.
  * Incorpora un motor de concurrencia que aplica un **bloqueo temporal de 2 minutos** sobre el cupo seleccionado mientras el paciente confirma, evitando que dos personas tomen la misma hora desde canales distintos.

* **3. Capa de Datos y Persistencia (PostgreSQL y Prisma ORM):**
  * Modelo de datos relacional normalizado con integridad referencial.
  * Manejo de transacciones ACID para asegurar consistencia absoluta durante la asignación simultánea de citas médicas.

---

## Requisito Único en el PC

Para ejecutar el proyecto solo se necesita tener instalado y abierto:
* **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** *(Compatible con Windows, Mac y Linux)*.

> *No requiere instalar Node.js ni PostgreSQL directamente en la máquina anfitriona.*

---

## Paso a Paso para Ejecutar

### 1. Entrar a la carpeta del proyecto
Abra una terminal en la raíz del repositorio y ejecute:
```bash
cd mallasalud
```

### 2. Crear archivo de entorno `.env`
* En **Windows (PowerShell)**: `Copy-Item .env.example .env`
* En **Windows (CMD)**: `copy .env.example .env`
* En **Mac / Linux**: `cp .env.example .env`

*(O simplemente duplique `.env.example` y renómbrelo como `.env`)*.

### 3. Levantar la aplicación con Docker
```bash
docker compose up --build
```
> *Espere 1 a 2 minutos la primera vez mientras se descargan las imágenes y se compila el proyecto.*

### 4. Crear tablas y cargar datos de prueba (`seed`)
En **otra terminal** (dentro de la carpeta `mallasalud`):
```bash
docker compose exec app npm run db:setup
```
*(O manualmente: `docker compose exec app npx prisma db push` y luego `docker compose exec app npm run db:seed`)*.

---

## Enlaces de Acceso

| Servicio | Enlace | Descripción |
| :--- | :--- | :--- |
| **Aplicación Web** | [http://localhost:3000](http://localhost:3000) | Sistema de reserva y gestión de citas |
| **Base de Datos (Prisma Studio)** | [http://localhost:5555](http://localhost:5555) | Explorador visual de tablas y registros |

> *Para abrir el explorador de Base de Datos en el navegador, ejecute:*
> ```bash
> docker compose exec app npm run db:studio
> ```

---

## Datos de Demostración (`seed`)

El sistema incluye datos chilenos precargados y listos para evaluación:

* **Administrativo SOME:** `15432890-K` (Carolina Soto)
* **Médico General:** `16789452-3` (Matías Valenzuela)
* **Urgencia Dental:** `14238910-5` (Valeria Rojas)
* **Matronería:** `17890123-1` (Fernanda Morales)
* **Pacientes:** 15 adultos mayores (cupos prioritarios) y 25 adultos generales con RUTs chilenos válidos.
* **Cupos y Citas (Hoy y Mañana):**
  - **Disponibles:** Horas libres listas para ser reservadas.
  - **En proceso de tomarse (Inactivas / Retenidas temporalmente):** Cupos con `bloqueadoHasta` y `bloqueadoPorRut` que simulan pacientes en pleno flujo de confirmación.
  - **Tomadas:** Citas confirmadas en Box (`RESERVADA` y `ATENDIDA`) asociadas al profesional de salud, paciente y observaciones clínicas.

---

## Detener la aplicación

Presione `Ctrl + C` en la terminal o ejecute:
```bash
docker compose down
```
