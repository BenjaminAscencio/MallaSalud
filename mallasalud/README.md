# 🏥 MallaSalud — Módulo Web

Sistema de gestión y asignación de horas médicas para Centros de Salud Pública Primaria.

---

## 💻 Requisito

* **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** instalado y en ejecución.

---

## 🚀 Inicio Rápido con Docker

```bash
# 1. Crear variables de entorno
cp .env.example .env    # En Windows CMD: copy .env.example .env

# 2. Iniciar contenedores
docker compose up --build

# 3. Inicializar Base de Datos y datos de prueba en un solo comando (en otra terminal)
docker compose exec app npm run db:setup

# 4. (Opcional) Abrir interfaz visual de la base de datos
docker compose exec app npm run db:studio
```

---

## 🌐 Enlaces

- **App Web:** [http://localhost:3000](http://localhost:3000)
- **Prisma Studio (BD):** [http://localhost:5555](http://localhost:5555)

---

## 👥 Cuentas y Datos de Prueba (`seed`)

- **Administrador SOME:** `15432890-K` (Carolina Soto)
- **Médico General:** `16789452-3` (Matías Valenzuela)
- **Urgencia Dental:** `14238910-5` (Valeria Rojas)
- **Matronería:** `17890123-1` (Fernanda Morales)
- **40 Pacientes chilenos:** 15 adultos mayores (+60 años para cupos prioritarios) y 25 adultos generales.
- **Cupos y Citas:**
  - 🟢 **Disponibles:** Cupos libres para que cualquier usuario pueda tomarlos.
  - 🟡 **En proceso (Inactivas):** Cupos retenidos temporalmente con `bloqueadoHasta` y `bloqueadoPorRut` simulando pacientes en el proceso de reserva.
  - 🔴 **Tomadas:** Citas confirmadas en Box (`RESERVADA` y `ATENDIDA`) con funcionario, paciente, canal de origen (Web/Teléfono/Ventanilla) y observaciones clínicas.

---

## 🛑 Detener

```bash
docker compose down
```
