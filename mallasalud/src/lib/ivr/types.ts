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

export type IvrStep =
  | "INICIO"
  | "ESPERANDO_RUT"
  | "ESPERANDO_ESPECIALIDAD"
  | "ESPERANDO_FRANJA"
  | "ELIGIENDO_HORA_FRANJA"
  | "CONFIRMANDO_SUGERENCIA"
  | "CONFIRMANDO_REAGENDAMIENTO"
  | "COMPLETADO";

export type IvrFranja = "MANANA" | "MEDIA_MANANA" | "TARDE" | "PRIMERA_DISPONIBLE";

export interface IvrFranjaOption {
  bloqueId: string;
  hora: string;
  profesionalNombre: string;
  boxNumero: string;
}

export type IvrExpectedInput = "open" | "rut" | "menu" | "confirmation";

export type IvrInteractionMode = "VOZ" | "TECLADO";

export interface IvrCallSmsContext {
  callSid?: string;
  telefonoLlamada?: string;
}

export interface IvrCallSession {
  callSid: string;
  transcript: IvrTranscriptEntry[];
  step?: IvrStep;
  modoInteraccion?: IvrInteractionMode;
  modoTeclado?: boolean;
  telefonoLlamada?: string;
  rutParcial?: string;
  especialidadConfirmada?: boolean;
  franjaSeleccionada?: IvrFranja;
  opcionesFranja?: IvrFranjaOption[];
  ultimoMensajeBot?: string;
  rut?: string;
  pacienteId?: string;
  pacienteNombre?: string;
  esAdultoMayor?: boolean;
  bloqueSugeridoId?: string;
  horaSugerida?: string;
  bloqueSugeridoAntesId?: string;
  horaSugeridaAntes?: string;
  bloqueSugeridoDespuesId?: string;
  horaSugeridaDespues?: string;
  citaExistenteId?: string;
  horaExistente?: string;
  citaExistenteCodigo?: string;
  bloqueReagendarId?: string;
  horaReagendar?: string;
  intentCancelacion?: boolean;
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
    | "CANCELADO"
    | "CANCELACION_EXPIRADA"
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
  horaSugeridaAntes?: string;
  bloqueSugeridoAntesId?: string;
  horaSugeridaDespues?: string;
  bloqueSugeridoDespuesId?: string;
  profesionalNombre?: string;
  especialidad?: Especialidad;
  especialidadNombre?: string;
  boxNumero?: string;
  horaExistente?: string;
  citaExistenteId?: string;
  bloqueReagendarId?: string;
  horaReagendar?: string;
  codigoReserva?: string;
  smsEnviadoTwilio?: boolean;
  message?: string;
}

export interface VoiceAgentResult {
  replyText: string;
  shouldHangup: boolean;
  engineUsed: "gemini" | "local_fallback" | "fast_confirmation";
  expectedInput?: IvrExpectedInput;
  step?: IvrStep;
  reservaData?: VerificarOAgendarResult;
}
