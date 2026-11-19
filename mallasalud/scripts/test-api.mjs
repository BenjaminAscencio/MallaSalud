async function runTests() {
  const baseURL = process.env.TEST_BASE_URL || "http://localhost:3000";
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

  async function loginAs(identificador, password) {
    const res = await fetch(`${baseURL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identificador, password }),
    });
    if (res.status !== 200) {
      const txt = await res.text();
      throw new Error(`Login falló (${res.status}): ${txt}`);
    }
    const setCookie = res.headers.get("set-cookie") || "";
    const cookiePair = setCookie.split(";")[0];
    if (!cookiePair) throw new Error("No se recibió cookie HttpOnly en login");
    return cookiePair;
  }

  function esGsm7Valido(texto) {
    return typeof texto === "string" && texto.length > 0 && texto.length <= 160 && /^[\x20-\x7E]+$/.test(texto);
  }

  // ------------------------------------------------------------------
  // 0. RBAC Y SEGURIDAD DE RUTAS
  // ------------------------------------------------------------------
  let someCookie = "";
  let carlosCookie = "";
  let valentinaCookie = "";

  await test("RBAC: Rechazar acceso anónimo (401) a SOME, Box e IVR", async () => {
    const [r1, r2, r3] = await Promise.all([
      fetch(`${baseURL}/api/v1/some/agendas`),
      fetch(`${baseURL}/api/v1/box/citas-hoy`),
      fetch(`${baseURL}/api/ivr/status`),
    ]);
    if (r1.status !== 401 || r2.status !== 401 || r3.status !== 401) {
      throw new Error(`Esperaba 401/401/401, obtuve ${r1.status}/${r2.status}/${r3.status}`);
    }
  });

  await test("RBAC: Iniciar sesión SOME y Profesionales y verificar cruce de roles (403)", async () => {
    someCookie = await loginAs("some@cesfam.cl", "Some2026!");
    carlosCookie = await loginAs("carlos.munoz@cesfam.cl", "Doctor2026!");
    valentinaCookie = await loginAs("valentina.silva@cesfam.cl", "Doctor2026!");

    const docToSome = await fetch(`${baseURL}/api/v1/some/agendas`, {
      headers: { Cookie: carlosCookie },
    });
    const someToBox = await fetch(`${baseURL}/api/v1/box/citas-hoy`, {
      headers: { Cookie: someCookie },
    });
    if (docToSome.status !== 403 || someToBox.status !== 403) {
      throw new Error(`Esperaba 403 cruzado, obtuve ${docToSome.status}/${someToBox.status}`);
    }

    // Verificar protección de páginas en proxy.ts
    const anonSome = await fetch(`${baseURL}/some/agendas`, { redirect: "manual" });
    const anonLoc = anonSome.headers.get("location") || "";
    if (anonSome.status !== 307 || !anonLoc.includes("/login")) {
      throw new Error(`Esperaba 307 -> /login sin sesión, obtuve ${anonSome.status} (${anonLoc})`);
    }

    const somePage = await fetch(`${baseURL}/some/agendas`, {
      headers: { Cookie: someCookie },
      redirect: "manual",
    });
    if (somePage.status !== 200) {
      throw new Error(`SOME debería abrir /some/agendas (200), obtuve ${somePage.status}`);
    }

    const docPageSome = await fetch(`${baseURL}/some/agendas`, {
      headers: { Cookie: carlosCookie },
      redirect: "manual",
    });
    const docSomeLoc = docPageSome.headers.get("location") || "";
    if (docPageSome.status !== 307 || !docSomeLoc.includes("/doctor")) {
      throw new Error(`Doctor en /some/agendas debería redirigir a /doctor (307), obtuve ${docPageSome.status} (${docSomeLoc})`);
    }

    const docPage = await fetch(`${baseURL}/doctor`, {
      headers: { Cookie: carlosCookie },
      redirect: "manual",
    });
    if (docPage.status !== 200) {
      throw new Error(`Doctor debería abrir /doctor (200), obtuve ${docPage.status}`);
    }

    const somePageDoc = await fetch(`${baseURL}/doctor`, {
      headers: { Cookie: someCookie },
      redirect: "manual",
    });
    const someDocLoc = somePageDoc.headers.get("location") || "";
    if (somePageDoc.status !== 307 || !someDocLoc.includes("/some/agendas")) {
      throw new Error(`SOME en /doctor debería redirigir a /some/agendas (307), obtuve ${somePageDoc.status} (${someDocLoc})`);
    }
  });

  // ------------------------------------------------------------------
  // 1. HU-001: Verificación de RUTs (Portal Público)
  // ------------------------------------------------------------------
  let pacienteJovenId = "";
  let pacienteNspId = "";

  await test("HU-001: Verificar RUTs válidos (Joven, Adulto Mayor 60+, NSP=2)", async () => {
    const rJoven = await fetch(`${baseURL}/api/v1/pacientes/verificar-rut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "21758467-1" }),
    });
    const dJoven = await rJoven.json();
    if (rJoven.status !== 200 || dJoven.paciente.es_adulto_mayor !== false) {
      throw new Error("Fallo RUT joven");
    }
    pacienteJovenId = dJoven.paciente.id;

    const rMayor = await fetch(`${baseURL}/api/v1/pacientes/verificar-rut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "5842319-K" }),
    });
    const dMayor = await rMayor.json();
    if (rMayor.status !== 200 || dMayor.paciente.es_adulto_mayor !== true) {
      throw new Error("Fallo Adulto Mayor");
    }

    const rNsp = await fetch(`${baseURL}/api/v1/pacientes/verificar-rut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "16842915-0" }),
    });
    const dNsp = await rNsp.json();
    if (rNsp.status !== 200 || !dNsp.paciente.tiene_inasistencias) {
      throw new Error("Fallo detección NSP");
    }
    pacienteNspId = dNsp.paciente.id;
  });

  await test("HU-001: Caso 404 No Inscrito (21483926-1) y 400 Inválido (12345678-0)", async () => {
    const r404 = await fetch(`${baseURL}/api/v1/pacientes/verificar-rut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "21483926-1" }),
    });
    const d404 = await r404.json();
    if (r404.status !== 404 || !d404.acudir_some) {
      throw new Error(`Esperaba 404 con acudir_some, obtuve ${r404.status}`);
    }

    const r400 = await fetch(`${baseURL}/api/v1/pacientes/verificar-rut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rut: "12345678-0" }),
    });
    if (r400.status !== 400) throw new Error(`Esperaba 400, obtuve ${r400.status}`);
  });

  // ------------------------------------------------------------------
  // 2. HU-002 + HU-008: Concurrencia TTL 120s, Canal WEB, GSM-7, Cancelación y Reciclaje
  // ------------------------------------------------------------------
  const mañanaDate = new Date();
  mañanaDate.setDate(mañanaDate.getDate() + 1);
  const fechaManana = mañanaDate.toISOString().split("T")[0];

  let bloqueTestConcurrenciaId = "";
  let bloqueDisponibleManana2Id = "";
  let citaWebId = "";

  await test("HU-002: Concurrencia simultánea real en bloqueo-temporal TTL 120s (1 gana 200, 1 falla 409)", async () => {
    const res = await fetch(
      `${baseURL}/api/v1/citas/disponibles?especialidad=MEDICINA_GENERAL&es_adulto_mayor=false&fecha=${fechaManana}`
    );
    if (res.status !== 200) throw new Error(`Status disponibles ${res.status}`);
    const data = await res.json();
    if (!data.cupos || data.cupos.length < 2) throw new Error("Faltan cupos mañana");

    bloqueTestConcurrenciaId = data.cupos[0].id;
    bloqueDisponibleManana2Id = data.cupos[1].id;

    const [lockA, lockB] = await Promise.all([
      fetch(`${baseURL}/api/v1/citas/bloqueo-temporal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bloque_id: bloqueTestConcurrenciaId, rut: "21758467-1" }),
      }),
      fetch(`${baseURL}/api/v1/citas/bloqueo-temporal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bloque_id: bloqueTestConcurrenciaId, rut: "16842915-0" }),
      }),
    ]);

    const statuses = [lockA.status, lockB.status].sort((a, b) => a - b);
    if (statuses[0] !== 200 || statuses[1] !== 409) {
      throw new Error(`Esperaba [200, 409] en carrera, obtuve ${JSON.stringify(statuses)}`);
    }

    const ganadorId = lockA.status === 200 ? pacienteJovenId : pacienteNspId;

    const confRes = await fetch(`${baseURL}/api/v1/citas/confirmar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paciente_id: ganadorId,
        bloque_id: bloqueTestConcurrenciaId,
      }),
    });
    if (confRes.status !== 201) {
      throw new Error(`Confirmar web falló: ${confRes.status} ${await confRes.text()}`);
    }
    const confData = await confRes.json();
    citaWebId = confData.comprobante.cita_id;
    if (confData.comprobante.canal_origen !== "WEB") {
      throw new Error(`Esperaba canal_origen=WEB, obtuve ${confData.comprobante.canal_origen}`);
    }
    if (!esGsm7Valido(confData.comprobante.notificacion_sms.mensaje)) {
      throw new Error(`SMS no cumple GSM-7 <= 160: ${confData.comprobante.notificacion_sms.mensaje}`);
    }
  });

  await test("HU-008: Cancelación oportuna (>= 30m) con SMS GSM-7 + Reciclaje sin borrar historial", async () => {
    const cancelRes = await fetch(`${baseURL}/api/v1/citas/${citaWebId}/cancelar`, {
      method: "POST",
    });
    if (cancelRes.status !== 200) {
      throw new Error(`Cancelación >=30m falló (${cancelRes.status}): ${await cancelRes.text()}`);
    }
    const cancelData = await cancelRes.json();
    if (cancelData.cita.estado_cita !== "CANCELADA_OPORTUNA") {
      throw new Error("Estado no quedó en CANCELADA_OPORTUNA");
    }
    if (!esGsm7Valido(cancelData.notificacion_sms.cuerpo_mensaje)) {
      throw new Error(`SMS cancelación inválido GSM-7: ${cancelData.notificacion_sms.cuerpo_mensaje}`);
    }

    // Re-agendar el MISMO bloque reciclado con otro paciente (prueba índice único parcial)
    const otroPacienteId = pacienteNspId;
    const rebookRes = await fetch(`${baseURL}/api/v1/citas/confirmar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paciente_id: otroPacienteId,
        bloque_id: bloqueTestConcurrenciaId,
      }),
    });
    if (rebookRes.status !== 201) {
      throw new Error(`Reagendamiento en bloque reciclado falló (${rebookRes.status}): ${await rebookRes.text()}`);
    }
    const rebookData = await rebookRes.json();

    // Limpiar cita temporal de mañana
    await fetch(`${baseURL}/api/v1/citas/${rebookData.comprobante.cita_id}/cancelar`, {
      method: "POST",
    });
  });

  // ------------------------------------------------------------------
  // 3. HU-005 & HU-006: Gestión SOME autenticado
  // ------------------------------------------------------------------
  let profesionalId = "";
  let boxId = "";

  await test("HU-005: Listar, generar y pausar agenda con sesión SOME", async () => {
    const res = await fetch(`${baseURL}/api/v1/some/agendas`, {
      headers: { Cookie: someCookie },
    });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data.agendas?.length || !data.profesionales?.length || !data.boxes?.length) {
      throw new Error("Catálogos o agendas incompletas");
    }
    const profMed = data.profesionales.find((p) => p.especialidad === "MEDICINA_GENERAL");
    const boxMed = data.boxes.find((b) => b.especialidad === "MEDICINA_GENERAL");
    if (!profMed || !boxMed) throw new Error("Falta profesional o box Medicina General");
    profesionalId = profMed.id;
    boxId = boxMed.id;

    const fechaFutura = new Date();
    fechaFutura.setDate(fechaFutura.getDate() + 5);
    const fechaStr = fechaFutura.toISOString().split("T")[0];

    const genRes = await fetch(`${baseURL}/api/v1/some/agendas/generar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: someCookie },
      body: JSON.stringify({
        profesional_id: profesionalId,
        box_id: boxId,
        especialidad: "MEDICINA_GENERAL",
        fecha: fechaStr,
        hora_inicio: "09:00",
        hora_fin: "11:00",
        duracion_bloque_min: 20,
        porcentaje_cuota_mayor: 30,
      }),
    });
    if (genRes.status !== 201) throw new Error(`Generar agenda: ${genRes.status}`);
    const genData = await genRes.json();

    const pausaRes = await fetch(`${baseURL}/api/v1/some/agendas/${genData.agenda.id}/pausar`, {
      method: "PUT",
      headers: { Cookie: someCookie },
    });
    if (pausaRes.status !== 200) throw new Error(`Pausar agenda: ${pausaRes.status}`);
  });

  await test("HU-006: Agendamiento presencial Ventanilla SOME y bloqueo de cita duplicada (409)", async () => {
    const res = await fetch(`${baseURL}/api/v1/some/citas/agendar-ventanilla`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: someCookie },
      body: JSON.stringify({
        paciente_id: pacienteJovenId,
        bloque_id: bloqueTestConcurrenciaId,
      }),
    });
    if (res.status !== 201) throw new Error(`Agendar ventanilla: ${res.status}`);
    const d1 = await res.json();
    if (d1.comprobante.canal_origen !== "VENTANILLA_SOME") {
      throw new Error("Canal de ventanilla incorrecto");
    }

    const resDup = await fetch(`${baseURL}/api/v1/some/citas/agendar-ventanilla`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: someCookie },
      body: JSON.stringify({
        paciente_id: pacienteJovenId,
        bloque_id: bloqueDisponibleManana2Id,
      }),
    });
    if (resDup.status !== 409) throw new Error(`Esperaba 409 duplicada, obtuve ${resDup.status}`);
  });

  // ------------------------------------------------------------------
  // 4. HU-007 + Regla <30m Cancelación: Panel Box Clínico con RBAC
  // ------------------------------------------------------------------
  await test("HU-007 & HU-008: Box Clínico (ATENDIDA, NO_ASISTE +1 NSP, tolerancia 15m, futura 422, RBAC 403 y cancelación <30m 422)", async () => {
    const boxRes = await fetch(`${baseURL}/api/v1/box/citas-hoy`, {
      headers: { Cookie: carlosCookie },
    });
    if (boxRes.status !== 200) throw new Error(`Box citas-hoy: ${boxRes.status}`);
    const boxData = await boxRes.json();

    const cPasada = boxData.citas.find((c) => c.codigo_reserva === "MS-BOX001");
    const cActual = boxData.citas.find((c) => c.codigo_reserva === "MS-BOX002");
    const cFutura = boxData.citas.find((c) => c.codigo_reserva === "MS-BOX003");
    if (!cPasada || !cActual || !cFutura) {
      throw new Error("No se encontraron las 3 citas demo de Box Clínico en seed");
    }

    // Regla HU-008 (<30m antes de inicio): cancelar MS-BOX002 debe devolver 422
    const rCancelTarde = await fetch(`${baseURL}/api/v1/citas/${cActual.id}/cancelar`, {
      method: "POST",
    });
    if (rCancelTarde.status !== 422) {
      throw new Error(`Esperaba 422 por cancelación <30 min, obtuve ${rCancelTarde.status}`);
    }

    // Cita futura -> 422
    const rFutura = await fetch(`${baseURL}/api/v1/box/citas/${cFutura.id}/asistencia`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: carlosCookie },
      body: JSON.stringify({ estado_cita: "ATENDIDA" }),
    });
    if (rFutura.status !== 422) throw new Error(`Esperaba 422 cita futura, obtuve ${rFutura.status}`);

    // Cita iniciada hace <15m -> NO_ASISTE debe dar 422
    const rEarlyNsp = await fetch(`${baseURL}/api/v1/box/citas/${cActual.id}/asistencia`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: carlosCookie },
      body: JSON.stringify({ estado_cita: "NO_ASISTE" }),
    });
    if (rEarlyNsp.status !== 422) {
      throw new Error(`Esperaba 422 tolerancia 15m, obtuve ${rEarlyNsp.status}`);
    }

    // Otro profesional intentando marcar cita de Carlos -> 403
    const rCruzado = await fetch(`${baseURL}/api/v1/box/citas/${cFutura.id}/asistencia`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: valentinaCookie },
      body: JSON.stringify({ estado_cita: "ATENDIDA" }),
    });
    if (rCruzado.status !== 403) throw new Error(`Esperaba 403 cruzado, obtuve ${rCruzado.status}`);

    // Marcar cActual ATENDIDA -> 200
    const rAtendida = await fetch(`${baseURL}/api/v1/box/citas/${cActual.id}/asistencia`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: carlosCookie },
      body: JSON.stringify({ estado_cita: "ATENDIDA" }),
    });
    if (rAtendida.status !== 200) throw new Error(`ATENDIDA falló: ${rAtendida.status}`);

    // Marcar cPasada NO_ASISTE -> 200 y contador_inasistencias + 1
    const nspAntes = cPasada.paciente.contador_inasistencias;
    const rNsp = await fetch(`${baseURL}/api/v1/box/citas/${cPasada.id}/asistencia`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: carlosCookie },
      body: JSON.stringify({ estado_cita: "NO_ASISTE" }),
    });
    if (rNsp.status !== 200) throw new Error(`NO_ASISTE falló: ${rNsp.status}`);
    const nspData = await rNsp.json();
    if (nspData.contador_inasistencias !== nspAntes + 1) {
      throw new Error(`NSP esperado ${nspAntes + 1}, obtuve ${nspData.contador_inasistencias}`);
    }
  });

  // ------------------------------------------------------------------
  // 5. HU-003 & HU-004: Central Telefónica IVR + Webhook Público Twilio
  // ------------------------------------------------------------------
  await test("HU-003/004: IVR (No Inscrito, Antes/Después, Reagendamiento Duplicada, Cancelación por Voz + TwiML público)", async () => {
    const resetRes = await fetch(`${baseURL}/api/ivr/reset`, {
      method: "POST",
      headers: { Cookie: someCookie },
    });
    if (resetRes.status !== 200) throw new Error(`IVR reset: ${resetRes.status}`);

    // Verificar webhook público Twilio (voz Polly Neural + speech/dtmf)
    const twimlRes = await fetch(`${baseURL}/api/twilio/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "CallSid=test-webhook-qa",
    });
    const twimlXml = await twimlRes.text();
    if (twimlRes.status !== 200 || !twimlXml.includes("Polly.Mia-Neural") || !twimlXml.includes("speech dtmf")) {
      throw new Error(`TwiML inesperado: ${twimlXml}`);
    }

    const sim = async (text, callSid) => {
      const r = await fetch(`${baseURL}/api/ivr/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: someCookie },
        body: JSON.stringify({ action: "simulate", text, callSid }),
      });
      if (r.status !== 200) throw new Error(`Simulate ${r.status}`);
      return r.json();
    };

    const s1 = await sim("Hola quiero a las 10, mi RUT es 21.483.926-1", "qa-ivr-1");
    if (s1.reservaData?.status !== "NO_INSCRITO") throw new Error("Esperaba NO_INSCRITO");

    const s2a = await sim("Hola quiero hora para medicina a las 11 de la mañana, mi RUT es 21.758.467-1", "qa-ivr-2");
    if (
      s2a.reservaData?.status !== "OCUPADO" ||
      !s2a.reservaData?.horaSugeridaAntes ||
      !s2a.reservaData?.horaSugeridaDespues
    ) {
      throw new Error(`Esperaba OCUPADO con antes/después, obtuve ${JSON.stringify(s2a.reservaData)}`);
    }

    const s2b = await sim(
      `Prefiero la de después, a las ${s2a.reservaData.horaSugeridaDespues}`,
      "qa-ivr-2"
    );
    if (
      s2b.reservaData?.status !== "AGENDADO" ||
      s2b.reservaData?.horaConfirmada !== s2a.reservaData.horaSugeridaDespues
    ) {
      throw new Error(`Falló confirmación ${s2a.reservaData.horaSugeridaDespues}: ${JSON.stringify(s2b.reservaData)}`);
    }

    const s3a = await sim("Quiero otra hora a las 12:00, mi RUT es 21.758.467-1", "qa-ivr-3");
    if (s3a.reservaData?.status !== "CITA_DUPLICADA") {
      throw new Error("Esperaba CITA_DUPLICADA");
    }

    const s3b = await sim("Sí, anula la anterior y reagenda a las 12:00", "qa-ivr-3");
    if (s3b.reservaData?.status !== "AGENDADO" || s3b.reservaData?.horaConfirmada !== "12:00") {
      throw new Error("Falló reagendamiento a 12:00");
    }

    const s4 = await sim("Quiero cancelar mi hora médica, mi RUT es 21.758.467-1", "qa-ivr-4");
    if (s4.reservaData?.status !== "CANCELADO") {
      throw new Error(`Esperaba CANCELADO por voz, obtuve ${JSON.stringify(s4.reservaData)}`);
    }
  });

  // ------------------------------------------------------------------
  // 11. IVR Híbrido: Modo 100% Teclado DTMF + Pausas RUT + Rotacismo/Franjas
  // ------------------------------------------------------------------
  await test("IVR Híbrido: Flujo 100% DTMF, memoria por pausas/repetición y tolerancia fonética", async () => {
    const ivrPost = async (payload) => {
      const r = await fetch(`${baseURL}/api/ivr/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: someCookie },
        body: JSON.stringify(payload),
      });
      if (r.status !== 200) throw new Error(`IVR POST ${r.status}`);
      return r.json();
    };

    await ivrPost({ action: "reset" });

    const REGEX_BOTONES = /\b(presione|presionando|teclado|numeral|asterisco|marque|márquelo|marquelo)\b/i;
    const REGEX_VOZ = /\b(con su voz|dígamelo|digamelo|dígame|digame|diga sí|diga si|hábleme|hableme)\b/i;
    const assertSoloTeclado = (label, res) => {
      if (REGEX_VOZ.test(res.replyText || "")) {
        throw new Error(`Modo teclado mencionó hablar en ${label}: ${res.replyText}`);
      }
    };
    const assertSoloVoz = (label, res) => {
      if (REGEX_BOTONES.test(res.replyText || "")) {
        throw new Error(`Modo voz mencionó botones en ${label}: ${res.replyText}`);
      }
    };
    const assertSmsTicket = (label, res) => {
      const codigo = res.reservaData?.codigoReserva;
      const sms = (res.recentSms || []).find((s) => !codigo || s.codigo_reserva === codigo);
      if (!sms) throw new Error(`Falta registro SMS en ${label}`);
      if (!esGsm7Valido(sms.cuerpo_mensaje)) {
        throw new Error(`SMS no cumple GSM-7 <= 160 en ${label}: ${sms.cuerpo_mensaje}`);
      }
      for (const kw of ["Ticket ", "Box ", "reagendar", "anular", "llame"]) {
        if (!sms.cuerpo_mensaje.includes(kw)) {
          throw new Error(`SMS ${label} sin "${kw}": ${sms.cuerpo_mensaje}`);
        }
      }
      if (
        sms.estado_envio === "ENVIADO_TWILIO_SMS" ||
        sms.estado_envio === "ENVIADO_TWILIO_TRIAL"
      ) {
        throw new Error(`QA simulado (${label}) no debe disparar Twilio SMS real`);
      }
    };

    // A) 100% Teclado DTMF sin voz (5.842.319-K -> 5842319*)
    await ivrPost({ action: "welcome", callSid: "qa-dtmf-1" });
    const d1 = await ivrPost({ action: "dtmf", digits: "1", callSid: "qa-dtmf-1" });
    if (d1.step !== "ESPERANDO_RUT") throw new Error(`DTMF paso RUT falló: ${d1.step}`);
    assertSoloTeclado("d1", d1);

    const d2 = await ivrPost({ action: "dtmf", digits: "5842319*", callSid: "qa-dtmf-1" });
    if (d2.step !== "ESPERANDO_ESPECIALIDAD") throw new Error(`DTMF paso Esp falló: ${d2.step}`);
    assertSoloTeclado("d2", d2);

    const d3 = await ivrPost({ action: "dtmf", digits: "1", callSid: "qa-dtmf-1" });
    if (d3.step !== "ESPERANDO_FRANJA") throw new Error(`DTMF paso Franja falló: ${d3.step}`);
    assertSoloTeclado("d3", d3);

    const d4 = await ivrPost({ action: "dtmf", digits: "2", callSid: "qa-dtmf-1" });
    if (d4.step !== "ELIGIENDO_HORA_FRANJA") throw new Error(`DTMF listado horas falló: ${d4.step}`);
    assertSoloTeclado("d4", d4);

    const d5 = await ivrPost({ action: "dtmf", digits: "1", callSid: "qa-dtmf-1" });
    if (d5.reservaData?.status !== "AGENDADO") {
      throw new Error(`DTMF confirmación falló: ${JSON.stringify(d5.reservaData)}`);
    }
    assertSoloTeclado("d5", d5);
    assertSmsTicket("d5", d5);
    const d5Repeat = await ivrPost({ action: "dtmf", digits: "9", callSid: "qa-dtmf-1" });
    if (!d5Repeat.replyText.includes(d5.reservaData.codigoReserva)) {
      throw new Error("Tecla 9 no repitió código de reserva");
    }

    // Cancelación 100% DTMF (para cita futura >30m garantizado en cualquier hora del día)
    const futBook = await fetch(`${baseURL}/api/v1/some/citas/agendar-ventanilla`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: someCookie },
      body: JSON.stringify({
        paciente_id: pacienteNspId,
        bloque_id: bloqueDisponibleManana2Id,
      }),
    });
    if (futBook.status !== 201) throw new Error(`Agenda futura para test DTMF cancel falló: ${futBook.status}`);

    await ivrPost({ action: "welcome", callSid: "qa-dtmf-cancel" });
    const dcInit = await ivrPost({ action: "dtmf", digits: "2", callSid: "qa-dtmf-cancel" });
    assertSoloTeclado("dcInit", dcInit);
    const dc = await ivrPost({ action: "dtmf", digits: "168429150", callSid: "qa-dtmf-cancel" });
    if (dc.reservaData?.status !== "CANCELADO") {
      throw new Error(`Cancelación DTMF falló: ${JSON.stringify(dc.reservaData)}`);
    }
    assertSoloTeclado("dc", dc);

    // B) Pausas al dictar RUT ("router 21.758" + "4671") + memoria de las 11:00 + "puede repetir?"
    await ivrPost({ action: "welcome", callSid: "qa-pausa-1" });
    const p1 = await ivrPost({
      action: "simulate",
      text: "Hola me gustaría pedir una hora para las 11 de la mañana",
      callSid: "qa-pausa-1",
    });
    if (p1.step !== "ESPERANDO_RUT") throw new Error("Debió pedir RUT tras guardar 11:00");
    assertSoloVoz("p1", p1);

    const pRep = await ivrPost({
      action: "simulate",
      text: "puede repetir?",
      callSid: "qa-pausa-1",
    });
    if (!pRep.replyText.includes("11:00")) {
      throw new Error(`Repetición no conservó 11:00: ${pRep.replyText}`);
    }
    assertSoloVoz("pRep", pRep);

    const p2 = await ivrPost({
      action: "simulate",
      text: "Mi router es 21.758",
      callSid: "qa-pausa-1",
    });
    if (p2.step !== "ESPERANDO_RUT") throw new Error(`Debió acumular 21758: ${JSON.stringify(p2)}`);
    assertSoloVoz("p2", p2);

    const p3 = await ivrPost({
      action: "simulate",
      text: "4671",
      callSid: "qa-pausa-1",
    });
    if (p3.reservaData?.status !== "OCUPADO" || !p3.reservaData?.horaSugeridaAntes) {
      throw new Error(`Debió completar 21758467-1 y evaluar 11:00: ${JSON.stringify(p3)}`);
    }
    assertSoloVoz("p3", p3);

    const p4 = await ivrPost({
      action: "simulate",
      text: "la de antes",
      callSid: "qa-pausa-1",
    });
    if (p4.reservaData?.status !== "AGENDADO") {
      throw new Error(`Debió confirmar la de antes: ${JSON.stringify(p4.reservaData)}`);
    }
    assertSoloVoz("p4", p4);
    assertSmsTicket("p4", p4);

    // C) Rotacismo y franja hablada ("matloneria en la taide, mi lut es 21758467-1")
    await ivrPost({ action: "welcome", callSid: "qa-fono-1" });
    const f1 = await ivrPost({
      action: "simulate",
      text: "Hola quiero matloneria en la taide, mi lut es 21758467-1",
      callSid: "qa-fono-1",
    });
    if (f1.step !== "ELIGIENDO_HORA_FRANJA") {
      throw new Error(`Rotacismo/franja falló (${f1.step}): ${f1.replyText}`);
    }
    assertSoloVoz("f1", f1);
    const f2 = await ivrPost({
      action: "simulate",
      text: "la primera",
      callSid: "qa-fono-1",
    });
    if (f2.reservaData?.status !== "AGENDADO" || f2.reservaData?.especialidad !== "MATRONERIA") {
      throw new Error(`Confirmación Matronería por voz falló: ${JSON.stringify(f2.reservaData)}`);
    }
    assertSoloVoz("f2", f2);
  });

  console.log("=== TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO ===");
}

runTests().catch((e) => {
  console.error("Fallo general:", e);
  process.exit(1);
});
