// src/lib/ivr/voiceAgent.ts

import { GoogleGenAI, Type } from "@google/genai";
import {
  normalizarRut,
  extraerFragmentoNumericoRut,
  normalizarHora,
  detectarEspecialidad,
  detectarFranja,
  nombreEspecialidadLegible,
  nombreFranjaLegible,
  verificarOAgendarPorVoz,
  obtenerOpcionesPorFranjaPorVoz,
  confirmarBloqueSugeridoPorVoz,
  reagendarCancelandoAnteriorPorVoz,
  cancelarCitaActivaPorVoz,
} from "./ivrScheduleService";
import {
  IvrCallSession,
  IvrCallSmsContext,
  IvrExpectedInput,
  IvrFranja,
  IvrStep,
  IvrTranscriptEntry,
  VerificarOAgendarResult,
  VoiceAgentResult,
} from "./types";
import { Especialidad } from "@prisma/client";
import { formatearRut, validarRut } from "@/lib/utils/rut";

// ====================================================================
// MENSAJES BASE Y STORE EN MEMORIA POR CallSid
// ====================================================================

export const BIENVENIDA_IVR =
  "Hola, bienvenido al consultorio MallaSalud. Si prefiere usar solo el teclado, presione 1 para pedir hora o 2 para anular. Si prefiere hablarme, dígame su RUT y la hora o especialidad que necesita.";

interface GlobalIvrStore {
  callSessions: Map<string, IvrCallSession>;
}

declare global {
  // eslint-disable-next-line no-var
  var __IVR_STORE__: GlobalIvrStore | undefined;
}

function getIvrStore(): GlobalIvrStore {
  if (!globalThis.__IVR_STORE__) {
    globalThis.__IVR_STORE__ = {
      callSessions: new Map<string, IvrCallSession>(),
    };
  }
  return globalThis.__IVR_STORE__;
}

export function getOrCreateIvrSession(callSid: string): IvrCallSession {
  const store = getIvrStore();
  let session = store.callSessions.get(callSid);
  if (!session) {
    session = {
      callSid,
      transcript: [],
      step: "INICIO",
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      status: "in-progress",
    };
    store.callSessions.set(callSid, session);
  }
  return session;
}

export function addIvrTranscriptEntry(
  callSid: string,
  speaker: "user" | "bot" | "system",
  text: string
): IvrTranscriptEntry {
  const session = getOrCreateIvrSession(callSid);
  const entry: IvrTranscriptEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    speaker,
    text,
    timestamp: Date.now(),
  };
  session.transcript.push(entry);
  session.lastActivityAt = Date.now();
  return entry;
}

export function updateIvrSession(
  callSid: string,
  updates: Partial<IvrCallSession>
): IvrCallSession {
  const session = getOrCreateIvrSession(callSid);
  Object.assign(session, updates, { lastActivityAt: Date.now() });
  return session;
}

export function getAllIvrSessions(): IvrCallSession[] {
  const store = getIvrStore();
  return Array.from(store.callSessions.values()).sort(
    (a, b) => b.lastActivityAt - a.lastActivityAt
  );
}

export function clearIvrSessions(): void {
  const store = getIvrStore();
  store.callSessions.clear();
}

export function iniciarBienvenidaIvr(
  callSid: string,
  telefonoLlamada?: string
): IvrCallSession {
  const store = getIvrStore();
  store.callSessions.delete(callSid);
  const session = getOrCreateIvrSession(callSid);
  session.step = "INICIO";
  session.modoInteraccion = undefined;
  session.modoTeclado = undefined;
  if (telefonoLlamada) {
    session.telefonoLlamada = telefonoLlamada;
  }
  session.ultimoMensajeBot = BIENVENIDA_IVR;
  addIvrTranscriptEntry(callSid, "system", "Llamada conectada con Twilio.");
  addIvrTranscriptEntry(callSid, "bot", BIENVENIDA_IVR);
  return session;
}

export function esModoTeclado(session: IvrCallSession): boolean {
  return (
    session.modoInteraccion === "TECLADO" ||
    (session.modoInteraccion === undefined && Boolean(session.modoTeclado))
  );
}

function getSmsContext(session: IvrCallSession): IvrCallSmsContext {
  return {
    callSid: session.callSid,
    telefonoLlamada: session.telefonoLlamada,
  };
}

// ====================================================================
// UTILIDADES LINGÜÍSTICAS, DTMF Y ESTADO
// ====================================================================

export function deletrearCodigoReserva(codigo: string): string {
  return codigo
    .toUpperCase()
    .split("")
    .map((ch) => (ch === "-" ? "guion" : ch))
    .join(", ");
}

export function convertirDigitosDtmfARut(digitsRaw: string): string | null {
  const cleaned = digitsRaw.replace(/#/g, "").trim().toUpperCase();
  if (cleaned.length < 7 || cleaned.length > 9) return null;

  const cuerpo = cleaned.slice(0, -1).replace(/\*/g, "");
  const ultimo = cleaned.slice(-1);

  if (!/^\d{6,8}$/.test(cuerpo)) return null;

  if (ultimo === "*" && validarRut(`${cuerpo}-K`)) {
    return `${cuerpo}-K`;
  }
  if (/^\d$/.test(ultimo) && validarRut(`${cuerpo}-${ultimo}`)) {
    return `${cuerpo}-${ultimo}`;
  }
  if (ultimo === "0" && validarRut(`${cuerpo}-K`)) {
    return `${cuerpo}-K`;
  }
  return null;
}

function stepToExpectedInput(step?: IvrStep): IvrExpectedInput {
  switch (step) {
    case "ESPERANDO_RUT":
      return "rut";
    case "ESPERANDO_ESPECIALIDAD":
    case "ESPERANDO_FRANJA":
    case "ELIGIENDO_HORA_FRANJA":
      return "menu";
    case "CONFIRMANDO_SUGERENCIA":
    case "CONFIRMANDO_REAGENDAMIENTO":
    case "COMPLETADO":
      return "confirmation";
    default:
      return "open";
  }
}

function formatVocativo(nombre?: string, esAdultoMayor?: boolean): string {
  if (!nombre) return "";
  return esAdultoMayor ? `Don o Señora ${nombre}` : nombre;
}

function normalizarPlano(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;!?¿¡]/g, " ")
    .trim();
}

export function esSolicitudRepeticion(text: string): boolean {
  const raw = normalizarPlano(text);
  return /\b(puede repetir|puedes repetir|repite|repiteme|repetir|no escuche|no te escuche|como dijo|otra vez|de nuevo)\b/i.test(
    raw
  );
}

export function esAceptacionOConfirmacion(text: string): boolean {
  if (!text) return false;
  const raw = normalizarPlano(text);

  if (
    /\b(no|nop|para nada|rechazo|no me sirve|muy tarde|muy temprano|no puedo|mala hora)\b/i.test(
      raw
    )
  ) {
    return false;
  }

  const patronesAfirmativos = [
    /\bsi\b/i,
    /\bsi+\b/i,
    /\bsi po\b/i,
    /\bsipo\b/i,
    /\bvale\b/i,
    /\bdale\b/i,
    /\bbueno\b/i,
    /\bbien\b/i,
    /\bok\b/i,
    /\boka\b/i,
    /\bokay\b/i,
    /\bya\b/i,
    /\bya po\b/i,
    /\byapo\b/i,
    /\bperfecto\b/i,
    /\bclaro\b/i,
    /\bobvio\b/i,
    /\bme parece\b/i,
    /\bme parece bien\b/i,
    /\bde acuerdo\b/i,
    /\bpor favor\b/i,
    /\bporfa\b/i,
    /\besta bien\b/i,
    /\bme sirve\b/i,
    /\bla tomo\b/i,
    /\btomala\b/i,
    /\bagendala\b/i,
    /\bagendar\b/i,
    /\bconfirmo\b/i,
    /\bconfirmar\b/i,
    /\bacepto\b/i,
    /\banotame\b/i,
    /\blisto\b/i,
    /\bexcelente\b/i,
  ];

  return patronesAfirmativos.some((p) => p.test(raw));
}

function esRechazo(text: string): boolean {
  if (!text) return false;
  const raw = normalizarPlano(text);
  return /\b(no|nop|mantener|manten|prefiero mantener|dejala asi|dejarla asi|ninguna|no gracias|rechazo)\b/i.test(
    raw
  );
}

function esIntencionCancelacion(text: string): boolean {
  if (!text) return false;
  const raw = normalizarPlano(text);
  const quiereAnular = /\b(anula|anular|cancela|cancelar|suspender|dar de baja)\b/i.test(raw);
  const quiereReagendar = /\b(reagenda|reagendar|cambiar|otra hora)\b/i.test(raw);
  return quiereAnular && !quiereReagendar;
}

function promptMenuEspecialidad(vocativo: string, esTeclado: boolean): string {
  const saludo = vocativo ? `Hola ${vocativo}. ` : "";
  if (esTeclado) {
    return `${saludo}Para elegir especialidad, presione 1 para Medicina General, 2 para Urgencia Dental, o 3 para Matronería.`;
  }
  return `${saludo}¿Para qué especialidad necesita su hora? Tenemos Medicina General, Urgencia Dental o Matronería.`;
}

