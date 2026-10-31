// src/app/api/ivr/status/route.ts

import { NextResponse } from "next/server";
import {
  getIvrScheduleSnapshot,
  resetIvrDemoData,
} from "@/lib/ivrScheduleService";
import {
  getAllIvrSessions,
  clearIvrSessions,
  getOrCreateIvrSession,
  procesarTurnoVoz,
} from "@/lib/voiceAgent";

export async function GET() {
  try {
    const snapshot = await getIvrScheduleSnapshot();
    const sessions = getAllIvrSessions();

    return NextResponse.json({
      success: true,
      slots: snapshot.slots,
      activeSessions: sessions,
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
      const snapshot = await getIvrScheduleSnapshot();
      const sessions = getAllIvrSessions();

      return NextResponse.json({
        success: true,
        ...resultado,
        slots: snapshot.slots,
        activeSessions: sessions,
        lastUpdated: snapshot.lastUpdated,
      });
    }

    return NextResponse.json(
      { error: "Acción no reconocida. Use 'reset' o 'simulate'." },
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

