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

* **Gestión Visual y Flujo (Kanban):** Seguimiento del ciclo de desarrollo mediante un tablero, dividiendo las tareas en Backlog, Por Hacer, En Progreso, Revisión y Terminado, con límites de trabajo en curso para evitar cuellos de botella.
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

### 3. Levantar los Servicios con Docker
```bash
docker compose up -d --build
```
> *Este comando levantará automáticamente los 3 servicios del proyecto:*
> 1. **`mallasalud_app`**: Servidor Next.js en el puerto `3000`.
> 2. **`mallasalud_studio`**: Prisma Studio (explorador de BD) activo de forma permanente en el puerto `5555`.
> 3. **`mallasalud_postgres`**: Base de datos relacional PostgreSQL 16 en el puerto `5433` (interno 5432).

### 4. Inicializar Base de Datos y Cargar Datos de Demostración (`seed`)
Ejecute en la terminal:
```bash
docker compose exec app npm run db:setup
```
*(Aplica las migraciones con `prisma db push` y puebla la base de datos con `prisma db seed`)*.

### 5. (Opcional) Ejecutar Suite de Pruebas Automatizadas E2E
Para comprobar que todas las historias de usuario y reglas de negocio funcionan al 100%:
```bash
docker compose exec app npm run test:api
```

---

## Enlaces de Acceso a las Interfaces (Sprint 1)

| Módulo / Historia | Enlace | Descripción y Alcance |
| :--- | :--- | :--- |
| **HU-001: Portal Paciente** | [http://localhost:3000](http://localhost:3000) | Identificación por RUT (Módulo 11), detección de padrón, aviso educativo NSP y cupos por especialidad. |
| **HU-005: Calendario SOME** | [http://localhost:3000/some/agendas](http://localhost:3000/some/agendas) | Matriz diaria por boxes, horario semanal, colación 13:00-14:00, cuota 60+ y bloqueo por ausencias. |
| **HU-006: Ventanilla SOME** | [http://localhost:3000/some/ventanilla](http://localhost:3000/some/ventanilla) | Mesón presencial, Alta Rápida de pacientes, cupos liberados por cancelación y emisión de ticket térmico. |
| **Base de Datos (Prisma Studio)** | [http://localhost:5555](http://localhost:5555) | Explorador visual permanente de tablas, relaciones y citas registradas. |

---

## Datos de Demostración Controlados (`seed`)

El sistema incluye casos de prueba chilenos prediseñados para validar cada regla de negocio:

### 1. Pacientes de Prueba (HU-001 y HU-006)
* **Adulto Joven (0 inasistencias):** `21.111.111-1` — Ignacio Andrés Morales Soto (24 años). Acceso regular a cupos generales.
* **Adulto Mayor ($\ge 60$ años):** `5.555.555-5` — Elena Rosa Valenzuela Castro (75 años, serie 5M). Insignia 60+ y acceso a cupos protegidos por ley.
* **Paciente con Inasistencias Previas (NSP = 2):** `16.666.666-6` — Matías Sebastián Rojas (38 años). Despliega modal educativo de compromiso asistencial en 1 clic sin bloqueo punitivo.
* **Paciente No Inscrito en Padrón (Caso 404):** `21.222.222-2` (Joven) y `6.666.666-6` (Adulto Mayor). Permite probar el Alta Rápida en Ventanilla SOME.
* **RUT Inválido (Error de Formato Módulo 11):** `12.345.678-0`.

### 2. Profesionales y Boxes Clínicos (HU-005)
* **Box 101 - Medicina General:** Dr. Carlos Muñoz Valenzuela (`14258369-7`).
* **Box 102 - Medicina General:** Dra. Valentina Silva Osorio (`16789456-1`).
* **Box 201 - Dental:** Dr. Roberto Cárdenas Pinto (`15321654-K`).
* **Box 301 - Matronería:** Dra. Camila Fuentes Rivas (`17896321-4`).

---

## Comandos de Mantenimiento

* **Reiniciar datos de prueba limpios:**
  ```bash
  docker compose exec app npm run db:seed
  ```
* **Verificar calidad de código:**
  ```bash
  docker compose exec app npm run lint
  docker compose exec app npm run build
  ```
* **Detener los contenedores:**
  ```bash
  docker compose down
  ```