function promptMenuFranjas(especialidadNombre: string, esTeclado: boolean): string {
  if (esTeclado) {
    return `Perfecto, ${especialidadNombre}. Presione 1 para mañana temprano, 2 para media mañana, 3 para la tarde, o 4 para la primera hora disponible.`;
  }
  return `Perfecto, ${especialidadNombre}. ¿Qué horario prefiere? Puede decirme una hora exacta, o elegir mañana temprano, media mañana, la tarde, o la primera hora disponible.`;
}

function construirMensajeConfirmado(res: VerificarOAgendarResult, esTeclado: boolean): string {
  const voc = formatVocativo(res.pacienteNombre, res.esAdultoMayor);
  const codigo = res.codigoReserva || "";
  const deletreo = codigo ? `, es decir, ${deletrearCodigoReserva(codigo)}` : "";
  const boxTxt = res.boxNumero ? ` en ${res.boxNumero}` : "";
  const extra = esTeclado
    ? " Presione 9 si desea repetir su código, o puede colgar. ¡Que tenga un buen día!"
    : " ¡Que tenga un excelente día!";
  return `Perfecto ${voc}, su cita para el RUT ${res.rut} ha quedado confirmada a las ${res.horaConfirmada} en ${res.especialidadNombre}${boxTxt}, con código ${codigo}${deletreo}. Le enviaremos un mensaje de texto con su ticket de atención.${extra}`;
}

function limpiarSugerenciasSession(callSid: string, codigoReserva?: string) {
  updateIvrSession(callSid, {
    step: "COMPLETADO",
    estadoCita: "AGENDADO",
    status: "completed",
    horaSolicitada: undefined,
    horaSugerida: undefined,
    bloqueSugeridoId: undefined,
    horaSugeridaAntes: undefined,
    bloqueSugeridoAntesId: undefined,
    horaSugeridaDespues: undefined,
    bloqueSugeridoDespuesId: undefined,
    citaExistenteId: undefined,
    horaExistente: undefined,
    citaExistenteCodigo: undefined,
    bloqueReagendarId: undefined,
    horaReagendar: undefined,
    opcionesFranja: undefined,
    codigoReserva,
  });
}

function construirMensajeHoraOcupada(res: VerificarOAgendarResult, esTeclado: boolean): string {
  const vocativo = res.pacienteNombre ? `Hola ${formatVocativo(res.pacienteNombre, res.esAdultoMayor)}, ` : "";
  if (res.horaSugeridaAntes && res.horaSugeridaDespues) {
    if (esTeclado) {
      return `${vocativo}la hora de las ${res.horaSolicitada} en ${res.especialidadNombre} ya está ocupada. Puedo ofrecerle antes a las ${res.horaSugeridaAntes} presionando 1, o después a las ${res.horaSugeridaDespues} presionando 2, con ${res.profesionalNombre}.`;
    }
    return `${vocativo}la hora de las ${res.horaSolicitada} en ${res.especialidadNombre} ya está ocupada. Puedo ofrecerle antes a las ${res.horaSugeridaAntes}, o después a las ${res.horaSugeridaDespues}, con ${res.profesionalNombre}. ¿Cuál prefiere agendar?`;
  }
  const unica = res.horaSugeridaDespues || res.horaSugeridaAntes || res.horaSugerida;
  if (esTeclado) {
    return `${vocativo}la hora de las ${res.horaSolicitada} en ${res.especialidadNombre} ya está tomada, pero tengo disponible a las ${unica} con ${res.profesionalNombre}. Presione 1 para confirmar o 2 para elegir otra hora.`;
  }
  return `${vocativo}la hora de las ${res.horaSolicitada} en ${res.especialidadNombre} ya está tomada, pero tengo disponible a las ${unica} con ${res.profesionalNombre}. ¿Desea agendar esa hora?`;
}

function construirMensajeCitaDuplicada(res: VerificarOAgendarResult, esTeclado: boolean): string {
  const voc = formatVocativo(res.pacienteNombre, res.esAdultoMayor);
  if (res.horaReagendar && res.bloqueReagendarId) {
    if (esTeclado) {
      return `Hola ${voc}, ya tiene una cita médica agendada para hoy a las ${res.horaExistente} en ${res.especialidadNombre}, código ${res.codigoReserva}, y solo se permite una por día. Presione 1 para anular la anterior de las ${res.horaExistente} y reagendar para las ${res.horaReagendar}, o presione 2 para mantenerla.`;
    }
    return `Hola ${voc}, ya tiene una cita médica agendada para hoy a las ${res.horaExistente} en ${res.especialidadNombre}, código ${res.codigoReserva}, y solo se permite una por día. ¿Desea anular la anterior de las ${res.horaExistente} y reagendar para las ${res.horaReagendar}, o prefiere mantener su hora actual?`;
  }
  return `Hola ${voc}, ya tiene una cita agendada para hoy a las ${res.horaExistente} en ${res.especialidadNombre} con ${res.profesionalNombre}. Por normativa del CESFAM, solo se permite una cita activa al día.`;
}

function guardarPendienteReagendamientoSession(callSid: string, res: VerificarOAgendarResult) {
  updateIvrSession(callSid, {
    step: res.bloqueReagendarId ? "CONFIRMANDO_REAGENDAMIENTO" : "COMPLETADO",
    estadoCita: "CITA_DUPLICADA",
    rut: res.rut,
    pacienteNombre: res.pacienteNombre,
    esAdultoMayor: res.esAdultoMayor,
    especialidad: res.especialidad,
    especialidadConfirmada: true,
    citaExistenteId: res.citaExistenteId,
    horaExistente: res.horaExistente,
    citaExistenteCodigo: res.codigoReserva,
    bloqueReagendarId: res.bloqueReagendarId,
    horaReagendar: res.horaReagendar,
  });
}

// ====================================================================
// ACCIONES TRANSVERSALES COMPARTIDAS (VOZ + TECLADO + GEMINI)
// ====================================================================

async function resolverHoraDirectaPorVoz(
  callSid: string,
  rutInput: string,
  horaInput: string,
  espInput: Especialidad | undefined,
  engineUsed: VoiceAgentResult["engineUsed"]
): Promise<VoiceAgentResult> {
  const session = getOrCreateIvrSession(callSid);
  const esTeclado = esModoTeclado(session);
  const res = await verificarOAgendarPorVoz(
    rutInput,
    horaInput,
    espInput || Especialidad.MEDICINA_GENERAL,
    getSmsContext(session)
  );

  if (res.status === "NO_INSCRITO") {
    updateIvrSession(callSid, { step: "COMPLETADO", estadoCita: "NO_INSCRITO", status: "completed" });
    return {
      replyText: `El RUT ${res.rut} no se encuentra inscrito en nuestro centro de salud. Para solicitar horas médicas, debe acercarse presencialmente a la ventanilla SOME del CESFAM con su cédula de identidad.`,
      shouldHangup: true,
      engineUsed,
      step: "COMPLETADO",
      reservaData: res,
    };
  }

  if (res.status === "CITA_DUPLICADA") {
    guardarPendienteReagendamientoSession(callSid, res);
    return {
      replyText: construirMensajeCitaDuplicada(res, esTeclado),
      shouldHangup: !res.bloqueReagendarId,
      engineUsed,
      expectedInput: res.bloqueReagendarId ? "confirmation" : undefined,
      step: res.bloqueReagendarId ? "CONFIRMANDO_REAGENDAMIENTO" : "COMPLETADO",
      reservaData: res,
    };
  }

  if (res.status === "AGENDADO") {
    limpiarSugerenciasSession(callSid, res.codigoReserva);
    updateIvrSession(callSid, {
      rut: res.rut,
      pacienteNombre: res.pacienteNombre,
      esAdultoMayor: res.esAdultoMayor,
    });
    return {
      replyText: construirMensajeConfirmado(res, esTeclado),
      shouldHangup: !esTeclado,
      engineUsed,
      expectedInput: "confirmation",
      step: "COMPLETADO",
      reservaData: res,
    };
  }

  if (
    res.status === "OCUPADO" &&
    (res.horaSugerida || res.horaSugeridaAntes || res.horaSugeridaDespues)
  ) {
    updateIvrSession(callSid, {
      step: "CONFIRMANDO_SUGERENCIA",
      rut: res.rut,
      horaSugerida: res.horaSugerida,
      bloqueSugeridoId: res.bloqueSugeridoId,
      horaSugeridaAntes: res.horaSugeridaAntes,
      bloqueSugeridoAntesId: res.bloqueSugeridoAntesId,
      horaSugeridaDespues: res.horaSugeridaDespues,
      bloqueSugeridoDespuesId: res.bloqueSugeridoDespuesId,
      horaSolicitada: res.horaSolicitada,
      pacienteNombre: res.pacienteNombre,
      profesionalNombre: res.profesionalNombre,
      especialidad: res.especialidad,
      esAdultoMayor: res.esAdultoMayor,
    });
    return {
      replyText: construirMensajeHoraOcupada(res, esTeclado),
      shouldHangup: false,
      engineUsed,
      expectedInput: "confirmation",
      step: "CONFIRMANDO_SUGERENCIA",
      reservaData: res,
    };
  }

  updateIvrSession(callSid, {
    step: "ESPERANDO_FRANJA",
    horaSolicitada: undefined,
    pacienteNombre: res.pacienteNombre,
    esAdultoMayor: res.esAdultoMayor,
  });
  return {
    replyText: `Lo lamento ${res.pacienteNombre || ""}, no nos quedan horas disponibles para hoy en ${res.especialidadNombre}.`,
    shouldHangup: true,
    engineUsed,
    step: "COMPLETADO",
    reservaData: res,
  };
}

