// src/app/api/twilio/voice/route.ts

import twilio from "twilio";
import {
  getOrCreateIvrSession,
  addIvrTranscriptEntry,
  procesarTurnoVoz,
} from "@/lib/voiceAgent";

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(req: Request) {
  try {
    const formData = await req.formData().catch(() => new FormData());
    const callSid = (formData.get("CallSid") as string) || `call-${Date.now()}`;
    const speechResult = (formData.get("SpeechResult") as string | null)?.trim() || "";

    // Construir URL absoluta para la acción del webhook de Twilio
    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https";

    let baseUrl = process.env.PUBLIC_WEBHOOK_BASE_URL || "http://localhost:3000";
    if (forwardedHost) {
      baseUrl = `${forwardedProto}://${forwardedHost}`;
    }
    const actionUrl = `${baseUrl.replace(/\/+$/, "")}/api/twilio/voice`;

    const twiml = new VoiceResponse();
    const session = getOrCreateIvrSession(callSid);

    // Caso 1: No hay transcripción (recién contesta el usuario o hubo pausa prolongada)
    if (!speechResult) {
      // Si la cita ya quedó confirmada en un turno anterior, despedir y colgar
      if (session.estadoCita === "AGENDADO") {
        twiml.say(
          { language: "es-MX" },
          "Tu cita ya ha sido agendada con éxito en MallaSalud. ¡Muchas gracias y hasta pronto!"
        );
        twiml.hangup();
        return new Response(twiml.toString(), {
          headers: { "Content-Type": "text/xml; charset=utf-8" },
        });
      }

      // Si ya hay conversación previa y ocurrió silencio, repreguntar con paciencia
      if (session.transcript.length > 0) {
        const repregunta = session.horaSugerida
          ? `¿Sigues ahí? Por favor dime sí para tomar la hora disponible de las ${session.horaSugerida}, o dime no para buscar otra opción.`
          : "No pude escucharte bien. Por favor indícame tu RUT y a qué hora necesitas tu cita médica.";

        const gather = twiml.gather({
          input: ["speech"],
          language: "es-CL",
          timeout: 10,
          speechTimeout: "auto",
          bargeIn: true,
          action: actionUrl,
          method: "POST",
        });
        gather.say({ language: "es-MX" }, repregunta);

        twiml.say(
          { language: "es-MX" },
          "No recibí respuesta. Puedes llamar nuevamente cuando lo desees a MallaSalud. ¡Hasta luego!"
        );
        twiml.hangup();

        return new Response(twiml.toString(), {
          headers: { "Content-Type": "text/xml; charset=utf-8" },
        });
      }

      // Primera vez que conecta la llamada
      const bienvenida =
        "Hola, bienvenido al sistema de agendamiento de CESFAM MallaSalud. Por favor indícame tu RUT y para qué hora necesitas tu atención médica.";

      addIvrTranscriptEntry(callSid, "system", "Llamada conectada con Twilio.");
      addIvrTranscriptEntry(callSid, "bot", bienvenida);

      const gather = twiml.gather({
        input: ["speech"],
        language: "es-CL",
        timeout: 10,
        speechTimeout: "auto",
        bargeIn: true,
        action: actionUrl,
        method: "POST",
      });
      gather.say({ language: "es-MX" }, bienvenida);

      twiml.say(
        { language: "es-MX" },
        "No logré escucharte. Recuerda indicar tu RUT y la hora que necesitas. ¡Hasta pronto!"
      );
      twiml.hangup();

      return new Response(twiml.toString(), {
        headers: { "Content-Type": "text/xml; charset=utf-8" },
      });
    }

    // Caso 2: El paciente habló y Twilio envió la transcripción de voz
    const resultado = await procesarTurnoVoz(callSid, speechResult);

    if (resultado.shouldHangup) {
      // Cita AGENDADA o finalizada -> confirmación final y colgar
      twiml.say({ language: "es-MX" }, resultado.replyText);
      twiml.hangup();
    } else {
      // Falta información o propuesta pendiente -> seguir escuchando con bargeIn y 10s timeout
      const gather = twiml.gather({
        input: ["speech"],
        language: "es-CL",
        timeout: 10,
        speechTimeout: "auto",
        bargeIn: true,
        action: actionUrl,
        method: "POST",
      });
      gather.say({ language: "es-MX" }, resultado.replyText);

      // Si no habló tras el timeout, redirigir a repregunta
      twiml.redirect({ method: "POST" }, actionUrl);
    }

    return new Response(twiml.toString(), {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("Error en webhook de voz de Twilio:", error);
    const twiml = new VoiceResponse();
    twiml.say(
      { language: "es-MX" },
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

