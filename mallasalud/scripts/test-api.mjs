async function runTests() {
  const baseURL = "http://localhost:3000";
  console.log("=== INICIANDO SUITE DE PRUEBAS END-TO-END MALLASALUD ===");

  async function test(name, fn) {
    try {
      process.stdout.write(`• ${name}... `);
      await fn();
      console.log("✅ OK");
    } catch (err) {
      console.log("❌ FALLÓ:", err.message);
      throw err;
    }
  }

  // 1. HU-001: Verificación de RUTs
  await test("HU-001: Verificar RUT 21111111-1 (Joven)", async () => {
    const res = await fetch(`${baseURL}/api/v1/pacientes/verificar-rut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "21111111-1" }),
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.paciente.es_adulto_mayor !== false) throw new Error("Debería ser no adulto mayor");
    if (data.paciente.tiene_inasistencias !== false) throw new Error("Debería tener 0 inasistencias");
  });

  await test("HU-001: Verificar RUT 5555555-5 (Adulto Mayor >= 60, 5.555.555-5)", async () => {
    const res = await fetch(`${baseURL}/api/v1/pacientes/verificar-rut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "5555555-5" }),
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.paciente.es_adulto_mayor !== true) throw new Error("Debería ser adulto mayor");
  });

  await test("HU-001: Verificar RUT 16666666-6 (Con inasistencias NSP = 2)", async () => {
    const res = await fetch(`${baseURL}/api/v1/pacientes/verificar-rut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "16666666-6" }),
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.paciente.tiene_inasistencias !== true || data.paciente.contador_inasistencias !== 2) {
      throw new Error("Debería marcar inasistencias");
    }
  });

  await test("HU-001: Caso 404 No Inscrito (RUT 21222222-2)", async () => {
    const res = await fetch(`${baseURL}/api/v1/pacientes/verificar-rut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "21222222-2" }),
    });
    if (res.status !== 404) throw new Error(`Esperaba 404, obtuve ${res.status}`);
    const data = await res.json();
    if (!data.acudir_some) throw new Error("Falta flag acudir_some");
  });

  await test("HU-001: Caso 400 RUT Inválido (RUT 12345678-0)", async () => {
    const res = await fetch(`${baseURL}/api/v1/pacientes/verificar-rut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "12345678-0" }),
    });
    if (res.status !== 400) throw new Error(`Esperaba 400, obtuve ${res.status}`);
  });

  // 2. HU-005: Listar Agendas
  let profesionalId = null;
  let boxId = null;
  await test("HU-005: Listar Agendas y Catálogos", async () => {
    const res = await fetch(`${baseURL}/api/v1/some/agendas`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.agendas || data.agendas.length === 0) throw new Error("No hay agendas");
    if (!data.agendas[0].bloques_horarios || data.agendas[0].bloques_horarios.length === 0) {
      throw new Error("Falta arreglo bloques_horarios en las agendas de respuesta");
    }
    const primerBloque = data.agendas[0].bloques_horarios[0];
    if (!primerBloque.id || !primerBloque.hora_inicio || !primerBloque.hora_fin || !primerBloque.estado_bloque) {
      throw new Error("Estructura de bloque incompleta en bloques_horarios");
    }
    if (!data.profesionales || data.profesionales.length === 0) throw new Error("No hay profesionales");
    if (!data.boxes || data.boxes.length === 0) throw new Error("No hay boxes");
    profesionalId = data.profesionales[0].id;
    boxId = data.boxes[0].id;
  });

  // 3. HU-006: Cupos Disponibles
  let bloqueDisponibleId = null;
  await test("HU-006: Listar Cupos Disponibles", async () => {
    const res = await fetch(`${baseURL}/api/v1/some/cupos-disponibles?especialidad=MEDICINA_GENERAL`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.cupos || data.cupos.length === 0) throw new Error("No hay cupos disponibles");
    bloqueDisponibleId = data.cupos[0].id;
  });

  // 4. HU-006: Agendamiento Presencial en Ventanilla SOME
  await test("HU-006: Agendar Cita en Ventanilla SOME", async () => {
    // Obtener paciente 1 (21111111-1)
    const pRes = await fetch(`${baseURL}/api/v1/some/pacientes/21111111-1`);
    const pData = await pRes.json();
    const pacienteId = pData.paciente.id;

    const res = await fetch(`${baseURL}/api/v1/some/citas/agendar-ventanilla`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paciente_id: pacienteId,
        bloque_id: bloqueDisponibleId,
      }),
    });
    if (res.status !== 201) {
      const err = await res.json();
      throw new Error(`Status ${res.status}: ${JSON.stringify(err)}`);
    }
    const data = await res.json();
    if (!data.comprobante.codigo_reserva) throw new Error("Falta codigo_reserva");
    if (!data.comprobante.notificacion_sms) throw new Error("Falta notificacion_sms");
  });

  // 5. HU-006: Rechazar Cita Duplicada en Misma Especialidad y Fecha
  await test("HU-006: Rechazar Cita Duplicada en Misma Especialidad y Fecha", async () => {
    const pRes = await fetch(`${baseURL}/api/v1/some/pacientes/21111111-1`);
    const pData = await pRes.json();
    const pacienteId = pData.paciente.id;

    // Buscar otro cupo de medicina general
    const cRes = await fetch(`${baseURL}/api/v1/some/cupos-disponibles?especialidad=MEDICINA_GENERAL`);
    const cData = await cRes.json();
    const otroBloqueId = cData.cupos[0].id;

    const res = await fetch(`${baseURL}/api/v1/some/citas/agendar-ventanilla`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paciente_id: pacienteId,
        bloque_id: otroBloqueId,
      }),
    });
    if (res.status !== 409) {
      throw new Error(`Esperaba 409 por duplicidad, obtuve ${res.status}`);
    }
  });

  // 6. HU-005: Generar y Pausar Agenda de Prueba dedicada (sin alterar agendas del seed)
  await test("HU-005: Generar y Pausar Agenda dedicada", async () => {
    // Generar agenda para fecha futura (dentro de 5 días)
    const fechaFutura = new Date();
    fechaFutura.setDate(fechaFutura.getDate() + 5);
    const fechaStr = fechaFutura.toISOString().split("T")[0];

    const genRes = await fetch(`${baseURL}/api/v1/some/agendas/generar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profesional_id: profesionalId,
        box_id: boxId,
        especialidad: "MEDICINA_GENERAL",
        fecha: fechaStr,
        hora_inicio: "09:00",
        hora_fin: "12:00",
        duracion_bloque_min: 20,
        porcentaje_cuota_mayor: 30,
      }),
    });

    if (genRes.status !== 201) {
      const err = await genRes.json();
      throw new Error(`Error al generar agenda de prueba: ${JSON.stringify(err)}`);
    }

    const genData = await genRes.json();
    const tempAgendaId = genData.agenda.id;

    const res = await fetch(`${baseURL}/api/v1/some/agendas/${tempAgendaId}/pausar`, {
      method: "PUT",
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (data.activa !== false) throw new Error("La agenda debería estar inactiva");
  });

  console.log("=== TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO ===");
}

runTests().catch((e) => {
  console.error("Fallo general:", e);
  process.exit(1);
});
