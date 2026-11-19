import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { requireRole } from "@/lib/core/authServer";
import { resolvePublicWebhookBaseUrl } from "@/lib/ivr/tunnelUrl";

/**
 * POST /api/ivr/configure-inbound
 * Configura automáticamente el webhook voiceUrl entrante del número Twilio (TWILIO_FROM_NUMBER)
 * para permitir que cualquier paciente llame directamente al consultorio.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["SOME"]);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const cleanBaseUrl = await resolvePublicWebhookBaseUrl(body.webhookBaseUrl);

    if (
      !cleanBaseUrl ||
      cleanBaseUrl.includes("localhost") ||
      cleanBaseUrl.includes("127.0.0.1")
    ) {
      return NextResponse.json(
        {
          error:
            "Twilio no puede alcanzar localhost. Ingresa la URL pública HTTPS del túnel Cloudflare o del despliegue en la nube.",
        },
        { status: 400 }
      );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = (process.env.TWILIO_FROM_NUMBER || "").trim();

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        {
          error:
            "Faltan credenciales Twilio en .env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_FROM_NUMBER).",
        },
        { status: 400 }
      );
    }

    const client = twilio(accountSid, authToken);
    const numbers = await client.incomingPhoneNumbers.list({
      phoneNumber: fromNumber,
      limit: 1,
    });

    if (numbers.length === 0) {
      return NextResponse.json(
        {
          error: `El número ${fromNumber} no figura como número propio activo (Active Numbers / IncomingPhoneNumbers) en esta cuenta Twilio Trial. En cuentas Trial sin número propio aprovisionado solo funcionan llamadas salientes desde el botón web hasta adquirir o habilitar un número activo en Twilio Console.`,
        },
        { status: 404 }
      );
    }

    const targetVoiceUrl = `${cleanBaseUrl}/api/twilio/voice`;
    await client.incomingPhoneNumbers(numbers[0].sid).update({
      voiceUrl: targetVoiceUrl,
      voiceMethod: "POST",
    });

    return NextResponse.json(
      {
        success: true,
        phoneNumber: fromNumber,
        voiceUrl: targetVoiceUrl,
        message: `Llamadas entrantes activadas en ${fromNumber} → ${targetVoiceUrl}`,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error en POST /api/ivr/configure-inbound:", error);
    const msg = error instanceof Error ? error.message : "Error al configurar número Twilio";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
