// src/app/api/call/start/route.ts

import { NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const toNumber = (body.toNumber || process.env.DEFAULT_TO_NUMBER || "+56937772647").trim();
    const webhookBaseUrl = (
      body.webhookBaseUrl ||
      process.env.PUBLIC_WEBHOOK_BASE_URL ||
      "http://localhost:3000"
    ).trim();

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER || "+17372508034";

    if (!accountSid || !authToken) {
      return NextResponse.json(
        { error: "Credenciales de Twilio faltantes en variables de entorno (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)." },
        { status: 500 }
      );
    }

    if (!toNumber) {
      return NextResponse.json(
        { error: "Número de teléfono destino no especificado." },
        { status: 400 }
      );
    }

    const cleanBaseUrl = webhookBaseUrl.replace(/\/+$/, "");
    const client = twilio(accountSid, authToken);

    const call = await client.calls.create({
      to: toNumber,
      from: fromNumber,
      url: `${cleanBaseUrl}/api/twilio/voice`,
    });

    return NextResponse.json({
      success: true,
      callSid: call.sid,
      to: toNumber,
      from: fromNumber,
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

