// src/app/api/call/start/route.ts

import { NextResponse } from "next/server";
import twilio from "twilio";
import { requireRole } from "@/lib/core/authServer";
import { resolvePublicWebhookBaseUrl } from "@/lib/ivr/tunnelUrl";

export async function POST(req: Request) {
  const auth = await requireRole(req, ["SOME"]);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const toNumber = (body.toNumber || process.env.DEFAULT_TO_NUMBER || "").trim();

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = (process.env.TWILIO_FROM_NUMBER || "").trim();

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        {
          error:
            "Credenciales de Twilio faltantes en .env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_FROM_NUMBER).",
        },
        { status: 400 }
      );
    }

    if (!toNumber) {
      return NextResponse.json(
        { error: "Número de teléfono destino no especificado." },
        { status: 400 }
      );
    }

    const cleanBaseUrl = await resolvePublicWebhookBaseUrl(body.webhookBaseUrl);
    if (
      !cleanBaseUrl ||
      cleanBaseUrl.includes("localhost") ||
      cleanBaseUrl.includes("127.0.0.1")
    ) {
      return NextResponse.json(
        {
          error:
            "Twilio requiere una URL pública HTTPS (túnel Cloudflare o dominio en la nube) para responder la llamada; localhost no es alcanzable.",
        },
        { status: 400 }
      );
    }

    const client = twilio(accountSid, authToken);
    const webhookUrl = `${cleanBaseUrl}/api/twilio/voice`;

    const call = await client.calls.create({
      to: toNumber,
      from: fromNumber,
      url: webhookUrl,
    });

    return NextResponse.json({
      success: true,
      callSid: call.sid,
      to: toNumber,
      from: fromNumber,
      webhookUrl,
      status: call.status,
    });
  } catch (error: any) {
    console.error("Error al iniciar llamada con Twilio:", error);
    return NextResponse.json(
      {
        error: error.message || "Error al iniciar la llamada telefónica.",
        code: error.code,
      },
      { status: 500 }
    );
  }
}

