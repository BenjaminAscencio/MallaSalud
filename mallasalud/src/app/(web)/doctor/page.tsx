"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  UserIcon,
  BuildingOfficeIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import "./doctor.css";

interface CitaBoxItem {
  id: string;
  codigo_reserva: string;
  estado_cita: "AGENDADA" | "ATENDIDA" | "NO_ASISTE";
  canal_origen: "WEB" | "VOZ_IVR" | "VENTANILLA_SOME";
  especialidad: string;
  hora_inicio: string;
  hora_fin: string;
  timestamp_inicio: string;
  timestamp_atencion: string | null;
  box_numero: string;
  minutos_desde_inicio: number;
  puede_marcar_atendida: boolean;
  puede_marcar_no_asiste: boolean;
  minutos_restantes_nsp: number;
  paciente: {
    id: string;
    rut: string;
    rut_formateado: string;
    nombre_completo: string;
    edad: number;
    telefono: string;
    contador_inasistencias: number;
  };
}

interface BoxResponse {
  profesional: {
    id: string;
    rut_formateado: string;
    nombre_completo: string;
    especialidad: string;
  };
  box_principal: string;
  fecha: string;
  contadores: {
    total: number;
    pendientes: number;
    atendidas: number;
    no_asiste: number;
  };
  citas: CitaBoxItem[];
}