async function resolverOpcionesFranja(
  callSid: string,
  rutInput: string,
  espInput: Especialidad | undefined,
  franja: IvrFranja,
  engineUsed: VoiceAgentResult["engineUsed"]
): Promise<VoiceAgentResult> {
  const session = getOrCreateIvrSession(callSid);
  const esTeclado = esModoTeclado(session);
  const esp = espInput || Especialidad.MEDICINA_GENERAL;
  const res = await obtenerOpcionesPorFranjaPorVoz(rutInput, esp, franja);

  if (res.status === "NO_INSCRITO") {
    updateIvrSession(callSid, { step: "COMPLETADO", estadoCita: "NO_INSCRITO", status: "completed" });
    return {
      replyText: `El RUT ${res.rut} no se encuentra inscrito en nuestro centro de salud. Debe acercarse presencialmente a ventanilla SOME con su cédula de identidad.`,
      shouldHangup: true,
      engineUsed,
      step: "COMPLETADO",
    };
  }

  if (res.status === "CITA_DUPLICADA" && res.duplicada) {
    guardarPendienteReagendamientoSession(callSid, res.duplicada);
    return {
      replyText: construirMensajeCitaDuplicada(res.duplicada, esTeclado),
      shouldHangup: !res.duplicada.bloqueReagendarId,
      engineUsed,
      expectedInput: res.duplicada.bloqueReagendarId ? "confirmation" : undefined,
      step: res.duplicada.bloqueReagendarId ? "CONFIRMANDO_REAGENDAMIENTO" : "COMPLETADO",
      reservaData: res.duplicada,
    };
  }

  if (res.status === "SIN_DISPONIBILIDAD" || res.opciones.length === 0) {
    if (res.otrasFranjasDisponibles.length > 0) {
      updateIvrSession(callSid, { step: "ESPERANDO_FRANJA", especialidad: esp, especialidadConfirmada: true });

      if (esTeclado) {
        const etiquetaNum = (f: IvrFranja) =>
          f === "MANANA"
            ? "1 para mañana temprano"
            : f === "MEDIA_MANANA"
            ? "2 para media mañana"
            : "3 para la tarde";
        const altTxt = res.otrasFranjasDisponibles.map(etiquetaNum).join(", o ");
        return {
          replyText: `Lo lamento, no quedan cupos en ${res.franjaNombre} para ${res.especialidadNombre}. Tengo disponibilidad en otras franjas: presione ${altTxt}.`,
          shouldHangup: false,
          engineUsed,
          expectedInput: "menu",
          step: "ESPERANDO_FRANJA",
        };
      }

      const etiquetaVoz = (f: IvrFranja) =>
        f === "MANANA"
          ? "mañana temprano"
          : f === "MEDIA_MANANA"
          ? "media mañana"
          : "la tarde";
      const altTxtVoz = res.otrasFranjasDisponibles.map(etiquetaVoz).join(", o ");
      return {
        replyText: `Lo lamento, no quedan cupos en ${res.franjaNombre} para ${res.especialidadNombre}. Tengo disponibilidad en ${altTxtVoz}. ¿Cuál horario prefiere?`,
        shouldHangup: false,
        engineUsed,
        expectedInput: "menu",
        step: "ESPERANDO_FRANJA",
      };
    }

    updateIvrSession(callSid, { step: "COMPLETADO", status: "completed" });
    return {
      replyText: `Lo lamento ${res.pacienteNombre || ""}, ya no quedan horas disponibles para hoy en ${res.especialidadNombre}. Intente mañana o acérquese a ventanilla SOME.`,
      shouldHangup: true,
      engineUsed,
      step: "COMPLETADO",
    };
  }

  updateIvrSession(callSid, {
    step: "ELIGIENDO_HORA_FRANJA",
    rut: res.rut,
    pacienteNombre: res.pacienteNombre,
    esAdultoMayor: res.esAdultoMayor,
    especialidad: res.especialidad,
    especialidadConfirmada: true,
    franjaSeleccionada: franja,
    opcionesFranja: res.opciones,
    horaSolicitada: undefined,
  });

  if (esTeclado) {
    const listaOpciones = res.opciones
      .map((o, i) => `presione ${i + 1} para las ${o.hora}`)
      .join(", ");

    return {
      replyText: `En ${res.franjaNombre} para ${res.especialidadNombre} tengo disponible: ${listaOpciones}, o presione 0 para elegir otra franja.`,
      shouldHangup: false,
      engineUsed,
      expectedInput: "menu",
      step: "ELIGIENDO_HORA_FRANJA",
    };
  }

  const horasVoz = res.opciones.map((o) => `a las ${o.hora}`);
  const listaVoz =
    horasVoz.length === 1
      ? horasVoz[0]
      : `${horasVoz.slice(0, -1).join(", ")} o ${horasVoz[horasVoz.length - 1]}`;

  return {
    replyText: `En ${res.franjaNombre} para ${res.especialidadNombre} tengo disponible ${listaVoz}. ¿Cuál de estas horas prefiere, o desea revisar otro horario?`,
    shouldHangup: false,
    engineUsed,
    expectedInput: "menu",
    step: "ELIGIENDO_HORA_FRANJA",
  };
}

async function confirmarBloqueYResponder(
  callSid: string,
  bloqueId: string,
  rut: string,
  engineUsed: VoiceAgentResult["engineUsed"] = "fast_confirmation"
): Promise<VoiceAgentResult> {
  const session = getOrCreateIvrSession(callSid);
  const esTeclado = esModoTeclado(session);
  const res = await confirmarBloqueSugeridoPorVoz(bloqueId, rut, getSmsContext(session));
  limpiarSugerenciasSession(callSid, res.codigoReserva);
  return {
    replyText: construirMensajeConfirmado(res, esTeclado),
    shouldHangup: !esTeclado,
    engineUsed,
    expectedInput: "confirmation",
    step: "COMPLETADO",
    reservaData: res,
  };
}

async function manejarSolicitudCancelacionVoz(
  callSid: string,
  rutInput: string,
  esp?: Especialidad
): Promise<VoiceAgentResult> {
  const session = getOrCreateIvrSession(callSid);
  const res = await cancelarCitaActivaPorVoz(rutInput, esp, getSmsContext(session));
  const vocativo = formatVocativo(res.pacienteNombre, res.esAdultoMayor);

  if (res.status === "NO_INSCRITO") {
    updateIvrSession(callSid, { step: "COMPLETADO", estadoCita: "NO_INSCRITO", intentCancelacion: false });
    return {
      replyText: `El RUT ${res.rut} no se encuentra inscrito en nuestro centro de salud. Para consultar sus atenciones debe acercarse a ventanilla SOME con su cédula.`,
      shouldHangup: true,
      engineUsed: "local_fallback",
      step: "COMPLETADO",
      reservaData: res,
    };
  }

  if (res.status === "CANCELADO") {
    updateIvrSession(callSid, {
      step: "COMPLETADO",
      estadoCita: "CANCELADO",
      status: "completed",
      intentCancelacion: false,
      codigoReserva: res.codigoReserva,
      pacienteNombre: res.pacienteNombre,
    });
    return {
      replyText: `Listo ${vocativo}, su cita de las ${res.horaExistente} en ${res.especialidadNombre} (código ${res.codigoReserva}) fue anulada oportunamente sin registrar inasistencia, y enviamos un SMS de respaldo. Que tenga un buen día.`,
      shouldHangup: true,
      engineUsed: "fast_confirmation",
      step: "COMPLETADO",
      reservaData: res,
    };
  }

  if (res.status === "CANCELACION_EXPIRADA") {
    updateIvrSession(callSid, { step: "COMPLETADO", intentCancelacion: false, status: "completed" });
    return {
      replyText: `Lo lamento ${vocativo}, no es posible anular la cita de las ${res.horaExistente} porque faltan menos de 30 minutos para la atención. Por favor comuníquese con ventanilla SOME.`,
      shouldHangup: true,
      engineUsed: "local_fallback",
      step: "COMPLETADO",
      reservaData: res,
    };
  }

  updateIvrSession(callSid, { step: "COMPLETADO", intentCancelacion: false, status: "completed" });
  return {
    replyText: `${vocativo ? vocativo + ", " : ""}no encontramos citas médicas activas registradas para anular en su RUT. Que tenga un buen día.`,
    shouldHangup: true,
    engineUsed: "local_fallback",
    step: "COMPLETADO",
    reservaData: res,
  };
}

