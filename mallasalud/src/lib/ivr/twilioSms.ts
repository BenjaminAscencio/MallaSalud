// src/lib/ivr/twilioSms.ts

import twilio from "twilio";

export interface EnvioSmsTwilioResult {
  attempted: boolean;
  sent: boolean;
  to: string;
  sid?: string;
  estadoEnvio: string;
  errorCode?: number;
  errorMessage?: string;
}

/**
 * Verifica si un CallSid corresponde a una llamada telefónica real de Twilio (CA + 32 hex chars).
 * Evita disparar SMS reales durante simulaciones web (sim-*) o pruebas QA automatizadas (qa-*).
 */
export function esLlamadaTwilioReal(callSid?: string): boolean {
  return Boolean(callSid && /^CA[a-fA-F0-9]{32}$/.test(callSid.trim()));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
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

/**
 * Envía el ticket SMS transaccional vía Twilio Programmable Messaging únicamente en llamadas reales
 * (o si `forceReal` es true), con fallback no bloqueante hacia la auditoría PostgreSQL.
 */
export async function enviarSmsTicketTwilio(params: {
  callSid?: string;
  telefonoDestino: string;
  cuerpoMensaje: string;
  estadoFallback: string;
  forceReal?: boolean;
}): Promise<EnvioSmsTwilioResult> {
  const to = (params.telefonoDestino || "").trim();
  const debeEnviarReal = Boolean(params.forceReal || esLlamadaTwilioReal(params.callSid));

  if (!debeEnviarReal || process.env.TWILIO_SMS_ENABLED === "false") {
    return {
      attempted: false,
      sent: false,
      to,
      estadoEnvio: params.estadoFallback,
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = (process.env.TWILIO_FROM_NUMBER || "").trim();

  if (!accountSid || !authToken || !fromNumber || !/^\+\d{8,15}$/.test(to)) {
    return {
      attempted: false,
      sent: false,
      to,
      estadoEnvio: params.estadoFallback,
    };
  }

  const client = twilio(accountSid, authToken);

  try {
    const msg = await withTimeout(
      client.messages.create({
        from: fromNumber,
        to,
        body: params.cuerpoMensaje,
      }),
      4500,
      "Timeout enviando SMS por Twilio"
    );

    return {
      attempted: true,
      sent: true,
      to,
      sid: msg.sid,
      estadoEnvio: "ENVIADO_TWILIO_SMS",
    };
  } catch (err: unknown) {
    const e = err as { code?: number | string; message?: string };
    const code = e?.code !== undefined ? Number(e.code) : undefined;
    const errorMessage = e?.message || "Error desconocido enviando SMS";

    // En cuentas Twilio Free Trial nuevas, el error 572006 exige plantilla predefinida.
    if (code === 572006 || String(e?.code) === "572006") {
      const template = process.env.TWILIO_TRIAL_SMS_TEMPLATE || "sms_appointment_reminders";
      try {
        const trialMsg = await withTimeout(
          client.messages.create({
            from: fromNumber,
            to,
            body: template,
          }),
          4500,
          "Timeout enviando SMS Trial por Twilio"
        );
        console.info("[Twilio SMS] Cuenta Trial (572006): SMS real despachado con plantilla Trial", {
          to,
          sid: trialMsg.sid,
          template,
        });
        return {
          attempted: true,
          sent: true,
          to,
          sid: trialMsg.sid,
          estadoEnvio: "ENVIADO_TWILIO_TRIAL",
        };
      } catch (retryErr: unknown) {
        const re = retryErr as { code?: number | string; message?: string };
        const retryCode = re?.code !== undefined ? Number(re.code) : 572006;
        const retryMessage = re?.message || errorMessage;
        console.warn("[Twilio SMS] Fallback a auditoría local tras reintento Trial:", {
          to,
          code: retryCode,
          errorMessage: retryMessage,
        });
        return {
          attempted: true,
          sent: false,
          to,
          estadoEnvio: `${params.estadoFallback} (TWILIO_${retryCode || 572006})`,
          errorCode: retryCode || 572006,
          errorMessage: retryMessage,
        };
      }
    }

    console.warn("[Twilio SMS] Fallback a auditoría local:", {
      to,
      code,
      errorMessage,
    });

    return {
      attempted: true,
      sent: false,
      to,
      estadoEnvio: code ? `${params.estadoFallback} (TWILIO_${code})` : params.estadoFallback,
      errorCode: code,
      errorMessage,
    };
  }
}