export default function DoctorBoxPage() {
  const [data, setData] = useState<BoxResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargarNomina = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/v1/box/citas-hoy", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "No se pudo cargar la nómina del box clínico.");
      }
      setData(json);
    } catch (err: unknown) {
      setFeedback({
        tipo: "error",
        texto: err instanceof Error ? err.message : "Error cargando la agenda del día.",
      });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarNomina();
    const timer = setInterval(cargarNomina, 30000);
    return () => clearInterval(timer);
  }, [cargarNomina]);

  const marcarAsistencia = async (citaId: string, estado: "ATENDIDA" | "NO_ASISTE") => {
    setProcesandoId(citaId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/box/citas/${citaId}/asistencia`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado_cita: estado }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || json.mensaje || "No se pudo registrar la asistencia.");
      }
      setFeedback({
        tipo: "ok",
        texto: json.mensaje,
      });
      await cargarNomina();
    } catch (err: unknown) {
      setFeedback({
        tipo: "error",
        texto: err instanceof Error ? err.message : "Error al actualizar estado.",
      });
    } finally {
      setProcesandoId(null);
    }
  };

  const etiquetaEstado = (estado: CitaBoxItem["estado_cita"]) => {
    if (estado === "ATENDIDA") {
      return (
        <span className="doctor-stat-pill bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/40">
          <CheckCircleIcon className="w-3.5 h-3.5" />
          ATENDIDA
        </span>
      );
    }
    if (estado === "NO_ASISTE") {
      return (
        <span className="doctor-stat-pill bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-700/40">
          <XCircleIcon className="w-3.5 h-3.5" />
          NO_ASISTE (NSP)
        </span>
      );
    }
    return (
      <span className="doctor-stat-pill bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-700/40">
        <ClockIcon className="w-3.5 h-3.5" />
        PENDIENTE
      </span>
    );
  };

  return (
    <div className="doctor-page">
      <div className="doctor-container">
        {/* Cabecera Operativa de Box Clínico (Zero Dashboard) */}
        <section className="doctor-header-card">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-mint-pale dark:bg-teal-primary/25 text-teal-primary dark:text-teal-accent border border-border-subtle dark:border-border-dark-accent">
                Control de Asistencia en Box (HU-007)
              </span>
              {data?.box_principal && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted dark:text-text-dark-muted">
                  <BuildingOfficeIcon className="w-4 h-4 text-teal-primary dark:text-teal-accent" />
                  {data.box_principal}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-teal-deep dark:text-white tracking-tight">
              {data?.profesional
                ? `Nómina de Atención • ${data.profesional.nombre_completo}`
                : "Nómina Diaria de Box Clínico"}
            </h1>

            <div className="doctor-meta-chips">
              <span className="text-text-muted dark:text-text-dark-muted">
                Especialidad:{" "}
                <strong className="text-text-main dark:text-white">
                  {data?.profesional.especialidad.replace("_", " ") || "—"}
                </strong>
              </span>
              <span className="text-text-subtle">•</span>
              <span className="text-text-muted dark:text-text-dark-muted">
                Jornada: <strong className="font-mono text-text-main dark:text-white">{data?.fecha || "Hoy"}</strong>
              </span>
              <span className="text-text-subtle">•</span>
              <span className="text-text-muted dark:text-text-dark-muted">
                Tolerancia NSP: <strong>15 minutos</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data && (
              <>
                <span className="doctor-stat-pill bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800/40">
                  Pendientes: {data.contadores.pendientes}
                </span>
                <span className="doctor-stat-pill bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40">
                  Atendidas: {data.contadores.atendidas}
                </span>
                <span className="doctor-stat-pill bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/40">
                  NSP: {data.contadores.no_asiste}
                </span>
              </>
            )}

            <button
              type="button"
              id="btn-refresh-box"
              onClick={cargarNomina}
              disabled={cargando}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-surface-dark-elevated border border-border-subtle dark:border-border-dark hover:border-teal-primary text-text-main dark:text-white transition cursor-pointer"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${cargando ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </section>

        {feedback && (
          <div
            role="status"
            className={`p-3.5 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2 ${
              feedback.tipo === "ok"
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-200"
                : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-200"
            }`}
          >
            {feedback.tipo === "ok" ? (
              <CheckCircleIcon className="w-5 h-5 shrink-0" />
            ) : (
              <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
            )}
            <span>{feedback.texto}</span>
          </div>
        )}

        {/* Lista Operativa de Pacientes Citados */}
        <section className="doctor-roster-card">
          <div className="px-5 py-3.5 border-b border-border-subtle dark:border-border-dark bg-slate-50/80 dark:bg-surface-dark-bg flex items-center justify-between">
            <h2 className="text-sm font-bold text-text-main dark:text-white">
              Pacientes Citados del Día ({data?.citas.length ?? 0})
            </h2>
            <span className="text-[11px] text-text-subtle dark:text-text-dark-muted">
              Vista operativa exclusiva del tratante • Sin ficha clínica
            </span>
          </div>

          {cargando && !data ? (
            <div className="p-10 text-center text-sm text-text-muted dark:text-text-dark-muted">
              Cargando nómina de pacientes del box...
            </div>
          ) : !data || data.citas.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-text-main dark:text-white">
                No hay pacientes citados activos en tu box para hoy.
              </p>
              <p className="text-xs text-text-muted dark:text-text-dark-muted">
                Las reservas confirmadas por Portal Web, Ventanilla SOME o Central Telefónica IVR aparecerán aquí automáticamente.
              </p>
            </div>
          ) : (
            <div>
              {data.citas.map((cita) => {
                const rowClass =
                  cita.estado_cita === "ATENDIDA"
                    ? "doctor-row-atendida"
                    : cita.estado_cita === "NO_ASISTE"
                    ? "doctor-row-nsp"
                    : "doctor-row-pending";

                const enProcesamiento = procesandoId === cita.id;
                const esFutura = cita.minutos_desde_inicio < 0;

                return (
                  <div key={cita.id} className={rowClass} data-codigo-reserva={cita.codigo_reserva}>
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-base font-extrabold text-teal-deep dark:text-white bg-white dark:bg-surface-dark px-2.5 py-0.5 rounded-lg border border-border-subtle dark:border-border-dark">
                          {cita.hora_inicio} – {cita.hora_fin}
                        </span>
                        {etiquetaEstado(cita.estado_cita)}
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/80 dark:bg-surface-dark text-text-muted dark:text-slate-300 border border-border-subtle dark:border-border-dark">
                          {cita.codigo_reserva}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-surface-dark-elevated text-text-muted dark:text-text-dark-muted">
                          Origen: {cita.canal_origen}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        <UserIcon className="w-4 h-4 text-teal-primary dark:text-teal-accent shrink-0" />
                        <strong className="text-text-main dark:text-white">
                          {cita.paciente.nombre_completo}
                        </strong>
                        <span className="font-mono text-xs text-text-muted dark:text-text-dark-muted">
                          RUT {cita.paciente.rut_formateado}
                        </span>
                        <span className="text-xs text-text-subtle">
                          ({cita.paciente.edad} años)
                        </span>
                        {cita.paciente.contador_inasistencias > 0 && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/40">
                            Historial NSP: {cita.paciente.contador_inasistencias}
                          </span>
                        )}
                      </div>

                      {cita.estado_cita === "AGENDADA" && (
                        <p className="text-[11px] text-text-subtle dark:text-text-dark-muted">
                          {esFutura
                            ? `Cita programada para más tarde (en ${Math.abs(cita.minutos_desde_inicio)} min). Los botones se habilitan a la hora de inicio.`
                            : cita.puede_marcar_no_asiste
                            ? `Transcurrieron ${cita.minutos_desde_inicio} min desde la citación. Cumple tolerancia reglamentaria (≥ 15 min) para marcar NSP.`
                            : `Cita iniciada hace ${cita.minutos_desde_inicio} min. Faltan ${cita.minutos_restantes_nsp} min para cumplir tolerancia de No Asistió.`}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {cita.estado_cita === "AGENDADA" ? (
                        <>
                          <button
                            type="button"
                            disabled={!cita.puede_marcar_atendida || enProcesamiento}
                            onClick={() => marcarAsistencia(cita.id, "ATENDIDA")}
                            title={
                              esFutura
                                ? "No disponible antes de la hora de inicio de la cita"
                                : "Registrar paciente como Atendido"
                            }
                            className="doctor-btn-atendido"
                          >
                            <CheckCircleIcon className="w-4 h-4" />
                            <span>Atendido</span>
                          </button>

                          <button
                            type="button"
                            disabled={!cita.puede_marcar_no_asiste || enProcesamiento}
                            onClick={() => marcarAsistencia(cita.id, "NO_ASISTE")}
                            title={
                              esFutura
                                ? "No disponible en citas futuras"
                                : !cita.puede_marcar_no_asiste
                                ? `Debe esperar 15 min de tolerancia (faltan ${cita.minutos_restantes_nsp} min)`
                                : "Marcar Inasistencia (NO_ASISTE) y sumar +1 NSP"
                            }
                            className="doctor-btn-nsp"
                          >
                            <XCircleIcon className="w-4 h-4" />
                            <span>No Asistió (NSP)</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-medium text-text-subtle dark:text-text-dark-muted italic">
                          {cita.estado_cita === "ATENDIDA" && cita.timestamp_atencion
                            ? `Registrado ${new Date(cita.timestamp_atencion).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : "Estado cerrado"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
