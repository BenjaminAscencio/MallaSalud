// src/app/api/twilio/voice/route.ts

import twilio from "twilio";
import {
  BIENVENIDA_IVR,
  getOrCreateIvrSession,
  iniciarBienvenidaIvr,
  procesarTurnoIvr,
  updateIvrSession,
} from "@/lib/voiceAgent";
import { IvrExpectedInput, IvrInteractionMode, IvrStep } from "@/lib/ivr/types";

const VoiceResponse = twilio.twiml.VoiceResponse;

const TWILIO_VOICE = (process.env.TWILIO_VOICE_NAME || "Polly.Mia-Neural") as any;
const TWILIO_LANG = (process.env.TWILIO_VOICE_LANGUAGE || "es-MX") as any;

const SAY_OPTIONS = {
  voice: TWILIO_VOICE,
  language: TWILIO_LANG,
};

const TELEPHONY_HINTS =
  "RUT, mi RUT es, medicina general, dental, matroneria, manana, media manana, tarde, primera disponible, antes, despues, cancelar, anular, reagendar, repetir, si, no, guion, ka, cero, uno, dos, tres, cuatro, cinco, seis, siete, ocho, nueve";

const SINGLE_DIGIT_STEPS = new Set<IvrStep>([
  "ESPERANDO_ESPECIALIDAD",
  "ESPERANDO_FRANJA",
  "ELIGIENDO_HORA_FRANJA",
  "CONFIRMANDO_SUGERENCIA",
  "CONFIRMANDO_REAGENDAMIENTO",
  "COMPLETADO",
]);

