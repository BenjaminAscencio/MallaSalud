// src/lib/ivr/voiceAgent.ts

import { GoogleGenAI, Type } from "@google/genai";
import {
  normalizarRut,
  normalizarHora,
  detectarEspecialidad,
  nombreEspecialidadLegible,
  verificarOAgendarPorVoz,
  confirmarBloqueSugeridoPorVoz,
} from "./ivrScheduleService";
import {
  IvrCallSession,
  IvrTranscriptEntry,
  VoiceAgentResult,
} from "./types";
import { Especialidad } from "@prisma/client";

// ====================================================================
// MEMORIA DE SESIÓN EN globalThis INDEXADA POR CallSid
// ====================================================================

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

// ====================================================================
// RECONOCIMIENTO INSTANTÁNEO DE AFIRMACIÓN EN ESPAÑOL CHILENO (<10ms)
// ====================================================================

export function esAceptacionOConfirmacion(text: string): boolean {
  if (!text) return false;
  const raw = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;!?¿¡]/g, " ")
    .trim();

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

// ====================================================================
// CONFIGURACIÓN DE GEMINI Y NLU LOCAL PARA ADULTO MAYOR
// ====================================================================

const SYSTEM_PROMPT = `Eres la recepcionista telefónica virtual de CESFAM MallaSalud en Chile.
Tu misión es atender a pacientes, en especial adultos mayores, con un tono muy respetuoso, claro, pausado, empático y en español chileno natural.
Tus respuestas serán leídas por Text-to-Speech en una llamada telefónica real, por lo que deben ser breves (máximo 2 oraciones), sin asteriscos, sin markdown y con pronunciación clara.

REGLAS INSTITUCIONALES OBLIGATORIAS:
1. Pide siempre el RUT del paciente y la hora que necesita.
2. EXTRACCIÓN DE RUT CHILENO: Extrae el RUT chileno limpio (ej: 5555555-5 o 21111111-1). Si el paciente lo dicta con palabras de millones o ceros de transcripción (ej: "5 000 555 000 5555"), limpia los ceros para formar el RUT correcto 5555555-5. NUNCA mezcles los números de la hora ("a las 10") con el RUT.
3. Si el paciente NO está inscrito en el padrón, indícale amablemente que debe acudir presencialmente a la ventanilla SOME del CESFAM con su cédula de identidad para inscribirse.
4. Si el paciente ya tiene una cita médica agendada para hoy, recuérdale que la normativa del CESFAM solo permite una cita activa por especialidad al día.
5. Si no especifica si busca Medicina General, Dental o Matronería, pregúntale para qué especialidad necesita la atención.
6. Si la hora pedida está ocupada, infórmale con cariño la hora disponible más cercana y pregúntale si desea tomarla.
7. Al confirmar, indícale su RUT, la hora y el código de reserva de su comprobante, deseándole un excelente día.`;

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
              description: "RUT chileno del paciente, ej: 21111111-1 o 5555555-5",
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

// ====================================================================
// MOTOR NLU LOCAL (< 5ms) CON TODAS LAS REGLAS DE MALLASALUD
// ====================================================================

