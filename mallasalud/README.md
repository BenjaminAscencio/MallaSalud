# MallaSalud — Módulo Web y Backend

Sistema omnicanal de gestión y asignación de horas médicas para Centros de Salud Pública Primaria (CESFAM).

---

## Requisito Único

* [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y en ejecución en tu computador (No requiere Node.js ni PostgreSQL instalado en la máquina anfitriona).

---

## Inicio Rápido con Docker

```bash
# 1. Crear variables de entorno
cp .env.example .env    # En Windows CMD: copy .env.example .env

# 2. Iniciar todos los contenedores en segundo plano
docker compose up -d --build

# 3. Inicializar Base de Datos y cargar seed de prueba
docker compose exec app npm run db:setup
```

> **Servicios activos automáticamente:**
> - `mallasalud_app`: Servidor Next.js en puerto `3000`.
> - `mallasalud_studio`: Prisma Studio activo de forma permanente en puerto `5555`.
> - `mallasalud_postgres`: PostgreSQL en puerto `5433` (interno 5432).

---

## Enlaces de Acceso (Sprint 1)

* **Portal Paciente (HU-001):** [http://localhost:3000](http://localhost:3000)
* **Consola de Agendas SOME (HU-005):** [http://localhost:3000/some/agendas](http://localhost:3000/some/agendas)
* **Ventanilla Presencial SOME (HU-006):** [http://localhost:3000/some/ventanilla](http://localhost:3000/some/ventanilla)
* **Prisma Studio (Explorador de BD):** [http://localhost:5555](http://localhost:5555)

---

## Pruebas y QA Automatizado

Para ejecutar la suite de pruebas End-to-End de las 3 Historias de Usuario:
```bash
docker compose exec app npm run test:api
```

Para verificar calidad de código y compilación:
```bash
docker compose exec app npm run lint
docker compose exec app npm run build
```

---

## Datos de Prueba Controlados (`seed`)

### Pacientes (Validación RUT y Prioridad)
* **Adulto Joven (0 NSP):** `21.111.111-1` — Ignacio Andrés Morales Soto (24 años).
* **Adulto Mayor (Cuota 60+):** `5.555.555-5` — Elena Rosa Valenzuela Castro (75 años).
* **Paciente con Inasistencias (NSP = 2):** `16.666.666-6` — Matías Sebastián Rojas (38 años, despliega modal educativo).
* **No Inscritos (Caso 404 / Alta Rápida):** `21.222.222-2` (Joven) y `6.666.666-6` (Adulto Mayor).
* **RUT Inválido:** `12.345.678-0` (Falla algoritmo Módulo 11).

### Profesionales y Boxes Clínicos
* **Box 101 (Medicina General):** Dr. Carlos Muñoz Valenzuela (`14258369-7`).
* **Box 102 (Medicina General):** Dra. Valentina Silva Osorio (`16789456-1`).
* **Box 201 (Dental):** Dr. Roberto Cárdenas Pinto (`15321654-K`).
* **Box 301 (Matronería):** Dra. Camila Fuentes Rivas (`17896321-4`).

---

## Reiniciar Datos a Cero

Para limpiar la base de datos y volver al estado inicial del seed:
```bash
docker compose exec app npm run db:seed
```

---

## Detener la Aplicación

```bash
docker compose down
```
