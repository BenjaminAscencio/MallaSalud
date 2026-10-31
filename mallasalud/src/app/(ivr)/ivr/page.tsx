// src/app/(ivr)/ivr/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import "./ivr.css";
import {
  Phone,
  PhoneCall,
  Clock,
  Calendar,
  User,
  Bot,
  Send,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Volume2,
  Terminal,
  Activity,
  ShieldCheck,
  Info,
  CheckCircle2,
  Stethoscope,
  Building2,
  HeartHandshake,
} from "lucide-react";
import { IvrTimeSlot, IvrCallSession, IvrTranscriptEntry } from "@/lib/ivr/types";

export default function IvrPage() {
  const [webhookUrl, setWebhookUrl] = useState<string>(
    "https://landscapes-ronald-donations-rights.trycloudflare.com"
  );
  const [phoneNumber, setPhoneNumber] = useState<string>("+56937772647");
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const [callStatusMessage, setCallStatusMessage] = useState<string | null>(null);
  const [callSidActive, setCallSidActive] = useState<string | null>(null);

  const [slots, setSlots] = useState<IvrTimeSlot[]>([]);
  const [sessions, setSessions] = useState<IvrCallSession[]>([]);
  const [simText, setSimText] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [lastEngineUsed, setLastEngineUsed] = useState<string | null>(null);

  const consoleScrollRef = useRef<HTMLDivElement>(null);
  const prevTranscriptsLengthRef = useRef<number>(0);

  // Autodetectar el host si está corriendo a través de túnel público
  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
        setWebhookUrl(origin);
      }
    }
  }, []);

  // Polling a /api/ivr/status cada 1.5 segundos
  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/ivr/status");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) {
          if (data.slots) setSlots(data.slots);
          if (data.activeSessions) setSessions(data.activeSessions);
        }
      } catch (err) {
        console.error("Error al obtener estado IVR desde PostgreSQL:", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Transcripciones combinadas de la sesión activa
  const allTranscripts: IvrTranscriptEntry[] = React.useMemo(() => {
    if (sessions.length === 0) return [];
    const latest = sessions[0];
    return latest?.transcript || [];
  }, [sessions]);

  // Auto-scroll interno del cuadro de consola
  useEffect(() => {
    if (allTranscripts.length > prevTranscriptsLengthRef.current) {
      if (consoleScrollRef.current) {
        consoleScrollRef.current.scrollTop = consoleScrollRef.current.scrollHeight;
      }
    }
    prevTranscriptsLengthRef.current = allTranscripts.length;
  }, [allTranscripts]);

  // Iniciar llamada telefónica real vía Twilio
  const handleStartCall = async () => {
    setIsCalling(true);
    setCallStatusMessage("Marcando a tu celular vía Twilio Voice...");
    try {
      const res = await fetch("/api/call/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toNumber: phoneNumber,
          webhookBaseUrl: webhookUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo iniciar la llamada telefónica");
      }

      setCallSidActive(data.callSid);
      setCallStatusMessage(
        `¡Llamada en curso! SID: ${data.callSid.slice(0, 10)}... Contesta en tu celular y pulsa '1'.`
      );
    } catch (err: any) {
      setCallStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsCalling(false);
    }
  };

  // Reiniciar agenda y liberar horas en PostgreSQL
  const handleResetSchedule = async () => {
    try {
      const res = await fetch("/api/ivr/reset", {
        method: "POST",
      });
      const data = await res.json();
      if (data.slots) setSlots(data.slots);
      if (data.activeSessions) setSessions(data.activeSessions);
      setCallStatusMessage("Horarios de prueba y citas telefónicas liberadas en PostgreSQL.");
    } catch (err) {
      console.error(err);
    }
  };

  // Simular turno por texto (para pruebas rápidas en navegador)
  const handleSimulate = async (customText?: string) => {
    const textToSend = (customText || simText).trim();
    if (!textToSend) return;

    setIsSimulating(true);
    try {
      const res = await fetch("/api/ivr/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate",
          text: textToSend,
          callSid: callSidActive || "sim-browser-session",
        }),
      });

      const data = await res.json();
      if (data.engineUsed) setLastEngineUsed(data.engineUsed);
      if (data.slots) setSlots(data.slots);
      if (data.activeSessions) setSessions(data.activeSessions);
      setSimText("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950 pb-12">
      {/* HEADER DE CONTROL */}
      <div className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <PhoneCall className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  CENTRAL TELEFÓNICA IA • CANAL VOZ_IVR
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                  PostgreSQL + Twilio
                </span>
              </div>
              <p className="text-xs text-slate-400">
                CESFAM MallaSalud • Reglas Padrón, Cita Única y Cuota Adulto Mayor 60+
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300 font-mono">BD PostgreSQL en vivo (1.5s)</span>
            </div>
            <button
              onClick={handleResetSchedule}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition cursor-pointer"
              title="Liberar citas y restaurar bloques de prueba en la base de datos"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              Reiniciar Horas en BD
            </button>
          </div>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="max-w-7xl mx-auto w-full p-6 space-y-6 flex-1">
        {/* PANEL SUPERIOR: CONFIGURACIÓN DE LLAMADA REAL Y TUNEL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">
                  Disparador de Llamada Telefónica Saliente
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">Twilio Voice API</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  URL Pública del Webhook (Cloudflare / Ngrok)
                </label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://xxxxx.trycloudflare.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Punto de entrada para el webhook de Twilio: <code className="text-emerald-400">/api/twilio/voice</code>
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Número Telefónico Destino (Chile)
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+56937772647"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Número verificado en la consola de Twilio (+56937772647).
                </p>
              </div>
            </div>

            {/* BOTÓN DISPARAR LLAMADA */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                onClick={handleStartCall}
                disabled={isCalling}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] text-slate-950 font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-3 transition shadow-lg shadow-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed text-base cursor-pointer"
              >
                {isCalling ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Conectando con la red telefónica...</span>
                  </>
                ) : (
                  <>
                    <Phone className="w-5 h-5 fill-current" />
                    <span>Iniciar Llamada Telefónica (VOZ_IVR)</span>
                  </>
                )}
              </button>
            </div>

            {callStatusMessage && (
              <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-300 font-mono">{callStatusMessage}</span>
              </div>
            )}
          </div>

          {/* TARJETA INFORMATIVA / RECORDATORIO TRIAL */}
          <div className="bg-gradient-to-b from-amber-500/10 to-transparent border border-amber-500/30 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>Instrucción Crucial al Contestar</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Al ser una cuenta de Twilio <strong className="text-amber-300">Trial</strong>,
                al contestar la llamada escucharás un mensaje en inglés:
              </p>
              <div className="my-3 p-3 bg-amber-950/50 border border-amber-500/30 rounded-xl text-amber-200 text-xs italic">
                &ldquo;You have a trial account. You can press any key to execute your code.&rdquo;
              </div>
              <p className="text-xs text-amber-300 font-medium">
                👉 <strong>Presiona la tecla &apos;1&apos;</strong> en tu celular para que la recepcionista IA comience a atenderte de inmediato.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-amber-500/20 space-y-1.5 text-[11px] text-slate-400">
              <div className="flex items-center justify-between">
                <span>Adulto Mayor 75a (Cuota 60+):</span>
                <code className="text-emerald-300 bg-slate-900 px-2 py-0.5 rounded border border-emerald-500/30">
                  5.555.555-5
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span>Adulto Joven en padrón:</span>
                <code className="text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                  21.111.111-1
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span>No Inscrito (Deriva a SOME):</span>
                <code className="text-rose-300 bg-slate-900 px-2 py-0.5 rounded border border-rose-500/30">
                  21.222.222-2
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* MONITOR DE BASE DE DATOS POSTGRESQL EN TIEMPO REAL */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-semibold text-white">
                Monitor de Base de Datos PostgreSQL • Bloques Horarios de Hoy
              </h2>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500"></span>
                <span className="text-slate-300 font-medium">DISPONIBLE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500"></span>
                <span className="text-slate-300 font-medium">RESERVADO</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500"></span>
                <span className="text-slate-300 font-medium">Cuota 60+</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
            {slots.map((slot) => {
              const isOcupado = slot.estado === "RESERVADO" || slot.estado === "BLOQUEO_TEMPORAL";
              const isVoz = slot.canalOrigen === "VOZ_IVR";

              return (
                <div
                  key={slot.id || slot.hora}
                  className={`p-3.5 rounded-xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[140px] ${
                    isOcupado
                      ? "bg-rose-950/20 border-rose-800/60 shadow-lg shadow-rose-950/20"
                      : "bg-slate-950/70 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Clock
                          className={`w-4 h-4 ${
                            isOcupado ? "text-rose-400" : "text-emerald-400"
                          }`}
                        />
                        <span className="font-mono text-base font-bold text-white">
                          {slot.hora}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {slot.esCuotaMayor && !isOcupado && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            60+
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isOcupado
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {slot.estado}
                        </span>
                      </div>
                    </div>

                    {slot.profesionalNombre && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate mb-1">
                        <Stethoscope className="w-3 h-3 text-teal-400 shrink-0" />
                        <span className="truncate">{slot.profesionalNombre}</span>
                      </div>
                    )}

                    {slot.boxNumero && (
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 truncate mb-2">
                        <Building2 className="w-2.5 h-2.5 shrink-0" />
                        <span>{slot.boxNumero}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    {isOcupado ? (
                      <div className="pt-2 border-t border-rose-900/40 text-xs">
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <User className="w-3 h-3 text-rose-400" />
                          <span className="truncate">{slot.pacienteNombre || "Paciente"}</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-300 truncate mt-0.5">
                          {slot.rut || "Asignado"}
                        </div>

                        {slot.codigoReserva && (
                          <div className="mt-1 flex items-center justify-between text-[10px] bg-slate-900/80 px-1.5 py-0.5 rounded border border-rose-800/40">
                            <span className="text-slate-400 font-mono">{slot.codigoReserva}</span>
                            {isVoz && (
                              <span className="text-emerald-400 font-bold text-[9px] px-1 bg-emerald-500/20 rounded">
                                VOZ_IVR
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-800/80 text-[11px] text-emerald-400/80 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Disponible para agendar</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CONSOLA DE TRANSCRIPCIÓN EN VIVO Y SIMULADOR */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* CONSOLA DE VOZ */}
          <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col h-[520px] shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">
                  Consola de Transcripción Telefónica en Tiempo Real
                </h3>
              </div>
              {lastEngineUsed && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Motor: {lastEngineUsed === "fast_confirmation" ? "Fast Confirmation (<10ms)" : lastEngineUsed === "gemini" ? "Gemini 2.5 Flash" : "Fallback NLU (<5ms)"}
                </span>
              )}
            </div>

            <div
              ref={consoleScrollRef}
              className="flex-1 p-5 overflow-y-auto space-y-3.5 font-sans"
            >
              {allTranscripts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
                  <Volume2 className="w-8 h-8 text-slate-600" />
                  <p>Esperando conexión telefónica o interacción...</p>
                  <p className="text-[11px] text-slate-600 max-w-sm text-center">
                    Al llamar a tu teléfono, verás aparecer aquí cada palabra que digas
                    (transcrita por Twilio) y la respuesta generada por la recepcionista IA.
                  </p>
                </div>
              ) : (
                allTranscripts.map((entry) => {
                  if (entry.speaker === "system") {
                    return (
                      <div
                        key={entry.id}
                        className="text-center my-2 text-[11px] text-slate-500 font-mono italic"
                      >
                        — {entry.text} —
                      </div>
                    );
                  }

                  const isUser = entry.speaker === "user";
                  return (
                    <div
                      key={entry.id}
                      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-emerald-400" />
                        </div>
                      )}

                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                          isUser
                            ? "bg-emerald-600 text-slate-950 font-medium rounded-tr-none shadow-md shadow-emerald-600/10"
                            : "bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-tl-none"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1 opacity-70 text-[10px]">
                          <span className="font-semibold">
                            {isUser ? "Paciente (Voz Celular)" : "Recepcionista MallaSalud IA"}
                          </span>
                          <span>
                            {new Date(entry.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>
                        <p>{entry.text}</p>
                      </div>

                      {isUser && (
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-slate-300" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* BARRA DE ENTRADA RÁPIDA DE VOZ SIMULADA */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/80">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSimulate();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  placeholder="Escribe lo que dirías por teléfono (ej: 'Hola quiero a las 10 mi rut es 5555555-5')..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={isSimulating || !simText.trim()}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSimulating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Probar</span>
                </button>
              </form>
            </div>
          </div>

          {/* ACCESOS DIRECTOS Y PRUEBAS RÁPIDAS DE REGLAS */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">
                  Pruebas Rápidas de Reglas de Negocio
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Simula cada regla de MallaSalud con un solo clic para comprobar el comportamiento:
              </p>

              <div className="space-y-2">
                <button
                  onClick={() =>
                    handleSimulate(
                      "Hola quiero pedir hora para las diez de la mañana, mi RUT es 21.222.222-2"
                    )
                  }
                  className="w-full text-left p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-rose-800/40 hover:border-rose-700 text-xs text-slate-300 transition group cursor-pointer"
                >
                  <span className="text-[10px] text-rose-400 font-bold block mb-0.5">
                    Regla 1: Paciente No Inscrito (Derivar a SOME)
                  </span>
                  &ldquo;Quiero a las 10:00, mi RUT es 21.222.222-2&rdquo;
                </button>

                <button
                  onClick={() =>
                    handleSimulate(
                      "Hola, quiero hora a las 10 de la mañana, mi RUT es 5.555.555-5"
                    )
                  }
                  className="w-full text-left p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition group cursor-pointer"
                >
                  <span className="text-[10px] text-amber-400 font-bold block mb-0.5">
                    Regla 2: Adulto Mayor 75a pide hora ocupada (10:00)
                  </span>
                  &ldquo;Quiero a las 10:00, mi RUT es 5.555.555-5&rdquo;
                </button>

                <button
                  onClick={() => handleSimulate("Sí, me parece bien, la tomo")}
                  className="w-full text-left p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition group cursor-pointer"
                >
                  <span className="text-[10px] text-emerald-400 font-bold block mb-0.5">
                    Regla 3: Aceptar sugerencia (10:30)
                  </span>
                  &ldquo;Sí, me parece bien, la tomo&rdquo;
                </button>

                <button
                  onClick={() =>
                    handleSimulate(
                      "Hola quiero pedir otra hora a las 11:30, mi RUT es 5.555.555-5"
                    )
                  }
                  className="w-full text-left p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-amber-800/40 hover:border-amber-700 text-xs text-slate-300 transition group cursor-pointer"
                >
                  <span className="text-[10px] text-amber-400 font-bold block mb-0.5">
                    Regla 4: Cita Duplicada (Máximo 1 hora activa al día)
                  </span>
                  &ldquo;Quiero otra hora a las 11:30, mi RUT es 5.555.555-5&rdquo;
                </button>

                <button
                  onClick={() =>
                    handleSimulate(
                      "Hola quiero hora para el dentista a las 10:30, mi RUT es 21.111.111-1"
                    )
                  }
                  className="w-full text-left p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition group cursor-pointer"
                >
                  <span className="text-[10px] text-teal-400 font-bold block mb-0.5">
                    Regla 5: Elección de Especialidad Dental
                  </span>
                  &ldquo;Quiero hora para el dentista a las 10:30, mi RUT es 21.111.111-1&rdquo;
                </button>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                <HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />
                <span>Diseñado para Adultos Mayores</span>
              </div>
              <p className="text-slate-500">
                Pausas claras, trato empático y acceso automático a cuotas protegidas 60+.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
