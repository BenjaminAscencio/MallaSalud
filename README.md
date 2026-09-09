# 🏥 MallaSalud

Sistema de gestión y asignación de horas médicas para Centros de Salud Pública Primaria (CESFAM).

---

## 💻 Requisito Único en el PC

Para ejecutar el proyecto solo se necesita tener instalado y abierto:
* **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** *(Compatible con Windows, Mac y Linux)*.

> ℹ️ *No requiere instalar Node.js ni PostgreSQL en la máquina.*

---

## 🚀 Paso a Paso para Ejecutar

### 1. Entrar a la carpeta del proyecto
Abra una terminal en la raíz y ejecute:
```bash
cd mallasalud
```

### 2. Crear archivo de entorno `.env`
- En **Windows (PowerShell)**: `Copy-Item .env.example .env`
- En **Windows (CMD)**: `copy .env.example .env`
- En **Mac / Linux**: `cp .env.example .env`

*(O simplemente duplique `.env.example` y renómbrelo como `.env`)*.

### 3. Levantar la aplicación
```bash
docker compose up --build
```
> *Espere 1 a 2 minutos la primera vez mientras compila.*

### 4. Crear tablas y cargar datos de prueba
En **otra terminal** (dentro de `mallasalud`):
```bash
docker compose exec app npx prisma db push
docker compose exec app npm run db:seed
```

---

## 🌐 Enlaces de Acceso

| Servicio | Enlace | Descripción |
| :--- | :--- | :--- |
| **Aplicación Web** | [http://localhost:3000](http://localhost:3000) | Sistema de reserva y gestión de citas |
| **Base de Datos (Studio)** | [http://localhost:5555](http://localhost:5555) | Explorador visual de tablas y registros |

> *Para ver la Base de Datos en el navegador, ejecute:*
> ```bash
> docker compose exec app npm run db:studio
> ```
> *(O si tiene Node.js en su PC: `npm run db:studio`)*.

---

## 👥 Datos de Demostración (`seed`)

El sistema incluye datos chilenos precargados:

* **Administrativo SOME:** `15432890-K` (Carolina Soto)
* **Médico General:** `16789452-3` (Matías Valenzuela)
* **Urgencia Dental:** `14238910-5` (Valeria Rojas)
* **Matronería:** `17890123-1` (Fernanda Morales)
* **Pacientes:** 15 adultos mayores (cupos prioritarios) y 25 adultos generales.
* **Cupos:** Agendas creadas para mañana de 08:00 a 16:00 hrs.

---

## 🛑 Detener la aplicación

Presione `Ctrl + C` en la terminal o ejecute:
```bash
docker compose down
```
