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
  Send,
  RefreshCw,
  RotateCcw,
  AlertCircle,
  Volume2,
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

  // Limpiar historial visual para probar otra llamada sin reiniciar la BD
  const handleClearFlow = async () => {
    setSessions([]);
    setLastEngineUsed(null);
    setCallSidActive(`sim-browser-${Date.now()}`);
    try {
      const res = await fetch("/api/ivr/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_chat" }),
      });
      const data = await res.json();
      if (data.slots) setSlots(data.slots);
      if (data.activeSessions) setSessions(data.activeSessions);
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
    <div className="ivr-page">
      {/* CABECERA INSTITUCIONAL */}
      <div className="ivr-header-section">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-teal-primary text-white flex items-center justify-center shadow-xs shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-primary dark:text-mint-medium block">
                Canal Telefónico Automatizado • VOZ_IVR
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-main dark:text-text-dark-main">
                  Central Telefónica CESFAM
                </h1>
                <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-mint-pale dark:bg-surface-dark-accent text-teal-primary dark:text-mint-pale rounded-full border border-border-subtle dark:border-border-dark-accent">
                  PostgreSQL + Twilio
                </span>
              </div>
              <p className="text-xs text-text-muted dark:text-text-dark-muted mt-0.5">
                Validación en Padrón CESFAM, Cita Única Diaria y Cuota Protegida Adulto Mayor 60+
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-bg dark:bg-surface-dark-bg border border-border-subtle dark:border-border-dark-subtle text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-primary dark:bg-teal-accent ivr-badge-pulse"></span>
              <span className="text-text-main dark:text-text-dark-main font-medium">
                BD PostgreSQL en vivo (1.5s)
              </span>
            </div>
            <button
              onClick={handleResetSchedule}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-surface-dark-bg hover:bg-mint-lightest dark:hover:bg-surface-dark-muted text-text-main dark:text-mint-pale border border-border-subtle dark:border-border-dark-subtle transition cursor-pointer"
              title="Liberar citas y restaurar bloques de prueba en la base de datos"
            >
              <RefreshCw className="w-3.5 h-3.5 text-teal-primary dark:text-teal-accent" />
              Reiniciar Horas en BD
            </button>
          </div>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* PANEL SUPERIOR: CONEXIÓN TELEFÓNICA CLOUD Y GUÍA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 ivr-card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-primary dark:text-teal-accent" />
                <h2 className="text-base font-bold text-text-main dark:text-text-dark-main">
                  Conexión Telefónica Saliente (Cloud)
                </h2>
              </div>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-surface-dark-bg text-text-muted dark:text-text-dark-muted border border-border-subtle dark:border-border-dark-subtle">
                Twilio Voice API
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted dark:text-text-dark-muted mb-1.5">
                  URL Pública del Webhook (Cloudflare / Ngrok)
                </label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://xxxxx.trycloudflare.com"
                  className="w-full bg-slate-50 dark:bg-surface-dark-bg border border-border-subtle dark:border-border-dark-subtle rounded-lg px-3.5 py-2.5 text-sm text-text-main dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-primary/40 font-mono"
                />
                <p className="text-[11px] text-text-subtle dark:text-text-dark-muted mt-1">
                  Endpoint webhook de Twilio: <code className="text-teal-primary dark:text-teal-accent font-semibold">/api/twilio/voice</code>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted dark:text-text-dark-muted mb-1.5">
                  Número Telefónico Destino (Chile)
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+56937772647"
                  className="w-full bg-slate-50 dark:bg-surface-dark-bg border border-border-subtle dark:border-border-dark-subtle rounded-lg px-3.5 py-2.5 text-sm text-text-main dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-primary/40 font-mono"
                />
                <p className="text-[11px] text-text-subtle dark:text-text-dark-muted mt-1">
                  Número verificado en consola Twilio (+56937772647).
                </p>
              </div>
            </div>

            {/* BOTÓN DISPARAR LLAMADA */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={handleStartCall}
                disabled={isCalling}
                className="flex-1 bg-teal-primary hover:bg-teal-hover active:scale-[0.99] text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2.5 transition shadow-xs disabled:opacity-60 disabled:cursor-not-allowed text-sm sm:text-base cursor-pointer"
              >
                {isCalling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Conectando con la red telefónica...</span>
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4" />
                    <span>Iniciar Llamada Telefónica (VOZ_IVR)</span>
                  </>
                )}
              </button>
            </div>

            {callStatusMessage && (
              <div className="mt-4 p-3 rounded-lg bg-mint-lightest dark:bg-surface-dark-bg border border-border-subtle dark:border-border-dark-subtle text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-teal-primary dark:text-teal-accent shrink-0" />
                <span className="text-text-main dark:text-text-dark-main font-mono">{callStatusMessage}</span>
              </div>
            )}
          </div>

          {/* TARJETA INFORMATIVA / RECORDATORIO TRIAL */}
          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-5 sm:p-6 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm mb-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Instrucción al Contestar (Cuenta Trial)</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                En llamadas reales con Twilio <strong className="text-amber-900 dark:text-amber-200">Trial</strong>,
                al contestar escucharás primero el aviso:
              </p>
              <div className="my-2.5 p-2.5 bg-white dark:bg-surface-dark border border-amber-200 dark:border-amber-800/40 rounded-lg text-amber-900 dark:text-amber-200 text-xs italic">
                &ldquo;You have a trial account. You can press any key to execute your code.&rdquo;
              </div>
              <p className="text-xs text-amber-900 dark:text-amber-300 font-medium">
                Presiona la tecla &apos;1&apos; para iniciar la atención telefónica automatizada.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-amber-200/80 dark:border-amber-800/40 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>Adulto Mayor 75a (Cuota 60+):</span>
                <code className="text-teal-primary dark:text-teal-accent font-semibold bg-white dark:bg-surface-dark px-2 py-0.5 rounded border border-border-subtle dark:border-border-dark-subtle">
                  5.555.555-5
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span>Adulto Joven en padrón:</span>
                <code className="text-text-main dark:text-slate-200 font-semibold bg-white dark:bg-surface-dark px-2 py-0.5 rounded border border-border-subtle dark:border-border-dark-subtle">
                  21.111.111-1
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span>No Inscrito (Deriva a SOME):</span>
                <code className="text-rose-700 dark:text-rose-300 font-semibold bg-white dark:bg-surface-dark px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800/50">
                  21.222.222-2
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* MONITOR DE BASE DE DATOS POSTGRESQL EN TIEMPO REAL */}
        <section className="ivr-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-primary dark:text-teal-accent" />
              <h2 className="text-base font-bold text-text-main dark:text-text-dark-main">
                Monitor de Base de Datos PostgreSQL • Bloques Horarios de Hoy
              </h2>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-primary"></span>
                <span className="text-text-muted dark:text-text-dark-muted font-medium">DISPONIBLE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span className="text-text-muted dark:text-text-dark-muted font-medium">RESERVADO</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="text-text-muted dark:text-text-dark-muted font-medium">Cuota 60+</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {slots.map((slot) => {
              const isOcupado = slot.estado === "RESERVADO" || slot.estado === "BLOQUEO_TEMPORAL";
              const isVoz = slot.canalOrigen === "VOZ_IVR";

              return (
                <div
                  key={slot.id || slot.hora}
                  className={`p-3.5 rounded-xl border transition-all duration-300 flex flex-col justify-between min-h-[140px] ${
                    isOcupado
                      ? "bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60"
                      : "bg-mint-lightest/70 dark:bg-surface-dark-bg border-border-subtle dark:border-border-dark hover:border-teal-primary/60"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Clock
                          className={`w-4 h-4 ${
                            isOcupado ? "text-rose-600 dark:text-rose-400" : "text-teal-primary dark:text-teal-accent"
                          }`}
                        />
                        <span className="font-mono text-base font-bold text-text-main dark:text-white">
                          {slot.hora}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {slot.esCuotaMayor && !isOcupado && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                            60+
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isOcupado
                              ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30"
                              : "bg-mint-pale dark:bg-emerald-500/20 text-teal-primary dark:text-emerald-300 border border-border-subtle dark:border-emerald-500/30"
                          }`}
                        >
                          {slot.estado}
                        </span>
                      </div>
                    </div>

                    {slot.profesionalNombre && (
                      <div className="text-[11px] text-text-muted dark:text-slate-300 flex items-center gap-1 truncate mb-1">
                        <Stethoscope className="w-3 h-3 text-teal-primary dark:text-teal-accent shrink-0" />
                        <span className="truncate">{slot.profesionalNombre}</span>
                      </div>
                    )}

                    {slot.boxNumero && (
                      <div className="text-[10px] text-text-subtle dark:text-slate-400 flex items-center gap-1 truncate mb-2">
                        <Building2 className="w-2.5 h-2.5 shrink-0" />
                        <span>{slot.boxNumero}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    {isOcupado ? (
                      <div className="pt-2 border-t border-rose-200/80 dark:border-rose-900/40 text-xs">
                        <div className="text-[10px] text-text-muted dark:text-slate-300 flex items-center gap-1">
                          <User className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span className="truncate font-medium">{slot.pacienteNombre || "Paciente"}</span>
                        </div>
                        <div className="font-mono text-[11px] text-text-main dark:text-slate-200 truncate mt-0.5">
                          {slot.rut || "Asignado"}
                        </div>

                        {slot.codigoReserva && (
                          <div className="mt-1.5 flex items-center justify-between text-[10px] bg-white dark:bg-surface-dark px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800/40">
                            <span className="text-text-muted dark:text-slate-300 font-mono">{slot.codigoReserva}</span>
                            {isVoz && (
                              <span className="text-teal-primary dark:text-teal-accent font-bold text-[9px] px-1 bg-mint-pale dark:bg-teal-primary/20 rounded">
                                VOZ_IVR
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-border-subtle/80 dark:border-border-dark text-[11px] text-teal-primary dark:text-teal-accent flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>Disponible para agendar</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* REGISTRO DEL FLUJO TELEFÓNICO Y PRUEBAS DE REGLAS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* VENTANA DEL FLUJO DE ATENCIÓN */}
          <div className="lg:col-span-2 ivr-card flex flex-col h-[500px] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border-subtle dark:border-border-dark bg-slate-50/90 dark:bg-surface-dark-bg flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-teal-primary dark:text-teal-accent" />
                <h3 className="text-sm font-bold text-text-main dark:text-white">
                  Flujo de Atención Telefónica en Vivo
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {lastEngineUsed && (
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-white dark:bg-surface-dark text-text-muted dark:text-slate-300 border border-border-subtle dark:border-border-dark-subtle">
                    Procesamiento: {lastEngineUsed === "fast_confirmation" ? "Confirmación Directa" : lastEngineUsed === "gemini" ? "Motor Semántico" : "Reglas IVR"}
                  </span>
                )}
                <button
                  id="btn-limpiar-flujo-ivr"
                  type="button"
                  onClick={handleClearFlow}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white dark:bg-surface-dark hover:bg-mint-lightest dark:hover:bg-surface-dark-muted text-text-main dark:text-mint-pale border border-border-subtle dark:border-border-dark-subtle transition cursor-pointer"
                  title="Limpia el flujo en pantalla para probar una nueva llamada manteniendo las citas en BD"
                >
                  <RotateCcw className="w-3 h-3 text-teal-primary dark:text-teal-accent" />
                  Nueva Llamada / Limpiar Flujo
                </button>
              </div>
            </div>

            <div
              ref={consoleScrollRef}
              className="flex-1 p-5 overflow-y-auto space-y-3 bg-slate-50/40 dark:bg-surface-dark-bg/50 ivr-console-scroll font-sans"
            >
              {allTranscripts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-text-muted dark:text-text-dark-muted text-xs space-y-2">
                  <div className="w-11 h-11 rounded-full bg-mint-pale dark:bg-surface-dark flex items-center justify-center">
                    <Volume2 className="w-5 h-5 text-teal-primary dark:text-teal-accent" />
                  </div>
                  <p className="font-semibold text-text-main dark:text-white">
                    Esperando interacción telefónica...
                  </p>
                  <p className="text-[11px] text-text-subtle dark:text-text-dark-muted max-w-md text-center">
                    Aquí se registra paso a paso cada intervención del paciente y la respuesta del sistema de agendamiento telefónico.
                  </p>
                </div>
              ) : (
                allTranscripts.map((entry, idx) => {
                  if (entry.speaker === "system") {
                    return (
                      <div
                        key={entry.id}
                        className="text-center my-2 text-[11px] text-text-subtle dark:text-text-dark-muted font-mono"
                      >
                        — {entry.text} —
                      </div>
                    );
                  }

                  const isUser = entry.speaker === "user";
                  return (
                    <div
                      key={entry.id}
                      className={`rounded-xl border px-4 py-3 text-xs leading-relaxed transition-colors ${
                        isUser
                          ? "bg-mint-lightest dark:bg-surface-dark-accent border-border-subtle dark:border-border-dark-accent border-l-4 border-l-teal-primary ml-0 sm:ml-6"
                          : "bg-white dark:bg-surface-dark border-border-subtle dark:border-border-dark border-l-4 border-l-slate-400 mr-0 sm:mr-6 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1 text-[11px]">
                        <div className="flex items-center gap-1.5 font-semibold">
                          {isUser ? (
                            <User className="w-3.5 h-3.5 text-teal-primary dark:text-teal-accent" />
                          ) : (
                            <PhoneCall className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                          )}
                          <span className={isUser ? "text-teal-primary dark:text-mint-medium" : "text-text-main dark:text-white"}>
                            {isUser ? `Paso ${idx + 1} • Paciente (Voz)` : `Paso ${idx + 1} • Central Telefónica MallaSalud`}
                          </span>
                        </div>
                        <span className="text-text-subtle dark:text-slate-400 font-mono text-[10px]">
                          {new Date(entry.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-text-main dark:text-slate-200 pl-5">{entry.text}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* BARRA DE ENTRADA MANUAL DEL FLUJO */}
            <div className="p-3.5 border-t border-border-subtle dark:border-border-dark bg-white dark:bg-surface-dark">
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
                  placeholder="Ingresa una frase del paciente (ej: 'Hola quiero a las 10 mi rut es 5555555-5')..."
                  className="flex-1 bg-slate-50 dark:bg-surface-dark-bg border border-border-subtle dark:border-border-dark-subtle rounded-lg px-3.5 py-2 text-xs text-text-main dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-primary/40"
                />
                <button
                  type="submit"
                  disabled={isSimulating || !simText.trim()}
                  className="bg-teal-primary hover:bg-teal-hover text-white font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
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
          <div className="ivr-card p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-primary dark:text-teal-accent" />
                <h3 className="text-sm font-bold text-text-main dark:text-white">
                  Pruebas Rápidas de Reglas de Negocio
                </h3>
              </div>
              <p className="text-[11px] text-text-muted dark:text-text-dark-muted mb-3">
                Ejecuta cada regla del flujo telefónico con un clic para verificar el comportamiento:
              </p>

              <div className="space-y-2">
                <button
                  onClick={() =>
                    handleSimulate(
                      "Hola quiero pedir hora para las diez de la mañana, mi RUT es 21.222.222-2"
                    )
                  }
                  className="w-full text-left p-2.5 rounded-lg bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-xs text-text-main dark:text-slate-200 transition cursor-pointer"
                >
                  <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold block mb-0.5">
                    Regla 1: Paciente No Inscrito (Derivar a SOME)
                  </span>
                  &ldquo;Quiero a las 10:00, mi RUT es 21.222.222-2&rdquo;
                </button>

                <button
                  onClick={() =>
                    handleSimulate(
                      "Hola, quiero hora para medicina a las 11 de la mañana, mi RUT es 21.111.111-1"
                    )
                  }
                  className="w-full text-left p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-text-main dark:text-slate-200 transition cursor-pointer"
                >
                  <span className="text-[10px] text-amber-800 dark:text-amber-400 font-bold block mb-0.5">
                    Regla 2: Hora Ocupada — Recomendar Antes y Después
                  </span>
                  &ldquo;Quiero a las 11:00, mi RUT es 21.111.111-1&rdquo;
                </button>

                <button
                  onClick={() => handleSimulate("Prefiero la de después, a las 11:30")}
                  className="w-full text-left p-2.5 rounded-lg bg-mint-lightest dark:bg-surface-dark-bg hover:bg-mint-pale/60 dark:hover:bg-surface-dark-muted border border-border-subtle dark:border-border-dark-subtle text-xs text-text-main dark:text-slate-200 transition cursor-pointer"
                >
                  <span className="text-[10px] text-teal-primary dark:text-teal-accent font-bold block mb-0.5">
                    Regla 3: Elegir Alternativa Recomendada (11:30)
                  </span>
                  &ldquo;Prefiero la de después, a las 11:30&rdquo;
                </button>

                <button
                  onClick={() =>
                    handleSimulate(
                      "Hola quiero pedir otra hora a las 12:00, mi RUT es 21.111.111-1"
                    )
                  }
                  className="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark-bg hover:bg-slate-100 dark:hover:bg-surface-dark-muted border border-amber-200 dark:border-amber-800/40 text-xs text-text-main dark:text-slate-200 transition cursor-pointer"
                >
                  <span className="text-[10px] text-amber-800 dark:text-amber-400 font-bold block mb-0.5">
                    Regla 4: Cita Duplicada (Ofrecer Reagendar 12:00)
                  </span>
                  &ldquo;Quiero otra hora a las 12:00, mi RUT es 21.111.111-1&rdquo;
                </button>

                <button
                  onClick={() =>
                    handleSimulate("Sí, por favor anula la anterior y reagenda a las 12:00")
                  }
                  className="w-full text-left p-2.5 rounded-lg bg-mint-lightest dark:bg-surface-dark-bg hover:bg-mint-pale/60 dark:hover:bg-surface-dark-muted border border-border-subtle dark:border-border-dark-subtle text-xs text-text-main dark:text-slate-200 transition cursor-pointer"
                >
                  <span className="text-[10px] text-teal-primary dark:text-teal-accent font-bold block mb-0.5">
                    Regla 5: Anular Anterior y Reagendar (12:00)
                  </span>
                  &ldquo;Sí, anula la anterior y reagenda a las 12:00&rdquo;
                </button>

                <button
                  onClick={() =>
                    handleSimulate(
                      "Hola, quiero hora a las 10 de la mañana, mi RUT es 5.555.555-5"
                    )
                  }
                  className="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-surface-dark-bg hover:bg-mint-lightest dark:hover:bg-surface-dark-muted border border-border-subtle dark:border-border-dark-subtle text-xs text-text-main dark:text-slate-200 transition cursor-pointer"
                >
                  <span className="text-[10px] text-teal-primary dark:text-teal-accent font-bold block mb-0.5">
                    Extra: Adulto Mayor 75a (Cuota 60+ · 10:00 Ocupada)
                  </span>
                  &ldquo;Quiero a las 10:00, mi RUT es 5.555.555-5&rdquo;
                </button>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border-subtle dark:border-border-dark text-[11px] text-text-muted dark:text-text-dark-muted space-y-1">
              <div className="flex items-center gap-1.5 text-text-main dark:text-white font-semibold">
                <HeartHandshake className="w-3.5 h-3.5 text-teal-primary dark:text-teal-accent" />
                <span>Diseñado para Adultos Mayores</span>
              </div>
              <p className="text-text-subtle dark:text-text-dark-muted">
                Pausas claras, trato empático y acceso automático a cuotas protegidas 60+.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