async function procesarConFallbackLocal(
  callSid: string,
  userSpeech: string
): Promise<VoiceAgentResult> {
  const session = getOrCreateIvrSession(callSid);

  // 1. Confirmación de hora sugerida pendiente (< 10ms)
  if (esAceptacionOConfirmacion(userSpeech) && session.bloqueSugeridoId) {
    const rut = session.rut || "21111111-1";
    try {
      const res = await confirmarBloqueSugeridoPorVoz(session.bloqueSugeridoId, rut);

      updateIvrSession(callSid, {
        estadoCita: "AGENDADO",
        horaSugerida: undefined,
        bloqueSugeridoId: undefined,
        codigoReserva: res.codigoReserva,
      });

      const vocativo = res.esAdultoMayor ? `Don o Señora ${res.pacienteNombre}` : res.pacienteNombre;
      const replyText = `Perfecto ${vocativo}, su cita para el RUT ${res.rut} ha quedado confirmada a las ${res.horaConfirmada} en ${res.especialidadNombre} con código ${res.codigoReserva}. ¡Que tenga un muy buen día!`;

      return {
        replyText,
        shouldHangup: true,
        engineUsed: "fast_confirmation",
        reservaData: res,
      };
    } catch (err: any) {
      return {
        replyText:
          "Lo lamento, hubo un inconveniente al confirmar su hora médica. Por favor intente llamar nuevamente.",
        shouldHangup: true,
        engineUsed: "local_fallback",
      };
    }
  }

  // 2. Extraer entidades habladas
  const rutDetectado = normalizarRut(userSpeech);
  const horaDetectada = normalizarHora(userSpeech, rutDetectado || session.rut);
  const espDetectada = detectarEspecialidad(userSpeech);

  const rutFinal = rutDetectado || session.rut;
  const espFinal = espDetectada || session.especialidad || Especialidad.MEDICINA_GENERAL;

  if (rutDetectado) updateIvrSession(callSid, { rut: rutDetectado });
  if (espDetectada) updateIvrSession(callSid, { especialidad: espDetectada });

  // Si tenemos RUT y Hora, procesar evaluación con reglas completas de negocio
  if (rutFinal && horaDetectada) {
    const res = await verificarOAgendarPorVoz(rutFinal, horaDetectada, espFinal);

    // REGLA 1: PACIENTE NO INSCRITO EN PADRÓN -> DERIVAR A VENTANILLA SOME
    if (res.status === "NO_INSCRITO") {
      updateIvrSession(callSid, { estadoCita: "NO_INSCRITO" });
      const replyText = `El RUT ${rutFinal} no se encuentra inscrito en nuestro centro de salud. Para solicitar horas médicas, debe acercarse presencialmente a la ventanilla SOME del CESFAM con su cédula de identidad para realizar su inscripción.`;
      return {
        replyText,
        shouldHangup: true,
        engineUsed: "local_fallback",
        reservaData: res,
      };
    }

    // REGLA 2: CITA DUPLICADA -> SOLO 1 CITA ACTIVA AL DÍA POR ESPECIALIDAD
    if (res.status === "CITA_DUPLICADA") {
      updateIvrSession(callSid, { estadoCita: "CITA_DUPLICADA" });
      const replyText = `Hola ${res.pacienteNombre}, ya tiene una cita agendada para hoy a las ${res.horaExistente} en ${res.especialidadNombre} con el ${res.profesionalNombre}. Por normativa del CESFAM, solo se permite una cita activa por especialidad al día.`;
      return {
        replyText,
        shouldHangup: true,
        engineUsed: "local_fallback",
        reservaData: res,
      };
    }

    // CASO AGENDADO DIRECTO (HORA ESTABA LIBRE)
    if (res.status === "AGENDADO") {
      updateIvrSession(callSid, {
        estadoCita: "AGENDADO",
        pacienteNombre: res.pacienteNombre,
        codigoReserva: res.codigoReserva,
      });

      const vocativo = res.esAdultoMayor ? `Don o Señora ${res.pacienteNombre}` : res.pacienteNombre;
      const replyText = `Perfecto ${vocativo}, su cita para el RUT ${res.rut} ha quedado agendada en el sistema a las ${res.horaConfirmada} en ${res.especialidadNombre} con código ${res.codigoReserva}. ¡Muchas gracias y que tenga un excelente día!`;

      return {
        replyText,
        shouldHangup: true,
        engineUsed: "local_fallback",
        reservaData: res,
      };
    }

    // CASO OCUPADO -> PROPONER HORA MÁS CERCANA
    if (res.status === "OCUPADO" && res.horaSugerida) {
      updateIvrSession(callSid, {
        horaSugerida: res.horaSugerida,
        horaSolicitada: res.horaSolicitada,
        bloqueSugeridoId: res.bloqueSugeridoId,
        pacienteNombre: res.pacienteNombre,
        profesionalNombre: res.profesionalNombre,
        especialidad: res.especialidad,
        esAdultoMayor: res.esAdultoMayor,
      });

      const vocativo = res.pacienteNombre ? `Hola ${res.pacienteNombre}, ` : "";
      const replyText = `${vocativo}la hora de las ${res.horaSolicitada} en ${res.especialidadNombre} ya está tomada, pero le puedo ofrecer a las ${res.horaSugerida} con el ${res.profesionalNombre}. ¿Le parece bien esta hora?`;

      return {
        replyText,
        shouldHangup: false,
        engineUsed: "local_fallback",
        reservaData: res,
      };
    }

    // CASO SIN DISPONIBILIDAD
    const replyText = `Lo lamento ${res.pacienteNombre || ""}, no nos quedan horas disponibles para hoy en ${res.especialidadNombre}.`;
    return {
      replyText,
      shouldHangup: true,
      engineUsed: "local_fallback",
      reservaData: res,
    };
  }

  // Si solo dio el RUT
  if (rutDetectado && !horaDetectada) {
    // Verificar si el paciente está en el padrón para saludarlo o rechazarlo inmediatamente
    const resVerif = await verificarOAgendarPorVoz(rutDetectado);
    if (resVerif.status === "NO_INSCRITO") {
      updateIvrSession(callSid, { estadoCita: "NO_INSCRITO" });
      const replyText = `El RUT ${rutDetectado} no se encuentra inscrito en el CESFAM. Debe acercarse presencialmente a la ventanilla SOME con su cédula de identidad para inscribirse.`;
      return {
        replyText,
        shouldHangup: true,
        engineUsed: "local_fallback",
        reservaData: resVerif,
      };
    }

    if (resVerif.status === "CITA_DUPLICADA") {
      updateIvrSession(callSid, { estadoCita: "CITA_DUPLICADA" });
      const replyText = `Hola ${resVerif.pacienteNombre}, ya tiene una cita agendada para hoy a las ${resVerif.horaExistente} en ${resVerif.especialidadNombre}. Solo se permite una hora médica al día.`;
      return {
        replyText,
        shouldHangup: true,
        engineUsed: "local_fallback",
        reservaData: resVerif,
      };
    }

    updateIvrSession(callSid, {
      pacienteNombre: resVerif.pacienteNombre,
      esAdultoMayor: resVerif.esAdultoMayor,
    });

    const vocativo = resVerif.esAdultoMayor ? `Don o Señora ${resVerif.pacienteNombre}` : resVerif.pacienteNombre;
    const preguntaEspecialidad = espDetectada
      ? `¿A qué hora necesita su cita de ${nombreEspecialidadLegible(espDetectada)}?`
      : `¿Para qué especialidad y a qué hora necesita su atención? Tenemos Medicina General, Dental y Matronería.`;

    const replyText = `Muchas gracias ${vocativo}. ${preguntaEspecialidad}`;
    return {
      replyText,
      shouldHangup: false,
      engineUsed: "local_fallback",
    };
  }

  // Si solo dio la hora pero no el RUT
  if (horaDetectada && !rutFinal) {
    updateIvrSession(callSid, { horaSolicitada: horaDetectada });
    const replyText = `Perfecto, para las ${horaDetectada}. Por favor indíqueme su RUT para verificar su registro en el centro de salud.`;
    return {
      replyText,
      shouldHangup: false,
      engineUsed: "local_fallback",
    };
  }

  // Si hay una hora sugerida esperando respuesta
  if (session.horaSugerida) {
    const replyText = `Le tengo disponible la hora de las ${session.horaSugerida}. ¿Desea confirmarla? Por favor dígame sí o no.`;
    return {
      replyText,
      shouldHangup: false,
      engineUsed: "local_fallback",
    };
  }

  return {
    replyText:
      "Hola, bienvenido al sistema telefónico de CESFAM MallaSalud. Por favor indíqueme su RUT y para qué especialidad u hora médica necesita su atención.",
    shouldHangup: false,
    engineUsed: "local_fallback",
  };
}