// ====================================================================
// RESPUESTA POR VOZ A SUGERENCIAS / MENÚS PENDIENTES
// ====================================================================

function seleccionarBloqueAlternativo(
  session: IvrCallSession,
  userSpeech: string
): string | undefined {
  const tienePendiente =
    session.bloqueSugeridoId ||
    session.bloqueSugeridoAntesId ||
    session.bloqueSugeridoDespuesId;
  if (!tienePendiente) return undefined;

  const raw = normalizarPlano(userSpeech);

  if (/\b(no puedo|ninguna|rechazo|ninguno|no me sirve)\b/i.test(raw)) {
    return undefined;
  }

  const horaDetectada = normalizarHora(userSpeech, session.rut);
  if (horaDetectada) {
    if (session.horaSugeridaAntes === horaDetectada && session.bloqueSugeridoAntesId) {
      return session.bloqueSugeridoAntesId;
    }
    if (session.horaSugeridaDespues === horaDetectada && session.bloqueSugeridoDespuesId) {
      return session.bloqueSugeridoDespuesId;
    }
  }

  if (
    /\b(antes|anterior|mas temprano|temprano|primera)\b/i.test(raw) &&
    session.bloqueSugeridoAntesId
  ) {
    return session.bloqueSugeridoAntesId;
  }

  if (
    /\b(despues|posterior|mas tarde|tarde|segunda|luego)\b/i.test(raw) &&
    session.bloqueSugeridoDespuesId
  ) {
    return session.bloqueSugeridoDespuesId;
  }

  if (esAceptacionOConfirmacion(userSpeech)) {
    return (
      session.bloqueSugeridoId ||
      session.bloqueSugeridoDespuesId ||
      session.bloqueSugeridoAntesId
    );
  }

  return undefined;
}

async function resolverPendienteReagendamiento(
  callSid: string,
  session: IvrCallSession,
  userSpeech: string
): Promise<VoiceAgentResult | null> {
  if (!session.citaExistenteId || !session.bloqueReagendarId) return null;

  const vocativo = formatVocativo(session.pacienteNombre, session.esAdultoMayor);

  if (esRechazo(userSpeech)) {
    const horaActual = session.horaExistente;
    const codigoActual = session.citaExistenteCodigo;
    updateIvrSession(callSid, {
      step: "COMPLETADO",
      estadoCita: "AGENDADO",
      status: "completed",
      citaExistenteId: undefined,
      horaExistente: undefined,
      citaExistenteCodigo: undefined,
      bloqueReagendarId: undefined,
      horaReagendar: undefined,
    });
    return {
      replyText: `Entendido ${vocativo}, mantenemos entonces su cita actual de las ${horaActual} (código ${codigoActual}). ¡Que tenga un excelente día!`,
      shouldHangup: true,
      engineUsed: "fast_confirmation",
      step: "COMPLETADO",
    };
  }

  const raw = normalizarPlano(userSpeech);
  const quiereReagendar =
    esAceptacionOConfirmacion(userSpeech) ||
    /\b(anula|anular|cancela|cancelar|reagenda|reagendar|cambia|cambiar|nueva)\b/i.test(raw) ||
    (session.horaReagendar && normalizarHora(userSpeech, session.rut) === session.horaReagendar);

  if (!quiereReagendar) return null;

  const rut = session.rut || "21758467-1";
  const esTeclado = esModoTeclado(session);
  const res = await reagendarCancelandoAnteriorPorVoz(
    session.citaExistenteId,
    session.bloqueReagendarId,
    rut,
    getSmsContext(session)
  );
  limpiarSugerenciasSession(callSid, res.codigoReserva);

  const voc = formatVocativo(res.pacienteNombre, res.esAdultoMayor);
  const deletreo = res.codigoReserva ? `, es decir, ${deletrearCodigoReserva(res.codigoReserva)}` : "";
  const boxTxt = res.boxNumero ? ` en ${res.boxNumero}` : "";
  const extra = esTeclado
    ? " Presione 9 si desea repetir su código, o puede colgar. ¡Que tenga un buen día!"
    : " ¡Que tenga un excelente día!";
  return {
    replyText: `Perfecto ${voc}, anulamos su hora anterior de las ${res.horaExistente} y reagendamos su cita para las ${res.horaConfirmada} en ${res.especialidadNombre}${boxTxt}, con código ${res.codigoReserva}${deletreo}. Le enviaremos un mensaje de texto con su ticket de atención.${extra}`,
    shouldHangup: !esTeclado,
    engineUsed: "fast_confirmation",
    expectedInput: "confirmation",
    step: "COMPLETADO",
    reservaData: res,
  };
}

async function resolverEleccionFranjaPorVoz(
  callSid: string,
  session: IvrCallSession,
  userSpeech: string
): Promise<VoiceAgentResult | null> {
  if (session.step !== "ELIGIENDO_HORA_FRANJA" || !session.opcionesFranja?.length) {
    return null;
  }

  const raw = normalizarPlano(userSpeech);
  if (/\b(otra franja|otro horario|cambiar|volver|ninguna)\b/i.test(raw)) {
    updateIvrSession(callSid, { step: "ESPERANDO_FRANJA", opcionesFranja: undefined });
    const espNombre = nombreEspecialidadLegible(session.especialidad || Especialidad.MEDICINA_GENERAL);
    return {
      replyText: promptMenuFranjas(espNombre, false),
      shouldHangup: false,
      engineUsed: "fast_confirmation",
      expectedInput: "menu",
      step: "ESPERANDO_FRANJA",
    };
  }

  const horaDicha = normalizarHora(userSpeech, session.rut);
  let elegido = horaDicha ? session.opcionesFranja.find((o) => o.hora === horaDicha) : undefined;

  if (!elegido) {
    if (/\b(primera|primero|la 1|opcion 1|uno)\b/i.test(raw)) {
      elegido = session.opcionesFranja[0];
    } else if (/\b(segunda|segundo|la 2|opcion 2|dos)\b/i.test(raw)) {
      elegido = session.opcionesFranja[1];
    } else if (/\b(tercera|tercero|la 3|opcion 3|tres)\b/i.test(raw)) {
      elegido = session.opcionesFranja[2];
    } else if (/\b(cuarta|cuarto|la 4|opcion 4|cuatro)\b/i.test(raw)) {
      elegido = session.opcionesFranja[3];
    }
  }

  if (!elegido) return null;

  try {
    return await confirmarBloqueYResponder(
      callSid,
      elegido.bloqueId,
      session.rut || "21758467-1",
      "fast_confirmation"
    );
  } catch {
    return {
      replyText:
        "Lo siento, esa hora acaba de ser tomada. Por favor dígame otra de las horas disponibles o si prefiere revisar otro horario.",
      shouldHangup: false,
      engineUsed: "local_fallback",
      expectedInput: "menu",
      step: "ELIGIENDO_HORA_FRANJA",
    };
  }
}

// ====================================================================
// MÁQUINA DE ESTADOS DTMF 100% TECLADO TELEFÓNICO
// ====================================================================

async function procesarRutValidoDtmf(
  callSid: string,
  rut: string
): Promise<VoiceAgentResult> {
  const session = getOrCreateIvrSession(callSid);
  updateIvrSession(callSid, { rut, rutParcial: undefined });

  if (session.intentCancelacion) {
    return manejarSolicitudCancelacionVoz(callSid, rut, session.especialidad);
  }

  if (session.horaSolicitada) {
    return resolverHoraDirectaPorVoz(
      callSid,
      rut,
      session.horaSolicitada,
      session.especialidad,
      "fast_confirmation"
    );
  }

  const espTarget = session.especialidadConfirmada ? session.especialidad : undefined;
  const verif = await verificarOAgendarPorVoz(rut, undefined, espTarget, getSmsContext(session));

  if (verif.status === "NO_INSCRITO") {
    updateIvrSession(callSid, { step: "COMPLETADO", estadoCita: "NO_INSCRITO", status: "completed" });
    return {
      replyText: `El RUT ${verif.rut} no se encuentra inscrito en nuestro centro de salud. Debe acercarse presencialmente a la ventanilla SOME del CESFAM con su cédula de identidad.`,
      shouldHangup: true,
      engineUsed: "local_fallback",
      step: "COMPLETADO",
      reservaData: verif,
    };
  }

  updateIvrSession(callSid, {
    pacienteNombre: verif.pacienteNombre,
    esAdultoMayor: verif.esAdultoMayor,
  });

  if (session.especialidadConfirmada && session.especialidad) {
    if (verif.status === "CITA_DUPLICADA") {
      guardarPendienteReagendamientoSession(callSid, verif);
      return {
        replyText: construirMensajeCitaDuplicada(verif, true),
        shouldHangup: !verif.bloqueReagendarId,
        engineUsed: "local_fallback",
        expectedInput: verif.bloqueReagendarId ? "confirmation" : undefined,
        step: verif.bloqueReagendarId ? "CONFIRMANDO_REAGENDAMIENTO" : "COMPLETADO",
        reservaData: verif,
      };
    }

    if (session.franjaSeleccionada) {
      return resolverOpcionesFranja(
        callSid,
        rut,
        session.especialidad,
        session.franjaSeleccionada,
        "fast_confirmation"
      );
    }

    updateIvrSession(callSid, { step: "ESPERANDO_FRANJA" });
    const voc = formatVocativo(verif.pacienteNombre, verif.esAdultoMayor);
    return {
      replyText: `Hola ${voc}. ${promptMenuFranjas(nombreEspecialidadLegible(session.especialidad), true)}`,
      shouldHangup: false,
      engineUsed: "fast_confirmation",
      expectedInput: "menu",
      step: "ESPERANDO_FRANJA",
    };
  }

  updateIvrSession(callSid, { step: "ESPERANDO_ESPECIALIDAD" });
  const voc = formatVocativo(verif.pacienteNombre, verif.esAdultoMayor);
  return {
    replyText: promptMenuEspecialidad(voc, true),
    shouldHangup: false,
    engineUsed: "fast_confirmation",
    expectedInput: "menu",
    step: "ESPERANDO_ESPECIALIDAD",
  };
}

