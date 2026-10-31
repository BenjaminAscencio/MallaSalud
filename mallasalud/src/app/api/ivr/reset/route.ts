// src/app/api/ivr/reset/route.ts

import { NextResponse } from "next/server";
import {
  resetIvrDemoData,
  getIvrScheduleSnapshot,
} from "@/lib/ivrScheduleService";
import { clearIvrSessions } from "@/lib/voiceAgent";

export async function POST() {
  try {
    await resetIvrDemoData();
    clearIvrSessions();
    const snapshot = await getIvrScheduleSnapshot();

    return NextResponse.json({
      success: true,
      message: "Horarios de prueba y citas telefónicas liberadas correctamente en PostgreSQL.",
      slots: snapshot.slots,
      activeSessions: [],
      lastUpdated: snapshot.lastUpdated,
    });
  } catch (error: any) {
    console.error("Error al reiniciar agenda IVR:", error);
    return NextResponse.json(
      { error: error.message || "Error al reiniciar los horarios en PostgreSQL" },
      { status: 500 }
    );
  }
}