function crearGather(
  twiml: InstanceType<typeof VoiceResponse>,
  actionUrl: string,
  expectedInput: IvrExpectedInput = "open",
  step?: IvrStep,
  modoInteraccion?: IvrInteractionMode
) {
  const timeout = expectedInput === "rut" ? 12 : 10;
  const soloTeclado = modoInteraccion === "TECLADO";
  const speechTimeout = expectedInput === "rut" ? "4" : expectedInput === "open" ? "3" : "2";

  const opciones: Record<string, unknown> = soloTeclado
    ? {
        input: ["dtmf"],
        timeout,
        finishOnKey: "#",
        bargeIn: true,
        action: actionUrl,
        method: "POST",
      }
    : {
        input: ["speech", "dtmf"],
        language: "es-CL",
        timeout,
        speechTimeout,
        finishOnKey: "#",
        bargeIn: true,
        hints: TELEPHONY_HINTS,
        action: actionUrl,
        method: "POST",
      };

  if (step && SINGLE_DIGIT_STEPS.has(step)) {
    opciones.numDigits = 1;
  }

  return twiml.gather(opciones as any);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData().catch(() => new FormData());
    const callSid = (formData.get("CallSid") as string) || `call-${Date.now()}`;
    const speechResult = (formData.get("SpeechResult") as string | null)?.trim() || "";
    const digitsResult = (formData.get("Digits") as string | null)?.trim() || "";

    const direction = ((formData.get("Direction") as string) || "").toLowerCase();
    const fromNum = ((formData.get("From") as string) || "").trim();
    const toNum = ((formData.get("To") as string) || "").trim();
    const twilioFrom = (process.env.TWILIO_FROM_NUMBER || "").trim();

    let telefonoLlamada: string | undefined;
    if (direction.startsWith("outbound")) {
      telefonoLlamada = toNum || undefined;
    } else if (direction === "inbound") {
      telefonoLlamada = fromNum || undefined;
    } else if (fromNum && fromNum !== twilioFrom) {
      telefonoLlamada = fromNum;
    } else if (toNum && toNum !== twilioFrom) {
      telefonoLlamada = toNum;
    }
    if (telefonoLlamada && !/^\+\d{8,15}$/.test(telefonoLlamada)) {
      telefonoLlamada = undefined;
    }

    // Construir URL absoluta HTTPS para la acción del webhook de Twilio
    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https";

    let baseUrl = process.env.PUBLIC_WEBHOOK_BASE_URL || "http://localhost:3000";
    if (forwardedHost) {
      const proto = forwardedHost.endsWith(".trycloudflare.com") ? "https" : forwardedProto;
      baseUrl = `${proto}://${forwardedHost}`;
    }
    const actionUrl = `${baseUrl.replace(/\/+$/, "")}/api/twilio/voice`;

    const twiml = new VoiceResponse();
    const session = getOrCreateIvrSession(callSid);

    // Caso 1: Conexión inicial o silencio sin voz ni teclado DTMF
    if (!speechResult && !digitsResult) {
      if (
        session.step === "COMPLETADO" ||
        session.estadoCita === "AGENDADO" ||
        session.estadoCita === "CANCELADO"
      ) {
        twiml.say(
          SAY_OPTIONS,
          "Tu solicitud fue procesada con éxito en CESFAM MallaSalud. Muchas gracias y hasta pronto."
        );
        twiml.hangup();
        return new Response(twiml.toString(), {
          headers: { "Content-Type": "text/xml; charset=utf-8" },
        });
      }

      if (session.transcript.length > 0) {
        const expected: IvrExpectedInput =
          session.step === "ESPERANDO_RUT"
            ? "rut"
            : session.step === "CONFIRMANDO_SUGERENCIA" || session.step === "CONFIRMANDO_REAGENDAMIENTO"
            ? "confirmation"
            : session.step === "INICIO"
            ? "open"
            : "menu";
        const defaultRepregunta =
          session.modoInteraccion === "TECLADO"
            ? "No recibimos su selección en el teclado. Por favor marque su opción nuevamente."
            : session.modoInteraccion === "VOZ"
            ? "No logré escucharle bien. Por favor indíqueme su RUT nuevamente."
            : "No logré escucharte bien. Por favor indícame tu RUT por voz o márcalo en el teclado terminado en numeral.";
        const repregunta = session.ultimoMensajeBot || defaultRepregunta;

        const gather = crearGather(
          twiml,
          actionUrl,
          expected,
          session.step,
          session.modoInteraccion
        );
        gather.say(SAY_OPTIONS, repregunta);

        twiml.say(
          SAY_OPTIONS,
          "No recibimos respuesta. Puedes volver a comunicarte con CESFAM MallaSalud cuando lo necesites. Hasta luego."
        );
        twiml.hangup();

        return new Response(twiml.toString(), {
          headers: { "Content-Type": "text/xml; charset=utf-8" },
        });
      }

      iniciarBienvenidaIvr(callSid, telefonoLlamada);
      const gather = crearGather(twiml, actionUrl, "open", "INICIO");
      gather.say(SAY_OPTIONS, BIENVENIDA_IVR);

      twiml.say(
        SAY_OPTIONS,
        "No logré captar tu solicitud. Puedes volver a comunicarte con CESFAM MallaSalud cuando lo necesites. Hasta pronto."
      );
      twiml.hangup();

      return new Response(twiml.toString(), {
        headers: { "Content-Type": "text/xml; charset=utf-8" },
      });
    }

    if (telefonoLlamada && !session.telefonoLlamada) {
      updateIvrSession(callSid, { telefonoLlamada });
    }

    // Caso 2: El paciente habló o marcó dígitos DTMF
    const resultado = await procesarTurnoIvr(callSid, {
      speech: speechResult,
      digits: digitsResult,
    });
    const modoActual = getOrCreateIvrSession(callSid).modoInteraccion;

    if (resultado.shouldHangup) {
      twiml.say(SAY_OPTIONS, resultado.replyText);
      twiml.hangup();
    } else {
      const gather = crearGather(
        twiml,
        actionUrl,
        resultado.expectedInput || "open",
        resultado.step,
        modoActual
      );
      gather.say(SAY_OPTIONS, resultado.replyText);
      twiml.redirect({ method: "POST" }, actionUrl);
    }

    return new Response(twiml.toString(), {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
      },
    });
  } catch (error: unknown) {
    console.error("Error en webhook de voz de Twilio:", error);
    const twiml = new VoiceResponse();
    twiml.say(
      SAY_OPTIONS,
      "Ocurrió un problema momentáneo en nuestra central telefónica. Por favor intenta llamar nuevamente en unos instantes."
    );
    twiml.hangup();
    return new Response(twiml.toString(), {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
      },
    });
  }
}