// ====================================================================
// EJECUCIÓN CON GEMINI Y TOOL CALLING (CON TIMEOUT ESTRICTO)
// ====================================================================

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
${session.rut ? `(RUT identificado: ${session.rut})` : ""}
${session.pacienteNombre ? `(Nombre paciente: ${session.pacienteNombre})` : ""}
${session.esAdultoMayor ? `(Es adulto mayor: Sí)` : ""}
${session.horaSugerida ? `(Hora sugerida pendiente: ${session.horaSugerida}, bloqueId: ${session.bloqueSugeridoId})` : ""}
${session.especialidad ? `(Especialidad: ${session.especialidad})` : ""}
`;

      const resp = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
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
          const rawHora = args.hora || "";
          const hora = normalizarHora(rawHora, rut) || rawHora;
          const esp = detectarEspecialidad(args.especialidad || userSpeech) || session.especialidad;

          if (rut) updateIvrSession(callSid, { rut });

          const res = await verificarOAgendarPorVoz(rut, hora, esp);

          if (res.status === "NO_INSCRITO") {
            updateIvrSession(callSid, { estadoCita: "NO_INSCRITO" });
            return {
              replyText: `El RUT ${rut} no se encuentra inscrito en el CESFAM. Debe acercarse presencialmente a la ventanilla SOME con su cédula de identidad para realizar su inscripción.`,
              shouldHangup: true,
              engineUsed: "gemini",
              reservaData: res,
            };
          }

          if (res.status === "CITA_DUPLICADA") {
            updateIvrSession(callSid, { estadoCita: "CITA_DUPLICADA" });
            return {
              replyText: `Hola ${res.pacienteNombre}, ya tiene una cita médica para hoy a las ${res.horaExistente} en ${res.especialidadNombre}. Solo se permite una cita al día por normativa del CESFAM.`,
              shouldHangup: true,
              engineUsed: "gemini",
              reservaData: res,
            };
          }

          if (res.status === "AGENDADO") {
            updateIvrSession(callSid, {
              estadoCita: "AGENDADO",
              pacienteNombre: res.pacienteNombre,
              codigoReserva: res.codigoReserva,
            });

            const vocativo = res.esAdultoMayor ? `Don o Señora ${res.pacienteNombre}` : res.pacienteNombre;
            return {
              replyText: `Perfecto ${vocativo}, su cita para el RUT ${res.rut} ha quedado agendada a las ${res.horaConfirmada} en ${res.especialidadNombre} con código ${res.codigoReserva}. ¡Que tenga un excelente día!`,
              shouldHangup: true,
              engineUsed: "gemini",
              reservaData: res,
            };
          }

          if (res.status === "OCUPADO" && res.horaSugerida) {
            updateIvrSession(callSid, {
              horaSugerida: res.horaSugerida,
              horaSolicitada: res.horaSolicitada,
              bloqueSugeridoId: res.bloqueSugeridoId,
              rut: res.rut,
              pacienteNombre: res.pacienteNombre,
              profesionalNombre: res.profesionalNombre,
              especialidad: res.especialidad,
            });

            const vocativo = res.esAdultoMayor ? `Don o Señora ${res.pacienteNombre}` : res.pacienteNombre;
            return {
              replyText: `Hola ${vocativo}, la hora de las ${res.horaSolicitada} en ${res.especialidadNombre} ya está ocupada, pero tengo disponible a las ${res.horaSugerida} con el ${res.profesionalNombre}. ¿Desea agendarla?`,
              shouldHangup: false,
              engineUsed: "gemini",
              reservaData: res,
            };
          }
        }

        if (fnName === "confirmarHoraSugerida") {
          const rut = args.rut || session.rut || "21111111-1";
          const bloqueId = session.bloqueSugeridoId;

          if (bloqueId) {
            const res = await confirmarBloqueSugeridoPorVoz(bloqueId, rut);
            updateIvrSession(callSid, {
              estadoCita: "AGENDADO",
              horaSugerida: undefined,
              bloqueSugeridoId: undefined,
              codigoReserva: res.codigoReserva,
            });

            const vocativo = res.esAdultoMayor ? `Don o Señora ${res.pacienteNombre}` : res.pacienteNombre;
            return {
              replyText: `Excelente ${vocativo}, su cita para el RUT ${res.rut} quedó confirmada para las ${res.horaConfirmada} en ${res.especialidadNombre} con código ${res.codigoReserva}. ¡Que tenga un muy buen día!`,
              shouldHangup: true,
              engineUsed: "gemini",
              reservaData: res,
            };
          }
        }
      }

      const replyText = resp.text
        ? resp.text.replace(/[*#_~`]/g, "").trim()
        : "";

      if (replyText) {
        return {
          replyText,
          shouldHangup: false,
          engineUsed: "gemini",
        };
      }
    } catch (err: unknown) {
      continue;
    }
  }

  return null;
}

