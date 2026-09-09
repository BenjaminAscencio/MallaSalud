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

# 3. Inicializar Base de Datos y datos de prueba (en otra terminal)
docker compose exec app npx prisma db push
docker compose exec app npm run db:seed

# 4. (Opcional) Abrir interfaz visual de la base de datos
docker compose exec app npm run db:studio
```

---

## 🌐 Enlaces

- **App Web:** [http://localhost:3000](http://localhost:3000)
- **Prisma Studio (BD):** [http://localhost:5555](http://localhost:5555)

---

## 👥 Cuentas de Prueba

- **Administrador SOME:** `15432890-K`
- **Médico General:** `16789452-3`
- **Urgencia Dental:** `14238910-5`
- **Matronería:** `17890123-1`
- **40 Pacientes** y cupos asignados para el día siguiente.

---

## 🛑 Detener

```bash
docker compose down
```
