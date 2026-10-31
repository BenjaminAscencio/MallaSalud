// src/lib/ivr/types.ts

import { Especialidad, EstadoBloque, EstadoCita, CanalOrigen } from "@prisma/client";

export interface IvrTimeSlot {
  id: string;
  hora: string; // "10:00", "10:30", etc.
  estado: EstadoBloque;
  rut?: string | null;
  pacienteNombre?: string | null;
  profesionalNombre?: string | null;
  especialidad: Especialidad;
  boxNumero?: string | null;
  codigoReserva?: string | null;
  canalOrigen?: CanalOrigen | null;
  esCuotaMayor?: boolean;
}

export interface IvrTranscriptEntry {
  id: string;
  speaker: "user" | "bot" | "system";
  text: string;
  timestamp: number;
}

export interface IvrCallSession {
  callSid: string;
  transcript: IvrTranscriptEntry[];
  rut?: string;
  pacienteId?: string;
  pacienteNombre?: string;
  esAdultoMayor?: boolean;
  bloqueSugeridoId?: string;
  horaSugerida?: string;
  horaSolicitada?: string;
  profesionalNombre?: string;
  especialidad?: Especialidad;
  estadoCita?: "PENDIENTE" | "AGENDADO" | "CANCELADO" | "NO_INSCRITO" | "CITA_DUPLICADA";
  codigoReserva?: string;
  startedAt: number;
  lastActivityAt: number;
  status: "in-progress" | "completed" | "failed";
}

export interface VerificarOAgendarResult {
  status:
    | "AGENDADO"
    | "OCUPADO"
    | "SIN_DISPONIBILIDAD"
    | "NO_INSCRITO"
    | "CITA_DUPLICADA"
    | "REQUIERE_ESPECIALIDAD"
    | "REQUIERE_HORA";
  pacienteNombre?: string;
  rut: string;
  esAdultoMayor?: boolean;
  edad?: number;
  horaConfirmada?: string;
  horaSolicitada?: string;
  horaSugerida?: string;
  bloqueSugeridoId?: string;
  profesionalNombre?: string;
  especialidad?: Especialidad;
  especialidadNombre?: string;
  horaExistente?: string;
  codigoReserva?: string;
  message?: string;
}

export interface VoiceAgentResult {
  replyText: string;
  shouldHangup: boolean;
  engineUsed: "gemini" | "local_fallback" | "fast_confirmation";
  reservaData?: VerificarOAgendarResult;
}