// ====================================================================
// ORQUESTADOR PRINCIPAL
// ====================================================================

export async function procesarTurnoVoz(
  callSid: string,
  userSpeech: string
): Promise<VoiceAgentResult> {
  const session = getOrCreateIvrSession(callSid);
  addIvrTranscriptEntry(callSid, "user", userSpeech);

  // 1. Confirmación afirmativa rápida (< 10ms)
  if (esAceptacionOConfirmacion(userSpeech) && session.bloqueSugeridoId) {
    const rut = session.rut || "21111111-1";
    try {
      const res = await confirmarBloqueSugeridoPorVoz(session.bloqueSugeridoId, rut);

      updateIvrSession(callSid, {
        estadoCita: "AGENDADO",
        horaSugerida: undefined,
        bloqueSugeridoId: undefined,
        codigoReserva: res.codigoReserva,
      });

      const vocativo = res.esAdultoMayor ? `Don o Señora ${res.pacienteNombre}` : res.pacienteNombre;
      const replyText = `Perfecto ${vocativo}, su cita para el RUT ${res.rut} ha quedado confirmada a las ${res.horaConfirmada} en ${res.especialidadNombre} con código ${res.codigoReserva}. ¡Muchas gracias y que tenga un excelente día!`;
      addIvrTranscriptEntry(callSid, "bot", replyText);

      return {
        replyText,
        shouldHangup: true,
        engineUsed: "fast_confirmation",
        reservaData: res,
      };
    } catch (err) {
      // Ignorar y continuar a fallback
    }
  }

  // 2. Gemini con timeout estricto de 2.8 segundos
  try {
    const geminiResult = await withTimeout(
      intentarConGemini(callSid, userSpeech),
      2800,
      "Timeout telefónico de Gemini"
    );

    if (geminiResult) {
      addIvrTranscriptEntry(callSid, "bot", geminiResult.replyText);
      return geminiResult;
    }
  } catch (err: unknown) {
    // Si Gemini tiene timeout o 429, entra el NLU local instantáneo
  }

  // 3. Fallback NLU local infalible
  const fallbackResult = await procesarConFallbackLocal(callSid, userSpeech);
  addIvrTranscriptEntry(callSid, "bot", fallbackResult.replyText);
  return fallbackResult;
}