async function procesarConTecladoDtmf(
  callSid: string,
  digitsRaw: string
): Promise<VoiceAgentResult> {
  const session = getOrCreateIvrSession(callSid);
  const cleanDigits = digitsRaw.replace(/#/g, "").trim().toUpperCase();
  const step: IvrStep = session.step || "INICIO";

  updateIvrSession(callSid, { modoInteraccion: "TECLADO", modoTeclado: true });

  if (!cleanDigits) {
    const reply = session.ultimoMensajeBot || BIENVENIDA_IVR;
    return {
      replyText: reply,
      shouldHangup: false,
      engineUsed: "fast_confirmation",
      expectedInput: stepToExpectedInput(step),
      step,
    };
  }

  // Tecla 9 universal: repetir el último mensaje del asistente
  if (cleanDigits === "9") {
    return {
      replyText: session.ultimoMensajeBot || BIENVENIDA_IVR,
      shouldHangup: false,
      engineUsed: "fast_confirmation",
      expectedInput: stepToExpectedInput(step),
      step,
    };
  }

  // Si digitó un RUT completo (7 a 9 dígitos) en INICIO o ESPERANDO_RUT
  if (cleanDigits.length >= 7 && (step === "INICIO" || step === "ESPERANDO_RUT")) {
    const rutValidado = convertirDigitosDtmfARut(cleanDigits);
    if (!rutValidado) {
      updateIvrSession(callSid, { step: "ESPERANDO_RUT" });
      return {
        replyText:
          "No logré validar ese RUT chileno. Por favor marque todos los dígitos incluyendo el dígito verificador y luego numeral, usando asterisco si termina en ka.",
        shouldHangup: false,
        engineUsed: "local_fallback",
        expectedInput: "rut",
        step: "ESPERANDO_RUT",
      };
    }
    return procesarRutValidoDtmf(callSid, rutValidado);
  }

  if (step === "INICIO") {
    if (cleanDigits === "1") {
      updateIvrSession(callSid, { step: "ESPERANDO_RUT", intentCancelacion: false });
      return {
        replyText:
          "Para pedir su hora médica, marque los números de su RUT seguidos de numeral, usando asterisco o cero si termina en ka.",
        shouldHangup: false,
        engineUsed: "fast_confirmation",
        expectedInput: "rut",
        step: "ESPERANDO_RUT",
      };
    }
    if (cleanDigits === "2") {
      updateIvrSession(callSid, { step: "ESPERANDO_RUT", intentCancelacion: true });
      return {
        replyText:
          "Para anular su hora médica, marque su RUT seguido de numeral, usando asterisco o cero si termina en ka.",
        shouldHangup: false,
        engineUsed: "fast_confirmation",
        expectedInput: "rut",
        step: "ESPERANDO_RUT",
      };
    }
    return {
      replyText:
        "Opción no válida. Presione 1 para pedir una hora, 2 para anular una cita, o 9 para repetir.",
      shouldHangup: false,
      engineUsed: "local_fallback",
      expectedInput: "open",
      step: "INICIO",
    };
  }

  if (step === "ESPERANDO_RUT") {
    return {
      replyText:
        "Faltaron dígitos para completar su RUT. Por favor marque su RUT completo con dígito verificador y luego numeral.",
      shouldHangup: false,
      engineUsed: "local_fallback",
      expectedInput: "rut",
      step: "ESPERANDO_RUT",
    };
  }

  if (step === "ESPERANDO_ESPECIALIDAD") {
    const mapEsp: Record<string, Especialidad> = {
      "1": Especialidad.MEDICINA_GENERAL,
      "2": Especialidad.DENTAL,
      "3": Especialidad.MATRONERIA,
    };
    const esp = mapEsp[cleanDigits];
    if (!esp) {
      return {
        replyText: promptMenuEspecialidad("", true),
        shouldHangup: false,
        engineUsed: "local_fallback",
        expectedInput: "menu",
        step: "ESPERANDO_ESPECIALIDAD",
      };
    }

    updateIvrSession(callSid, { especialidad: esp, especialidadConfirmada: true });
    const rut = session.rut || "21758467-1";

    if (session.horaSolicitada) {
      return resolverHoraDirectaPorVoz(
        callSid,
        rut,
        session.horaSolicitada,
        esp,
        "fast_confirmation"
      );
    }

    const dupCheck = await verificarOAgendarPorVoz(rut, undefined, esp, getSmsContext(session));
    if (dupCheck.status === "CITA_DUPLICADA") {
      guardarPendienteReagendamientoSession(callSid, dupCheck);
      return {
        replyText: construirMensajeCitaDuplicada(dupCheck, true),
        shouldHangup: !dupCheck.bloqueReagendarId,
        engineUsed: "local_fallback",
        expectedInput: dupCheck.bloqueReagendarId ? "confirmation" : undefined,
        step: dupCheck.bloqueReagendarId ? "CONFIRMANDO_REAGENDAMIENTO" : "COMPLETADO",
        reservaData: dupCheck,
      };
    }

    if (session.franjaSeleccionada) {
      return resolverOpcionesFranja(callSid, rut, esp, session.franjaSeleccionada, "fast_confirmation");
    }

    updateIvrSession(callSid, { step: "ESPERANDO_FRANJA" });
    return {
      replyText: promptMenuFranjas(nombreEspecialidadLegible(esp), true),
      shouldHangup: false,
      engineUsed: "fast_confirmation",
      expectedInput: "menu",
      step: "ESPERANDO_FRANJA",
    };
  }

  if (step === "ESPERANDO_FRANJA") {
    const mapFranja: Record<string, IvrFranja> = {
      "1": "MANANA",
      "2": "MEDIA_MANANA",
      "3": "TARDE",
      "4": "PRIMERA_DISPONIBLE",
    };
    const franja = mapFranja[cleanDigits];
    if (!franja) {
      return {
        replyText:
          "Opción no válida. Presione 1 para mañana temprano, 2 para media mañana, 3 para la tarde, o 4 para la primera hora disponible.",
        shouldHangup: false,
        engineUsed: "local_fallback",
        expectedInput: "menu",
        step: "ESPERANDO_FRANJA",
      };
    }
    return resolverOpcionesFranja(
      callSid,
      session.rut || "21758467-1",
      session.especialidad,
      franja,
      "fast_confirmation"
    );
  }

  if (step === "ELIGIENDO_HORA_FRANJA") {
    if (cleanDigits === "0") {
      updateIvrSession(callSid, { step: "ESPERANDO_FRANJA", opcionesFranja: undefined });
      return {
        replyText: promptMenuFranjas(
          nombreEspecialidadLegible(session.especialidad || Especialidad.MEDICINA_GENERAL),
          true
        ),
        shouldHangup: false,
        engineUsed: "fast_confirmation",
        expectedInput: "menu",
        step: "ESPERANDO_FRANJA",
      };
    }

    const idx = parseInt(cleanDigits, 10) - 1;
    const opciones = session.opcionesFranja || [];
    const opcion = !isNaN(idx) && idx >= 0 && idx < opciones.length ? opciones[idx] : undefined;

    if (!opcion) {
      const lista = opciones.map((o, i) => `presione ${i + 1} para las ${o.hora}`).join(", ");
      return {
        replyText: `Opción no válida. ${lista}, o presione 0 para elegir otra franja.`,
        shouldHangup: false,
        engineUsed: "local_fallback",
        expectedInput: "menu",
        step: "ELIGIENDO_HORA_FRANJA",
      };
    }

    try {
      return await confirmarBloqueYResponder(
        callSid,
        opcion.bloqueId,
        session.rut || "21758467-1",
        "fast_confirmation"
      );
    } catch {
      updateIvrSession(callSid, { step: "ESPERANDO_FRANJA", opcionesFranja: undefined });
      return {
        replyText:
          "Ese bloque acaba de ser reservado. Presione 1 para mañana temprano, 2 para media mañana, 3 para la tarde o 4 para primera disponible.",
        shouldHangup: false,
        engineUsed: "local_fallback",
        expectedInput: "menu",
        step: "ESPERANDO_FRANJA",
      };
    }
  }

  if (step === "CONFIRMANDO_SUGERENCIA") {
    const rut = session.rut || "21758467-1";
    let bloqueId: string | undefined;

    if (cleanDigits === "1") {
      bloqueId = session.bloqueSugeridoAntesId || session.bloqueSugeridoId;
    } else if (cleanDigits === "2") {
      if (session.bloqueSugeridoDespuesId) {
        bloqueId = session.bloqueSugeridoDespuesId;
      } else {
        updateIvrSession(callSid, { step: "ESPERANDO_FRANJA", horaSolicitada: undefined });
        return {
          replyText: promptMenuFranjas(
            nombreEspecialidadLegible(session.especialidad || Especialidad.MEDICINA_GENERAL),
            true
          ),
          shouldHangup: false,
          engineUsed: "fast_confirmation",
          expectedInput: "menu",
          step: "ESPERANDO_FRANJA",
        };
      }
    }

    if (bloqueId) {
      try {
        return await confirmarBloqueYResponder(callSid, bloqueId, rut, "fast_confirmation");
      } catch {
        return {
          replyText: "El horario sugerido acaba de ocuparse. Por favor intente con otra hora.",
          shouldHangup: true,
          engineUsed: "local_fallback",
          step: "COMPLETADO",
        };
      }
    }

    return {
      replyText: session.ultimoMensajeBot || "Por favor presione 1 o 2 para continuar.",
      shouldHangup: false,
      engineUsed: "local_fallback",
      expectedInput: "confirmation",
      step: "CONFIRMANDO_SUGERENCIA",
    };
  }

  if (step === "CONFIRMANDO_REAGENDAMIENTO") {
    if (cleanDigits === "1") {
      const res = await resolverPendienteReagendamiento(callSid, session, "sí");
      if (res) return res;
    }
    if (cleanDigits === "2") {
      const res = await resolverPendienteReagendamiento(callSid, session, "no");
      if (res) return res;
    }
    return {
      replyText: "Por favor presione 1 para anular y reagendar, o 2 para mantener su hora actual.",
      shouldHangup: false,
      engineUsed: "local_fallback",
      expectedInput: "confirmation",
      step: "CONFIRMANDO_REAGENDAMIENTO",
    };
  }

  // COMPLETADO con cualquier tecla distinta de 9 -> despedida amable
  return {
    replyText: "Gracias por comunicarse con CESFAM MallaSalud. ¡Que tenga un excelente día!",
    shouldHangup: true,
    engineUsed: "fast_confirmation",
    step: "COMPLETADO",
  };
}

// ====================================================================
// CONFIGURACIÓN DE GEMINI Y NLU HÍBRIDO PARA VOZ EN ESPAÑOL CHILENO
// ====================================================================

const SYSTEM_PROMPT = `Eres la recepcionista telefónica virtual de CESFAM MallaSalud en Chile.
Tu misión es atender a pacientes, en especial adultos mayores o personas con dificultades de habla/rotacismo o acentos variados, con un tono respetuoso, claro, pausado y en español chileno natural.
Tus respuestas serán leídas por Text-to-Speech en una llamada telefónica real: sé breve (máximo 2 oraciones), sin asteriscos ni markdown.

REGLAS INSTITUCIONALES OBLIGATORIAS:
1. Tolerancia fonética y memoria de sesión: si Twilio transcribió "router", "root" o "lut" se refiere a RUT; "taide" o "talde" es tarde; "matlona" o "matloneria" es Matronería. NUNCA reinicies la conversación ni olvides la hora o especialidad ya pedida en turnos anteriores.
2. EXTRACCIÓN DE RUT CHILENO: Extrae el RUT chileno limpio (ej: 21758467-1 o 5842319-K). NUNCA mezcles los números de la hora ("a las 10") con el RUT.
3. Si el paciente NO está inscrito en el padrón, derívalo amablemente a ventanilla SOME del CESFAM con su cédula.
4. Si ya tiene una cita médica agendada hoy, explícale que solo se permite una por día y ofrece anular la anterior para reagendar en el nuevo horario disponible.
5. Si no especificó especialidad, pregunta entre Medicina General, Urgencia Dental o Matronería.
6. Si la hora pedida está ocupada, informa las dos alternativas disponibles (antes y después) y pregunta cuál prefiere.
7. Esta llamada es 100% por voz: NUNCA menciones botones, teclas, presionar números, teclado, numeral ni asterisco.`;

function getGeminiApiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

const AGENT_TOOLS: any = [
  {
    functionDeclarations: [
      {
        name: "intentarAgendarHora",
        description:
          "Verifica el RUT, especialidad y hora médica del paciente en el sistema del CESFAM.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            rut: {
              type: Type.STRING,
              description: "RUT chileno del paciente, ej: 21758467-1 o 5842319-K",
            },
            hora: {
              type: Type.STRING,
              description: "Hora deseada en formato 24h HH:mm, ej: 10:00 o 11:30",
            },
            especialidad: {
              type: Type.STRING,
              description: "MEDICINA_GENERAL, DENTAL o MATRONERIA",
            },
          },
          required: ["rut"],
        },
      },
      {
        name: "confirmarHoraSugerida",
        description:
          "Confirma la reserva de la hora alternativa propuesta cuando el paciente la acepta.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            rut: {
              type: Type.STRING,
              description: "RUT chileno del paciente",
            },
          },
          required: ["rut"],
        },
      },
    ],
  },
];

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMsg)), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function intentarConGemini(
  callSid: string,
  userSpeech: string
): Promise<VoiceAgentResult | null> {
  const session = getOrCreateIvrSession(callSid);
  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) return null;

  for (const apiKey of apiKeys) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const historyText = session.transcript
        .slice(-4)
        .map((m) => `${m.speaker === "user" ? "Paciente" : "Recepcionista"}: ${m.text}`)
        .join("\n");

      const prompt = `Contexto de la llamada telefónica en CESFAM MallaSalud:
${historyText}

Paciente acaba de decir: "${userSpeech}"
${session.step ? `(Paso actual: ${session.step})` : ""}
${session.rut ? `(RUT identificado: ${session.rut})` : ""}
${session.rutParcial ? `(Dígitos parciales acumulados de RUT: ${session.rutParcial})` : ""}
${session.pacienteNombre ? `(Nombre paciente: ${session.pacienteNombre})` : ""}
${session.esAdultoMayor ? `(Es adulto mayor: Sí)` : ""}
${session.horaSolicitada ? `(Hora ya solicitada en turno previo: ${session.horaSolicitada})` : ""}
${session.franjaSeleccionada ? `(Franja solicitada: ${session.franjaSeleccionada})` : ""}
${session.horaSugerida ? `(Hora sugerida pendiente: ${session.horaSugerida}, bloqueId: ${session.bloqueSugeridoId})` : ""}
${session.citaExistenteId ? `(Tiene cita previa a las ${session.horaExistente} y reagendamiento pendiente a las ${session.horaReagendar})` : ""}
${session.especialidad ? `(Especialidad actual: ${session.especialidad})` : ""}
`;

      const resp = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: AGENT_TOOLS,
        },
      });

      const fnCall = resp.functionCalls?.[0];

      if (fnCall) {
        const fnName = fnCall.name;
        const args = (fnCall.args || {}) as Record<string, string>;

        if (fnName === "intentarAgendarHora") {
          const rawRut = args.rut || session.rut || "";
          const rut = normalizarRut(rawRut) || rawRut;
          const rawHora = args.hora || session.horaSolicitada || "";
          const hora = normalizarHora(rawHora, rut) || rawHora;
          const esp =
            detectarEspecialidad(args.especialidad || userSpeech) ||
            session.especialidad ||
            Especialidad.MEDICINA_GENERAL;

          if (rut) updateIvrSession(callSid, { rut });

          if (rut && hora) {
            return resolverHoraDirectaPorVoz(callSid, rut, hora, esp, "gemini");
          }

          if (rut && !hora) {
            const verif = await verificarOAgendarPorVoz(rut, undefined, esp, getSmsContext(session));
            if (verif.status === "NO_INSCRITO") {
              updateIvrSession(callSid, { step: "COMPLETADO", estadoCita: "NO_INSCRITO" });
              return {
                replyText: `El RUT ${rut} no se encuentra inscrito en el CESFAM. Debe acercarse presencialmente a la ventanilla SOME con su cédula de identidad para realizar su inscripción.`,
                shouldHangup: true,
                engineUsed: "gemini",
                step: "COMPLETADO",
                reservaData: verif,
              };
            }
            if (verif.status === "CITA_DUPLICADA") {
              guardarPendienteReagendamientoSession(callSid, verif);
              return {
                replyText: construirMensajeCitaDuplicada(verif, false),
                shouldHangup: !verif.bloqueReagendarId,
                engineUsed: "gemini",
                expectedInput: verif.bloqueReagendarId ? "confirmation" : undefined,
                step: verif.bloqueReagendarId ? "CONFIRMANDO_REAGENDAMIENTO" : "COMPLETADO",
                reservaData: verif,
              };
            }
            updateIvrSession(callSid, {
              step: "ESPERANDO_FRANJA",
              pacienteNombre: verif.pacienteNombre,
              esAdultoMayor: verif.esAdultoMayor,
              especialidad: esp,
            });
            return {
              replyText: `Gracias ${formatVocativo(verif.pacienteNombre, verif.esAdultoMayor)}. ${promptMenuFranjas(nombreEspecialidadLegible(esp), false)}`,
              shouldHangup: false,
              engineUsed: "gemini",
              expectedInput: "menu",
              step: "ESPERANDO_FRANJA",
            };
          }
        }

        if (fnName === "confirmarHoraSugerida") {
          const rut = args.rut || session.rut || "21758467-1";
          const bloqueId =
            seleccionarBloqueAlternativo(session, userSpeech) || session.bloqueSugeridoId;

          if (bloqueId) {
            return confirmarBloqueYResponder(callSid, bloqueId, rut, "gemini");
          }
        }
      }

      const replyText = resp.text ? resp.text.replace(/[*#_~`]/g, "").trim() : "";
      if (replyText) {
        return {
          replyText,
          shouldHangup: false,
          engineUsed: "gemini",
          expectedInput: stepToExpectedInput(session.step),
          step: session.step,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

// ====================================================================
// MOTOR NLU LOCAL HÍBRIDO (< 10ms) CON MEMORIA DE SESIÓN COMPLETA
// ====================================================================

async function procesarConNluHibridoLocal(
  callSid: string,
  userSpeech: string
): Promise<VoiceAgentResult | null> {
  const session = getOrCreateIvrSession(callSid);
  const raw = normalizarPlano(userSpeech);

  // 1. Extracción de RUT completo o acumulación de dígitos parciales
  let rutDetectado = normalizarRut(userSpeech);
  let soloFragmentoParcial = "";

  if (!rutDetectado && !session.rut) {
    const frag = extraerFragmentoNumericoRut(userSpeech, session.rutParcial ? 1 : 2);
    if (frag) {
      const combinado = `${session.rutParcial || ""}${frag}`;
      if (combinado.length >= 7 && combinado.length <= 9) {
        const candidato = `${combinado.slice(0, -1)}-${combinado.slice(-1)}`;
        if (validarRut(candidato)) {
          rutDetectado = formatearRut(candidato).replace(/\./g, "");
          updateIvrSession(callSid, { rutParcial: undefined });
        } else if (combinado.length < 9) {
          soloFragmentoParcial = combinado;
        } else {
          updateIvrSession(callSid, { rutParcial: undefined });
        }
      } else if (combinado.length < 7) {
        soloFragmentoParcial = combinado;
      } else {
        updateIvrSession(callSid, { rutParcial: undefined });
      }
    }
  }

  // 2. Especialidad y Franja por voz (incluyendo opciones numeradas dictadas en voz alta)
  let espDetectada = detectarEspecialidad(userSpeech);
  if (!espDetectada && session.step === "ESPERANDO_ESPECIALIDAD") {
    if (/\b(uno|1|primera|medicina|general)\b/i.test(raw)) espDetectada = Especialidad.MEDICINA_GENERAL;
    else if (/\b(dos|2|segunda|dental|dentista)\b/i.test(raw)) espDetectada = Especialidad.DENTAL;
    else if (/\b(tres|3|tercera|matrona|matroneria)\b/i.test(raw)) espDetectada = Especialidad.MATRONERIA;
  }

  const contieneMarcadorHora = /:|(?:a|para)\s+las?|mañana|manana|tarde|media|cuarto|hora|\bam\b|\bpm\b/i.test(
    userSpeech
  );
  const horaDetectada =
    session.step === "ESPERANDO_RUT" && !contieneMarcadorHora
      ? ""
      : normalizarHora(userSpeech, rutDetectado || session.rut);
  let franjaDetectada = !horaDetectada ? detectarFranja(userSpeech) : null;
  if (!franjaDetectada && session.step === "ESPERANDO_FRANJA") {
    if (/\b(uno|1)\b/i.test(raw)) franjaDetectada = "MANANA";
    else if (/\b(dos|2)\b/i.test(raw)) franjaDetectada = "MEDIA_MANANA";
    else if (/\b(tres|3)\b/i.test(raw)) franjaDetectada = "TARDE";
    else if (/\b(cuatro|4)\b/i.test(raw)) franjaDetectada = "PRIMERA_DISPONIBLE";
  }

  if (rutDetectado) updateIvrSession(callSid, { rut: rutDetectado, rutParcial: undefined });
  if (espDetectada) updateIvrSession(callSid, { especialidad: espDetectada, especialidadConfirmada: true });
  if (horaDetectada) updateIvrSession(callSid, { horaSolicitada: horaDetectada });
  if (franjaDetectada) updateIvrSession(callSid, { franjaSeleccionada: franjaDetectada });

  const rutFinal = rutDetectado || session.rut;
  const horaFinal = horaDetectada || session.horaSolicitada;
  const espFinal = espDetectada || session.especialidad;
  const franjaFinal = franjaDetectada || session.franjaSeleccionada;

  // Caso especial: cortó a mitad del dictado del RUT (ej. "21.758")
  if (soloFragmentoParcial && !rutFinal) {
    updateIvrSession(callSid, { step: "ESPERANDO_RUT", rutParcial: soloFragmentoParcial });
    return {
      replyText: `Escuché los dígitos ${soloFragmentoParcial}. Por favor dígame con calma los dígitos que faltan de su RUT.`,
      shouldHangup: false,
      engineUsed: "local_fallback",
      expectedInput: "rut",
      step: "ESPERANDO_RUT",
    };
  }

  // A) Si tenemos RUT y hora exacta (ej: "11:00" acumulada de turno previo) -> resolver directo
  if (rutFinal && horaFinal) {
    return resolverHoraDirectaPorVoz(
      callSid,
      rutFinal,
      horaFinal,
      espFinal,
      "local_fallback"
    );
  }

  // B) Si tenemos RUT y franja horaria (ej: "en la tarde", "media mañana") -> listar opciones
  if (rutFinal && franjaFinal) {
    return resolverOpcionesFranja(
      callSid,
      rutFinal,
      espFinal,
      franjaFinal,
      "local_fallback"
    );
  }

  // C) Si tenemos RUT (y quizá especialidad) pero sin hora ni franja
  if (rutDetectado || (rutFinal && (espDetectada || session.step === "ESPERANDO_ESPECIALIDAD"))) {
    const resVerif = await verificarOAgendarPorVoz(
      rutFinal!,
      undefined,
      espFinal,
      getSmsContext(session)
    );
    if (resVerif.status === "NO_INSCRITO") {
      updateIvrSession(callSid, { step: "COMPLETADO", estadoCita: "NO_INSCRITO", status: "completed" });
      return {
        replyText: `El RUT ${resVerif.rut} no se encuentra inscrito en el CESFAM. Debe acercarse presencialmente a la ventanilla SOME con su cédula de identidad para inscribirse.`,
        shouldHangup: true,
        engineUsed: "local_fallback",
        step: "COMPLETADO",
        reservaData: resVerif,
      };
    }

    if (resVerif.status === "CITA_DUPLICADA" && (espDetectada || session.especialidadConfirmada)) {
      guardarPendienteReagendamientoSession(callSid, resVerif);
      return {
        replyText: construirMensajeCitaDuplicada(resVerif, false),
        shouldHangup: !resVerif.bloqueReagendarId,
        engineUsed: "local_fallback",
        expectedInput: resVerif.bloqueReagendarId ? "confirmation" : undefined,
        step: resVerif.bloqueReagendarId ? "CONFIRMANDO_REAGENDAMIENTO" : "COMPLETADO",
        reservaData: resVerif,
      };
    }

    updateIvrSession(callSid, {
      pacienteNombre: resVerif.pacienteNombre,
      esAdultoMayor: resVerif.esAdultoMayor,
    });

    const vocativo = formatVocativo(resVerif.pacienteNombre, resVerif.esAdultoMayor);

    if (espDetectada || session.especialidadConfirmada) {
      updateIvrSession(callSid, { step: "ESPERANDO_FRANJA" });
      const nombreEsp = nombreEspecialidadLegible(espFinal || Especialidad.MEDICINA_GENERAL);
      return {
        replyText: `Muchas gracias ${vocativo}. ${promptMenuFranjas(nombreEsp, false)}`,
        shouldHangup: false,
        engineUsed: "local_fallback",
        expectedInput: "menu",
        step: "ESPERANDO_FRANJA",
      };
    }

    updateIvrSession(callSid, { step: "ESPERANDO_ESPECIALIDAD" });
    return {
      replyText: promptMenuEspecialidad(vocativo, false),
      shouldHangup: false,
      engineUsed: "local_fallback",
      expectedInput: "menu",
      step: "ESPERANDO_ESPECIALIDAD",
    };
  }

  // D) Si indicó hora, franja o especialidad pero todavía falta su RUT
  if ((horaFinal || franjaFinal || espDetectada) && !rutFinal) {
    updateIvrSession(callSid, { step: "ESPERANDO_RUT" });
    const prefijo = horaFinal
      ? `Perfecto, para las ${horaFinal}. `
      : franjaFinal
      ? `Entendido, para ${nombreFranjaLegible(franjaFinal)}. `
      : espDetectada
      ? `Perfecto, para ${nombreEspecialidadLegible(espDetectada)}. `
      : "";
    return {
      replyText: `${prefijo}Por favor dígame su RUT completo con su dígito verificador.`,
      shouldHangup: false,
      engineUsed: "local_fallback",
      expectedInput: "rut",
      step: "ESPERANDO_RUT",
    };
  }

  return null;
}

// ====================================================================
// ORQUESTADOR HÍBRIDO PRINCIPAL (VOZ + TECLADO DTMF)
// ====================================================================

export async function procesarTurnoIvr(
  callSid: string,
  input: { speech?: string; digits?: string }
): Promise<VoiceAgentResult> {
  const session = getOrCreateIvrSession(callSid);

  const finalizar = (res: VoiceAgentResult): VoiceAgentResult => {
    const nextStep = res.step || session.step || "INICIO";
    updateIvrSession(callSid, {
      step: nextStep,
      ultimoMensajeBot: res.replyText,
    });
    addIvrTranscriptEntry(callSid, "bot", res.replyText);
    return {
      ...res,
      step: nextStep,
      expectedInput: res.expectedInput || stepToExpectedInput(nextStep),
    };
  };

  // 1. Entrada por teclado telefónico DTMF
  const digits = (input.digits || "").trim();
  if (digits) {
    addIvrTranscriptEntry(callSid, "user", `[Teclado] ${digits}`);
    const dtmfRes = await procesarConTecladoDtmf(callSid, digits);
    return finalizar(dtmfRes);
  }

  // 2. Entrada por voz
  updateIvrSession(callSid, { modoInteraccion: "VOZ", modoTeclado: false });
  const userSpeech = (input.speech || "").trim();
  addIvrTranscriptEntry(callSid, "user", userSpeech);

  // 2.1 Repetición solicitada explícitamente por el paciente ("puede repetir?")
  if (esSolicitudRepeticion(userSpeech) && session.ultimoMensajeBot) {
    const rutCompleto = normalizarRut(userSpeech);
    if (!rutCompleto) {
      const replyRep =
        session.step === "INICIO"
          ? "Con gusto le repito: por favor dígame su RUT y la hora o especialidad médica que necesita."
          : session.ultimoMensajeBot;
      return finalizar({
        replyText: replyRep,
        shouldHangup: false,
        engineUsed: "fast_confirmation",
        expectedInput: stepToExpectedInput(session.step),
        step: session.step,
      });
    }
  }

  // 2.2 Elección por voz dentro del menú de horas de una franja
  const franjaElegida = await resolverEleccionFranjaPorVoz(callSid, session, userSpeech);
  if (franjaElegida) {
    return finalizar(franjaElegida);
  }

  // 2.3 Resolución inmediata de reagendamiento tras cita duplicada (< 10ms)
  try {
    const reagendado = await resolverPendienteReagendamiento(callSid, session, userSpeech);
    if (reagendado) {
      return finalizar(reagendado);
    }
  } catch {
    // Continuar a otros flujos
  }

  // 2.4 Confirmación afirmativa o elección de hora sugerida (< 10ms)
  const bloqueElegido = seleccionarBloqueAlternativo(session, userSpeech);
  if (bloqueElegido) {
    const rut = session.rut || "21758467-1";
    try {
      const conf = await confirmarBloqueYResponder(callSid, bloqueElegido, rut, "fast_confirmation");
      return finalizar(conf);
    } catch {
      // Continuar a fallback
    }
  }

  // 2.5 Cancelación oportuna directa por voz (< 10ms)
  if (
    !session.citaExistenteId &&
    !session.horaSugerida &&
    (esIntencionCancelacion(userSpeech) || session.intentCancelacion)
  ) {
    let rutDetectado = normalizarRut(userSpeech);
    if (!rutDetectado && !session.rut) {
      const frag = extraerFragmentoNumericoRut(userSpeech);
      if (frag) {
        const combinado = `${session.rutParcial || ""}${frag}`;
        if (combinado.length >= 7 && combinado.length <= 9) {
          const cand = `${combinado.slice(0, -1)}-${combinado.slice(-1)}`;
          if (validarRut(cand)) {
            rutDetectado = formatearRut(cand).replace(/\./g, "");
            updateIvrSession(callSid, { rutParcial: undefined });
          } else {
            updateIvrSession(callSid, { rutParcial: combinado, step: "ESPERANDO_RUT", intentCancelacion: true });
            return finalizar({
              replyText: `Escuché los dígitos ${combinado}. Por favor dígame con calma los dígitos que faltan de su RUT.`,
              shouldHangup: false,
              engineUsed: "local_fallback",
              expectedInput: "rut",
              step: "ESPERANDO_RUT",
            });
          }
        } else {
          updateIvrSession(callSid, { rutParcial: combinado, step: "ESPERANDO_RUT", intentCancelacion: true });
          return finalizar({
            replyText: `Escuché los dígitos ${combinado}. Por favor dígame con calma los dígitos que faltan de su RUT.`,
            shouldHangup: false,
            engineUsed: "local_fallback",
            expectedInput: "rut",
            step: "ESPERANDO_RUT",
          });
        }
      }
    }

    const rutCancel = rutDetectado || session.rut;
    const espDetectada = detectarEspecialidad(userSpeech) || session.especialidad;
    if (!rutCancel) {
      updateIvrSession(callSid, { intentCancelacion: true, step: "ESPERANDO_RUT" });
      return finalizar({
        replyText:
          "Con mucho gusto le ayudo a anular su cita. Por favor dígame su RUT completo.",
        shouldHangup: false,
        engineUsed: "local_fallback",
        expectedInput: "rut",
        step: "ESPERANDO_RUT",
      });
    }
    const cancelRes = await manejarSolicitudCancelacionVoz(callSid, rutCancel, espDetectada);
    return finalizar(cancelRes);
  }

  // 3. Motor NLU local rápido con memoria y acumulación de RUT parcial
  const nluResult = await procesarConNluHibridoLocal(callSid, userSpeech);
  if (nluResult) {
    return finalizar(nluResult);
  }

  // 4. Si el habla libre no coincidió con reglas locales, usar Gemini 2.5 con contexto de sesión
  try {
    const geminiResult = await withTimeout(
      intentarConGemini(callSid, userSpeech),
      2800,
      "Timeout telefónico de Gemini"
    );
    if (geminiResult) {
      return finalizar(geminiResult);
    }
  } catch {
    // Continuar a guía contextual sin perder el estado previo
  }

  // 5. Guía contextual sin reiniciar la sesión ni olvidar datos previos
  if (session.step === "ESPERANDO_RUT" || session.horaSolicitada || session.franjaSeleccionada) {
    updateIvrSession(callSid, { step: "ESPERANDO_RUT" });
    return finalizar({
      replyText:
        "No logré captar bien su RUT. Por favor dígamelo pausadamente, dígito a dígito, incluyendo el dígito verificador.",
      shouldHangup: false,
      engineUsed: "local_fallback",
      expectedInput: "rut",
      step: "ESPERANDO_RUT",
    });
  }

  if (session.step === "ESPERANDO_ESPECIALIDAD" && session.rut) {
    return finalizar({
      replyText: promptMenuEspecialidad("", false),
      shouldHangup: false,
      engineUsed: "local_fallback",
      expectedInput: "menu",
      step: "ESPERANDO_ESPECIALIDAD",
    });
  }

  if (session.step === "ESPERANDO_FRANJA" && session.rut) {
    return finalizar({
      replyText: promptMenuFranjas(
        nombreEspecialidadLegible(session.especialidad || Especialidad.MEDICINA_GENERAL),
        false
      ),
      shouldHangup: false,
      engineUsed: "local_fallback",
      expectedInput: "menu",
      step: "ESPERANDO_FRANJA",
    });
  }

  return finalizar({
    replyText:
      "Disculpe, no logré entenderle bien. Por favor dígame su RUT y la hora o especialidad médica que necesita.",
    shouldHangup: false,
    engineUsed: "local_fallback",
    expectedInput: "open",
    step: "INICIO",
  });
}

export async function procesarTurnoVoz(
  callSid: string,
  userSpeech: string
): Promise<VoiceAgentResult> {
  return procesarTurnoIvr(callSid, { speech: userSpeech });
}
