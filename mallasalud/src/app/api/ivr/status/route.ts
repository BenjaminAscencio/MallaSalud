// src/app/api/ivr/status/route.ts

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/core/authServer";
import {
  getIvrScheduleSnapshot,
  resetIvrDemoData,
} from "@/lib/ivrScheduleService";
import {
  getAllIvrSessions,
  clearIvrSessions,
  getOrCreateIvrSession,
  iniciarBienvenidaIvr,
  procesarTurnoIvr,
  procesarTurnoVoz,
} from "@/lib/voiceAgent";
import { resolvePublicWebhookBaseUrl } from "@/lib/ivr/tunnelUrl";

async function obtenerRecentSms() {
  const rows = await prisma.registroSms.findMany({
    orderBy: { timestamp: "desc" },
    take: 10,
    include: {
      cita: {
        select: {
          codigo_reserva: true,
          especialidad: true,
          canal_origen: true,
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    telefono_destino: r.telefono_destino,
    cuerpo_mensaje: r.cuerpo_mensaje,
    longitud_caracteres: r.longitud_caracteres,
    estado_envio: r.estado_envio,
    timestamp: r.timestamp.toISOString(),
    codigo_reserva: r.cita?.codigo_reserva || null,
    especialidad: r.cita?.especialidad || null,
    canal_origen: r.cita?.canal_origen || null,
  }));
}

export async function GET(req: Request) {
  const auth = await requireRole(req, ["SOME"]);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const [snapshot, recentSms, publicWebhookBaseUrl] = await Promise.all([
      getIvrScheduleSnapshot(),
      obtenerRecentSms(),
      resolvePublicWebhookBaseUrl(),
    ]);
    const sessions = getAllIvrSessions();

    return NextResponse.json({
      success: true,
      slots: snapshot.slots,
      activeSessions: sessions,
      recentSms,
      twilioFromNumber: process.env.TWILIO_FROM_NUMBER || "",
      defaultToNumber: process.env.DEFAULT_TO_NUMBER || "",
      publicWebhookBaseUrl,
      lastUpdated: snapshot.lastUpdated,
    });
  } catch (error: any) {
    console.error("Error al obtener estado IVR:", error);
    return NextResponse.json(
      { error: error.message || "Error al obtener estado de agenda IVR" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(req, ["SOME"]);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === "reset") {
      await resetIvrDemoData();
      clearIvrSessions();
      const snapshot = await getIvrScheduleSnapshot();

      return NextResponse.json({
        success: true,
        message: "Horas de prueba y citas telefónicas reiniciadas en PostgreSQL.",
        slots: snapshot.slots,
        activeSessions: [],
        lastUpdated: snapshot.lastUpdated,
      });
    }

    if (action === "clear_chat") {
      clearIvrSessions();
      const snapshot = await getIvrScheduleSnapshot();

      return NextResponse.json({
        success: true,
        message: "Historial de llamada limpiado. Base de datos intacta.",
        slots: snapshot.slots,
        activeSessions: [],
        lastUpdated: snapshot.lastUpdated,
      });
    }

    if (action === "welcome") {
      const callSid = body.callSid || `sim-browser-${Date.now()}`;
      const session = iniciarBienvenidaIvr(callSid);
      const [snapshot, recentSms] = await Promise.all([
        getIvrScheduleSnapshot(),
        obtenerRecentSms(),
      ]);

      return NextResponse.json({
        success: true,
        step: session.step || "INICIO",
        replyText: session.ultimoMensajeBot || "",
        slots: snapshot.slots,
        activeSessions: getAllIvrSessions(),
        recentSms,
        lastUpdated: snapshot.lastUpdated,
      });
    }

    if (action === "dtmf") {
      const digits = String(body.digits || "").trim();
      const callSid = body.callSid || "sim-browser-ivr";

      if (!digits) {
        return NextResponse.json(
          { error: "Debe indicar al menos un dígito DTMF para enviar." },
          { status: 400 }
        );
      }

      getOrCreateIvrSession(callSid);
      const resultado = await procesarTurnoIvr(callSid, { digits });
      const [snapshot, recentSms] = await Promise.all([
        getIvrScheduleSnapshot(),
        obtenerRecentSms(),
      ]);

      return NextResponse.json({
        success: true,
        ...resultado,
        slots: snapshot.slots,
        activeSessions: getAllIvrSessions(),
        recentSms,
        lastUpdated: snapshot.lastUpdated,
      });
    }

    if (action === "simulate") {
      const text = (body.text || "").trim();
      const callSid = body.callSid || "sim-browser-ivr";

      if (!text) {
        return NextResponse.json(
          { error: "Debe ingresar texto para simular la conversación telefónica." },
          { status: 400 }
        );
      }

      getOrCreateIvrSession(callSid);
      const resultado = await procesarTurnoVoz(callSid, text);
      const [snapshot, recentSms] = await Promise.all([
        getIvrScheduleSnapshot(),
        obtenerRecentSms(),
      ]);

      return NextResponse.json({
        success: true,
        ...resultado,
        slots: snapshot.slots,
        activeSessions: getAllIvrSessions(),
        recentSms,
        lastUpdated: snapshot.lastUpdated,
      });
    }

    return NextResponse.json(
      { error: "Acción no reconocida. Use 'welcome', 'dtmf', 'simulate', 'reset' o 'clear_chat'." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error en POST /api/ivr/status:", error);
    return NextResponse.json(
      { error: error.message || "Error procesando solicitud IVR" },
      { status: 500 }
    );
  }
}

