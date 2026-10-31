"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { formatearRut, limpiarRut } from "@/lib/utils/rut";
import {
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  IdentificationIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  ArrowLeftIcon,
  PrinterIcon,
  SparklesIcon,
  HeartIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import "./page.css";

interface PacienteData {
  id: string;
  rut: string;
  rut_formateado: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  fecha_nacimiento: string;
  edad: number;
  telefono: string;
  es_adulto_mayor: boolean;
  tiene_inasistencias: boolean;
  contador_inasistencias: number;
  estado_inscripcion: boolean;
}

interface EspecialidadResumen {
  nombre: string;
  codigo: "MEDICINA_GENERAL" | "DENTAL" | "MATRONERIA";
  descripcion: string;
  icono: "medicina" | "dental" | "matroneria";
  cuposDisponibles: number;
  cuposProtegidos60: number;
}

interface CupoBloque {
  id: string;
  agenda_id: string;
  especialidad: "MEDICINA_GENERAL" | "DENTAL" | "MATRONERIA";
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  timestamp_inicio: string;
  timestamp_fin: string;
  es_cuota_adulto_mayor: boolean;
  es_cancelacion_reciente?: boolean;
  profesional: {
    id: string;
    nombre_completo: string;
    rut: string;
    especialidad: string;
  };
  box: {
    id: string;
    numero: string;
  };
}

interface ComprobanteReserva {
  codigo_reserva: string;
  cita_id: string;
  especialidad: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  profesional: string;
  box: string;
  paciente_nombre: string;
  paciente_rut: string;
  telefono: string;
  es_adulto_mayor: boolean;
}

interface CitaActiva {
  id: string;
  codigo_reserva: string;
  especialidad: string;
  estado_cita: string;
  created_at: string;
  profesional: {
    nombres: string;
    apellidos: string;
    especialidad: string;
  };
  bloque: {
    hora_inicio: string;
    hora_fin: string;
    es_cuota_adulto_mayor?: boolean;
    agenda?: {
      fecha?: string;
      box?: {
        numero: string;
      };
    };
  };
}

function formatearHoraIso(valor: string): string {
  if (!valor) return "--:--";
  if (/^\d{2}:\d{2}$/.test(valor)) return valor;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return valor;
  return d.toISOString().substring(11, 16);
}

function formatearFechaLegible(fechaIso: string): string {
  if (!fechaIso) return "";
  const limpia = fechaIso.split("T")[0];
  const partes = limpia.split("-");
  if (partes.length !== 3) return fechaIso;
  const d = new Date(`${limpia}T12:00:00`);
  if (isNaN(d.getTime())) return limpia;
  return d.toLocaleDateString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PortalPacientePage() {
  // Pestaña principal: "RESERVAR" o "ADMINISTRAR"
  const [modoPrincipal, setModoPrincipal] = useState<"RESERVAR" | "ADMINISTRAR">("RESERVAR");

  // Sub-opción: ¿Para quién es la atención?
  const [tipoPaciente, setTipoPaciente] = useState<"PROPIO" | "TERCERO">("PROPIO");

  // Estado del flujo de Reserva: 1 = Identificación, 2 = Especialidad, 3 = Horarios y Box, 4 = Comprobante
  const [pasoActual, setPasoActual] = useState<1 | 2 | 3 | 4>(1);

  // Estados de entrada y validación RUT
  const [rutInput, setRutInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noInscrito, setNoInscrito] = useState(false);
  const [mostrarModalNsp, setMostrarModalNsp] = useState(false);
  const [mostrarPanelPrueba, setMostrarPanelPrueba] = useState(false);

  // Paciente autenticado y catálogo de especialidades
  const [pacienteActivo, setPacienteActivo] = useState<PacienteData | null>(null);
  const [especialidades, setEspecialidades] = useState<EspecialidadResumen[]>([]);
  const [cargandoCupos, setCargandoCupos] = useState(false);

  // Filtros y selección de especialidad
  const [tabFiltro, setTabFiltro] = useState<"TODAS" | "MEDICINA_GENERAL" | "DENTAL" | "MATRONERIA">("TODAS");
  const [especialidadSeleccionada, setEspecialidadSeleccionada] = useState<"MEDICINA_GENERAL" | "DENTAL" | "MATRONERIA" | null>(null);

  // Bloques horarios y reserva
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>("2026-10-18");
  const [bloquesDisponibles, setBloquesDisponibles] = useState<CupoBloque[]>([]);
  const [cargandoBloques, setCargandoBloques] = useState(false);
  const [filtroJornada, setFiltroJornada] = useState<"TODAS" | "MANANA" | "TARDE">("TODAS");
  const [bloqueSeleccionado, setBloqueSeleccionado] = useState<CupoBloque | null>(null);
  const [confirmandoReserva, setConfirmandoReserva] = useState(false);
  const [errorReservaMsg, setErrorReservaMsg] = useState<string | null>(null);
  const [comprobanteGenerado, setComprobanteGenerado] = useState<ComprobanteReserva | null>(null);

  // Estado del modo "Administrar mi Cita"
  const [rutAdminInput, setRutAdminInput] = useState("");
  const [cargandoAdmin, setCargandoAdmin] = useState(false);
  const [citasDelPaciente, setCitasDelPaciente] = useState<CitaActiva[]>([]);
  const [pacienteAdmin, setPacienteAdmin] = useState<PacienteData | null>(null);
  const [adminBuscado, setAdminBuscado] = useState(false);
  const [anulandoCitaId, setAnulandoCitaId] = useState<string | null>(null);
  const [citaPorAnular, setCitaPorAnular] = useState<CitaActiva | null>(null);
  const [mensajeExitoAdmin, setMensajeExitoAdmin] = useState<string | null>(null);
  const [errorAdminMsg, setErrorAdminMsg] = useState<string | null>(null);

  // FAQ colapsable
  const [faqAbierta, setFaqAbierta] = useState<number | null>(0);

  // Opciones rápidas de fechas (Hoy + próximos 3 días)
  const opcionesFechas = useMemo(() => {
    const base = new Date("2026-10-18T12:00:00");
    return [0, 1, 2, 3].map((offset) => {
      const d = new Date(base);
      d.setDate(base.getDate() + offset);
      const iso = d.toISOString().split("T")[0];
      const etiqueta =
        offset === 0
          ? "Hoy"
          : offset === 1
          ? "Mañana"
          : d.toLocaleDateString("es-CL", { weekday: "short" });
      const diaMes = d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
      return { iso, etiqueta, diaMes };
    });
  }, []);

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const limpio = limpiarRut(raw);
    if (limpio.length <= 9) {
      setRutInput(formatearRut(limpio));
    }
    setErrorMsg(null);
    setNoInscrito(false);
  };

  const seleccionarRutPrueba = (rutPrueba: string) => {
    setRutInput(formatearRut(rutPrueba));
    setErrorMsg(null);
    setNoInscrito(false);
  };

  // Consultar disponibilidad general de cupos por especialidad
  const consultarCuposEspecialidades = useCallback(
    async (esMayor: boolean, fecha = fechaSeleccionada) => {
      setCargandoCupos(true);
      try {
        const res = await fetch(
          `/api/v1/some/cupos-disponibles?es_adulto_mayor=${esMayor}&fecha=${fecha}`
        );
        if (!res.ok) throw new Error("No fue posible cargar cupos");
        const data = await res.json();
        const cupos: CupoBloque[] = data.cupos || [];

        const lista: EspecialidadResumen[] = [
          {
            nombre: "Medicina General",
            codigo: "MEDICINA_GENERAL",
            descripcion:
              "Atención médica integral para diagnóstico, controles preventivos, patologías crónicas y derivación.",
            icono: "medicina",
            cuposDisponibles: cupos.filter((c) => c.especialidad === "MEDICINA_GENERAL").length,
            cuposProtegidos60: cupos.filter(
              (c) => c.especialidad === "MEDICINA_GENERAL" && c.es_cuota_adulto_mayor
            ).length,
          },
          {
            nombre: "Urgencia Dental",
            codigo: "DENTAL",
            descripcion:
              "Alivio del dolor odontológico agudo, infecciones dentales y evaluación clínica de urgencia.",
            icono: "dental",
            cuposDisponibles: cupos.filter((c) => c.especialidad === "DENTAL").length,
            cuposProtegidos60: cupos.filter(
              (c) => c.especialidad === "DENTAL" && c.es_cuota_adulto_mayor
            ).length,
          },
          {
            nombre: "Matronería",
            codigo: "MATRONERIA",
            descripcion:
              "Salud sexual y reproductiva, control prenatal, ginecología preventiva y salud de la mujer.",
            icono: "matroneria",
            cuposDisponibles: cupos.filter((c) => c.especialidad === "MATRONERIA").length,
            cuposProtegidos60: cupos.filter(
              (c) => c.especialidad === "MATRONERIA" && c.es_cuota_adulto_mayor
            ).length,
          },
        ];
        setEspecialidades(lista);
      } catch {
        setEspecialidades([]);
      } finally {
        setCargandoCupos(false);
      }
    },
    [fechaSeleccionada]
  );

  // Cargar bloques de una especialidad específica para el paso 3
  const seleccionarEspecialidad = async (
    codigo: "MEDICINA_GENERAL" | "DENTAL" | "MATRONERIA",
    fecha = fechaSeleccionada
  ) => {
    setEspecialidadSeleccionada(codigo);
    setBloqueSeleccionado(null);
    setErrorReservaMsg(null);
    setCargandoBloques(true);
    setPasoActual(3);

    try {
      const esMayor = pacienteActivo?.es_adulto_mayor ?? false;
      const res = await fetch(
        `/api/v1/some/cupos-disponibles?especialidad=${codigo}&es_adulto_mayor=${esMayor}&fecha=${fecha}`
      );
      if (!res.ok) throw new Error("Error al obtener horarios");
      const data = await res.json();
      setBloquesDisponibles(data.cupos || []);
    } catch {
      setBloquesDisponibles([]);
    } finally {
      setCargandoBloques(false);
    }
  };

  // Cambiar fecha en Paso 2 o Paso 3
  const handleCambiarFecha = async (nuevaFecha: string) => {
    setFechaSeleccionada(nuevaFecha);
    setBloqueSeleccionado(null);
    setErrorReservaMsg(null);
    if (pacienteActivo) {
      consultarCuposEspecialidades(pacienteActivo.es_adulto_mayor, nuevaFecha);
      if (pasoActual === 3 && especialidadSeleccionada) {
        await seleccionarEspecialidad(especialidadSeleccionada, nuevaFecha);
      }
    }
  };

  // Verificar RUT en padrón
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNoInscrito(false);

    if (!rutInput.trim()) {
      setErrorMsg("Por favor ingrese el RUT del paciente para continuar.");
      return;
    }

    setCargando(true);
    try {
      const res = await fetch("/api/v1/pacientes/verificar-rut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rut: rutInput }),
      });

      const data = await res.json();

      if (res.status === 400) {
        setErrorMsg(data.mensaje || "El RUT ingresado no es válido según el algoritmo chileno.");
        return;
      }

      if (res.status === 404) {
        setNoInscrito(true);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Error al verificar RUT");
      }

      const paciente: PacienteData = data.paciente;

      if (paciente.tiene_inasistencias) {
        setMostrarModalNsp(true);
      }

      setPacienteActivo(paciente);
      setPasoActual(2);
      consultarCuposEspecialidades(paciente.es_adulto_mayor, fechaSeleccionada);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error de conexión con el servidor.";
      setErrorMsg(msg);
    } finally {
      setCargando(false);
    }
  };

  // Confirmar reserva del bloque seleccionado
  const handleConfirmarReserva = async () => {
    if (!pacienteActivo || !bloqueSeleccionado) return;

    setConfirmandoReserva(true);
    setErrorReservaMsg(null);
    try {
      const res = await fetch("/api/v1/some/citas/agendar-ventanilla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paciente_id: pacienteActivo.id,
          bloque_id: bloqueSeleccionado.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No fue posible confirmar la reserva");
      }

      const comprobante: ComprobanteReserva = {
        codigo_reserva:
          data.comprobante?.codigo_reserva || "MS-" + Math.floor(1000 + Math.random() * 9000),
        cita_id: data.cita?.id || data.comprobante?.cita_id || "",
        especialidad: bloqueSeleccionado.especialidad.replace("_", " "),
        fecha: bloqueSeleccionado.fecha,
        hora_inicio: bloqueSeleccionado.hora_inicio,
        hora_fin: bloqueSeleccionado.hora_fin,
        profesional: bloqueSeleccionado.profesional.nombre_completo,
        box: bloqueSeleccionado.box.numero,
        paciente_nombre: pacienteActivo.nombre_completo,
        paciente_rut: pacienteActivo.rut_formateado,
        telefono: pacienteActivo.telefono,
        es_adulto_mayor: pacienteActivo.es_adulto_mayor,
      };

      setComprobanteGenerado(comprobante);
      setPasoActual(4);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar la reserva";
      setErrorReservaMsg(msg);
    } finally {
      setConfirmandoReserva(false);
    }
  };

  // Consultar citas del paciente en modo "Administrar mi Cita"
  const buscarCitasPorRut = async (rutTarget: string) => {
    setMensajeExitoAdmin(null);
    setErrorAdminMsg(null);
    if (!rutTarget.trim()) return;

    setCargandoAdmin(true);
    setAdminBuscado(true);
    try {
      const res = await fetch(`/api/v1/some/pacientes/${encodeURIComponent(rutTarget.trim())}`);
      if (!res.ok) {
        setPacienteAdmin(null);
        setCitasDelPaciente([]);
        return;
      }
      const data = await res.json();
      setPacienteAdmin(data.paciente);
      setCitasDelPaciente(data.paciente?.citas || []);
    } catch {
      setPacienteAdmin(null);
      setCitasDelPaciente([]);
    } finally {
      setCargandoAdmin(false);
    }
  };

  const handleBuscarCitasAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    await buscarCitasPorRut(rutAdminInput);
  };

  // Confirmar anulación desde el modal propio
  const ejecutarAnulacionCita = async () => {
    if (!citaPorAnular) return;
    const citaId = citaPorAnular.id;

    setAnulandoCitaId(citaId);
    setErrorAdminMsg(null);
    try {
      const res = await fetch(`/api/v1/citas/${citaId}/cancelar`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo anular la cita");

      setMensajeExitoAdmin(
        "✓ Cita médica anulada oportunamente. El cupo ha sido liberado en tiempo real para la comunidad y no se computó inasistencia (NSP) en su historial."
      );

      setCitasDelPaciente((prev) =>
        prev.map((c) => (c.id === citaId ? { ...c, estado_cita: "CANCELADA_OPORTUNA" } : c))
      );
      setCitaPorAnular(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cancelar la cita";
      setErrorAdminMsg(msg);
      setCitaPorAnular(null);
    } finally {
      setAnulandoCitaId(null);
    }
  };

  const handleCerrarSesion = () => {
    setPacienteActivo(null);
    setRutInput("");
    setNoInscrito(false);
    setErrorMsg(null);
    setErrorReservaMsg(null);
    setMostrarModalNsp(false);
    setPasoActual(1);
    setEspecialidadSeleccionada(null);
    setBloquesDisponibles([]);
    setBloqueSeleccionado(null);
    setComprobanteGenerado(null);
  };

  // Filtrado de bloques horarios por fecha y jornada (Mañana / Tarde)
  const bloquesFiltrados = bloquesDisponibles.filter((b) => {
    if (b.fecha !== fechaSeleccionada) return false;
    if (filtroJornada === "TODAS") return true;
    const horaNum = parseInt(b.hora_inicio.split(":")[0], 10);
    if (filtroJornada === "MANANA") return horaNum < 13;
    if (filtroJornada === "TARDE") return horaNum >= 13;
    return true;
  });

  // Agrupar bloques por profesional y fecha
  const profesionalesConBloques = Array.from(
    new Set(bloquesFiltrados.map((b) => `${b.profesional.id}_${b.fecha}`))
  ).map((key) => {
    const bloquesDelProf = bloquesFiltrados.filter((b) => `${b.profesional.id}_${b.fecha}` === key);
    return {
      profesional: bloquesDelProf[0].profesional,
      box: bloquesDelProf[0].box,
      fecha: bloquesDelProf[0].fecha,
      bloques: bloquesDelProf,
    };
  });

  const especialidadesFiltradas = especialidades.filter((esp) => {
    if (tabFiltro === "TODAS") return true;
    return esp.codigo === tabFiltro;
  });

  const stepsInfo = [
    { num: 1, label: "Identificación" },
    { num: 2, label: "Especialidad" },
    { num: 3, label: "Horario y Box" },
    { num: 4, label: "Comprobante" },
  ] as const;

  return (
    <div className="portal-page">
      
      {/* ==================================================================== */}
      {/* 1. HERO INSTITUCIONAL ESTILO REDSALUD (Oculto al imprimir)           */}
      {/* ==================================================================== */}
      <section className="portal-hero">
        <div className="portal-hero-inner">
          <h1 className="portal-hero-title">
            Reserva tu Hora <span className="portal-hero-highlight">Médica y Dental</span>
          </h1>

          <p className="portal-hero-subtitle">
            Plataforma en línea de atención primaria. Obtén tu cita sin filas de madrugada, con resguardo automático del{" "}
            <strong className="portal-hero-strong">30% de cupos protegidos para personas mayores de 60 años</strong>.
          </p>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 2. CARD PRINCIPAL DE AGENDAMIENTO                                    */}
      {/* ==================================================================== */}
      <section id="especialidades" className="portal-main-section">
        
        <div className="portal-main-card">
          
          {/* Header Switcher: "Reservar Cita" vs "Administrar / Anular mi Cita" */}
          <div className="portal-mode-tabs">
            <button
              type="button"
              id="tab-reservar-hora"
              onClick={() => setModoPrincipal("RESERVAR")}
              className={
                modoPrincipal === "RESERVAR" ? "portal-mode-tab-active" : "portal-mode-tab"
              }
            >
              <CalendarDaysIcon
                className={
                  modoPrincipal === "RESERVAR"
                    ? "portal-mode-tab-icon-active"
                    : "portal-mode-tab-icon"
                }
              />
              <span>Reservar Hora Médica</span>
            </button>

            <button
              type="button"
              id="tab-administrar-cita"
              onClick={() => setModoPrincipal("ADMINISTRAR")}
              className={
                modoPrincipal === "ADMINISTRAR" ? "portal-mode-tab-active" : "portal-mode-tab"
              }
            >
              <MagnifyingGlassIcon
                className={
                  modoPrincipal === "ADMINISTRAR"
                    ? "portal-mode-tab-icon-active"
                    : "portal-mode-tab-icon"
                }
              />
              <span>Administrar / Anular Cita</span>
            </button>
          </div>

          <div className="portal-card-body">

            {/* -------------------------------------------------------------- */}
            {/* VISTA 1: FLUJO DE RESERVA DE CITAS                             */}
            {/* -------------------------------------------------------------- */}
            {modoPrincipal === "RESERVAR" && (
              <div>
                
                {/* Stepper Interactivo de 4 Pasos (Oculto al imprimir) */}
                <div className="portal-stepper-wrap">
                  <div className="portal-stepper-row">
                    {stepsInfo.map((step, index) => {
                      const completado = pasoActual > step.num;
                      const activo = pasoActual === step.num;
                      const puedeRetroceder = completado && pasoActual < 4;

                      return (
                        <div key={step.num} className="portal-step-item">
                          <button
                            type="button"
                            disabled={!puedeRetroceder}
                            onClick={() => {
                              if (puedeRetroceder) {
                                setPasoActual(step.num);
                              }
                            }}
                            className={`${
                              puedeRetroceder ? "portal-step-btn-clickable" : "portal-step-btn"
                            } group`}
                            title={puedeRetroceder ? `Volver al paso ${step.num}: ${step.label}` : step.label}
                          >
                            <div
                              className={
                                completado
                                  ? "portal-step-circle-done"
                                  : activo
                                  ? "portal-step-circle-active"
                                  : "portal-step-circle-pending"
                              }
                            >
                              {completado ? <CheckIcon className="portal-step-check-icon" /> : step.num}
                            </div>
                            <span
                              className={
                                activo
                                  ? "portal-step-label-active"
                                  : completado
                                  ? "portal-step-label-done"
                                  : "portal-step-label-pending"
                              }
                            >
                              {step.label}
                            </span>
                          </button>

                          {index < stepsInfo.length - 1 && (
                            <div
                              className={
                                pasoActual > step.num
                                  ? "portal-step-line-done"
                                  : "portal-step-line"
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ========================================================== */}
                {/* BARRA PERSISTENTE DEL PACIENTE ACTIVO (PASOS 2 Y 3)        */}
                {/* ========================================================== */}
                {(pasoActual === 2 || pasoActual === 3) && pacienteActivo && (
                  <div className="portal-patient-banner-wrap">
                    <div className="portal-patient-banner">
                      <div className="portal-patient-info">
                        <div className="portal-patient-avatar">
                          <UserIcon className="portal-patient-avatar-icon" />
                        </div>
                        <div>
                          <div className="portal-patient-title-row">
                            <h3 className="portal-patient-name">
                              {pacienteActivo.nombre_completo}
                            </h3>
                            {pacienteActivo.es_adulto_mayor ? (
                              <span className="portal-badge-senior-priority">
                                ★ Prioridad Adulto Mayor (60+)
                              </span>
                            ) : (
                              <span className="portal-badge-fonasa">
                                Paciente Fonasa Inscrito
                              </span>
                            )}
                          </div>
                          <div className="portal-patient-meta-row">
                            <span>
                              RUT: <strong className="portal-patient-meta-mono">{pacienteActivo.rut_formateado}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Edad: <strong className="portal-patient-meta-strong">{pacienteActivo.edad} años</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Contacto: <strong className="portal-patient-meta-mono">{pacienteActivo.telefono}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleCerrarSesion}
                        className="portal-patient-change-btn"
                      >
                        Cambiar Paciente / RUT
                      </button>
                    </div>

                    {/* Aviso destacado si el paciente tiene prioridad 60+ */}
                    {pacienteActivo.es_adulto_mayor && (
                      <div className="portal-senior-notice">
                        <ShieldCheckIcon className="portal-senior-notice-icon" />
                        <p>
                          <strong>Beneficio Adulto Mayor Activo:</strong> Se han desbloqueado los bloques horarios marcados con{" "}
                          <span className="portal-senior-inline-tag">
                            ★ 60+
                          </span>{" "}
                          correspondientes al 30% de cuota protegida en Medicina General.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ========================================================== */}
                {/* PASO 1: Identificación del Paciente (RUT)                   */}
                {/* ========================================================== */}
                {pasoActual === 1 && (
                  <div className="portal-step1-container">
                    
                    {/* Selector: "¿Para quién es la hora?" */}
                    <div className="portal-target-selector-box">
                      <label className="portal-target-selector-label">
                        ¿Para quién es la atención médica?
                      </label>
                      <div className="portal-target-selector-grid">
                        <button
                          type="button"
                          onClick={() => setTipoPaciente("PROPIO")}
                          className={
                            tipoPaciente === "PROPIO"
                              ? "portal-target-option-active"
                              : "portal-target-option"
                          }
                        >
                          <div
                            className={
                              tipoPaciente === "PROPIO"
                                ? "portal-radio-outer-active"
                                : "portal-radio-outer"
                            }
                          >
                            {tipoPaciente === "PROPIO" && <div className="portal-radio-inner" />}
                          </div>
                          <span>Para mí</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTipoPaciente("TERCERO")}
                          className={
                            tipoPaciente === "TERCERO"
                              ? "portal-target-option-active"
                              : "portal-target-option"
                          }
                        >
                          <div
                            className={
                              tipoPaciente === "TERCERO"
                                ? "portal-radio-outer-active"
                                : "portal-radio-outer"
                            }
                          >
                            {tipoPaciente === "TERCERO" && <div className="portal-radio-inner" />}
                          </div>
                          <span>Familiar / Adulto Mayor</span>
                        </button>
                      </div>
                    </div>

                    <div className="portal-step-heading-box">
                      <h2 className="portal-step-heading">
                        {tipoPaciente === "PROPIO" ? "Ingresa tu RUT para comenzar" : "Ingresa el RUT del Paciente"}
                      </h2>
                      <p className="portal-step-subheading">
                        Validamos automáticamente tu inscripción en el CESFAM y habilitamos los cupos preferentes 60+ según tu edad.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="portal-rut-form">
                      <div>
                        <label
                          htmlFor="rutInput"
                          className="portal-rut-label"
                        >
                          RUT del Paciente (se formatea automáticamente)
                        </label>
                        <div className="portal-rut-input-wrap">
                          <div className="portal-rut-icon-wrap">
                            <IdentificationIcon className="portal-rut-icon" />
                          </div>
                          <input
                            id="rutInput"
                            type="text"
                            inputMode="numeric"
                            value={rutInput}
                            onChange={handleRutChange}
                            placeholder="Ej: 5.555.555-5 o 21.111.111-1"
                            className="portal-rut-input"
                            autoFocus
                          />
                        </div>
                      </div>

                      {/* Mensaje de RUT Inválido (400) */}
                      {errorMsg && (
                        <div className="portal-alert-error">
                          <ExclamationTriangleIcon className="portal-alert-error-icon" />
                          <div>
                            <strong className="portal-alert-error-title">RUT No Válido</strong>
                            <span>{errorMsg}</span>
                          </div>
                        </div>
                      )}

                      {/* Mensaje de Paciente No Inscrito (404) */}
                      {noInscrito && (
                        <div className="portal-alert-noinscrito">
                          <div className="portal-alert-noinscrito-header">
                            <ExclamationTriangleIcon className="portal-alert-noinscrito-icon" />
                            <span>Paciente no inscrito en el padrón CESFAM</span>
                          </div>
                          <p>
                            El RUT <strong className="portal-step4-phone">{rutInput}</strong> no registra ficha comunal activa en este establecimiento.
                          </p>
                          <p className="portal-alert-noinscrito-sub">
                            Para agendar en línea o acceder al alta rápida inmediata, acérquese con su Cédula de Identidad al mesón SOME.
                          </p>
                          <div className="portal-alert-noinscrito-actions">
                            <Link
                              href="/some/ventanilla"
                              className="portal-alert-noinscrito-link"
                            >
                              <span>Ir a Ventanilla SOME (Alta Rápida)</span>
                              <ChevronRightIcon className="portal-icon-sm" />
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Botón Principal de Verificación con Contraste WCAG AA */}
                      <button
                        type="submit"
                        id="btn-continuar-agendamiento"
                        disabled={cargando}
                        className="portal-btn-submit-lg"
                      >
                        {cargando ? (
                          <>
                            <ArrowPathIcon className="portal-icon-spin" />
                            <span>Validando en Padrón CESFAM...</span>
                          </>
                        ) : (
                          <>
                            <span>Continuar al Agendamiento</span>
                            <ChevronRightIcon className="portal-icon-md" />
                          </>
                        )}
                      </button>
                    </form>

                    {/* Casos Rápidos de Prueba */}
                    <div className="portal-demo-section">
                      <button
                        type="button"
                        onClick={() => setMostrarPanelPrueba(!mostrarPanelPrueba)}
                        className="portal-demo-toggle"
                      >
                        <span className="portal-demo-toggle-label">
                          <span>Pacientes de prueba rápidos (Demostración)</span>
                        </span>
                        <ChevronDownIcon
                          className={
                            mostrarPanelPrueba ? "portal-demo-chevron-open" : "portal-demo-chevron"
                          }
                        />
                      </button>

                      {mostrarPanelPrueba && (
                        <div className="portal-demo-grid">
                          <button
                            type="button"
                            id="btn-test-senior"
                            onClick={() => seleccionarRutPrueba("5555555-5")}
                            className="portal-demo-card-senior group"
                          >
                            <span className="portal-demo-card-title">
                              5.555.555-5 · Elena Valenzuela
                            </span>
                            <span className="portal-demo-card-sub-senior">
                              Adulto Mayor (75 años · Prioridad 60+)
                            </span>
                          </button>

                          <button
                            type="button"
                            id="btn-test-joven"
                            onClick={() => seleccionarRutPrueba("21111111-1")}
                            className="portal-demo-card group"
                          >
                            <span className="portal-demo-card-title">
                              21.111.111-1 · Matías Silva
                            </span>
                            <span className="portal-demo-card-sub">
                              Adulto (24 años · Cupos Generales)
                            </span>
                          </button>

                          <button
                            type="button"
                            id="btn-test-nsp"
                            onClick={() => seleccionarRutPrueba("16666666-6")}
                            className="portal-demo-card group"
                          >
                            <span className="portal-demo-card-title">
                              16.666.666-6 · Camila Rojas
                            </span>
                            <span className="portal-demo-card-sub-nsp">
                              Con inasistencias previas registradas
                            </span>
                          </button>

                          <button
                            type="button"
                            id="btn-test-noinscrito"
                            onClick={() => seleccionarRutPrueba("21222222-2")}
                            className="portal-demo-card group"
                          >
                            <span className="portal-demo-card-title">
                              21.222.222-2 · Sin inscripción
                            </span>
                            <span className="portal-demo-card-sub-muted">
                              Deriva a inscripción en mesón SOME
                            </span>
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* ========================================================== */}
                {/* PASO 2: Selección de Especialidad y Cupos en Vivo           */}
                {/* ========================================================== */}
                {pasoActual === 2 && pacienteActivo && (
                  <div className="portal-step2-container">
                    
                    {/* Barra de Fecha + Filtros de Especialidad */}
                    <div className="portal-step2-toolbar">
                      {/* Pestañas de Especialidad */}
                      <div className="portal-esp-tabs">
                        {[
                          { id: "TODAS", label: "Todas las Especialidades" },
                          { id: "MEDICINA_GENERAL", label: "Medicina General" },
                          { id: "DENTAL", label: "Urgencia Dental" },
                          { id: "MATRONERIA", label: "Matronería" },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() =>
                              setTabFiltro(
                                tab.id as "TODAS" | "MEDICINA_GENERAL" | "DENTAL" | "MATRONERIA"
                              )
                            }
                            className={
                              tabFiltro === tab.id ? "portal-esp-tab-active" : "portal-esp-tab"
                            }
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Selector rápido de Fecha */}
                      <div className="portal-date-quick-bar">
                        <span className="portal-date-quick-label">
                          Fecha:
                        </span>
                        <div className="portal-date-quick-group">
                          {opcionesFechas.slice(0, 2).map((f) => (
                            <button
                              key={f.iso}
                              type="button"
                              onClick={() => handleCambiarFecha(f.iso)}
                              className={
                                fechaSeleccionada === f.iso
                                  ? "portal-date-quick-btn-active"
                                  : "portal-date-quick-btn"
                              }
                            >
                              {f.etiqueta} ({f.diaMes})
                            </button>
                          ))}
                          <input
                            type="date"
                            value={fechaSeleccionada}
                            onChange={(e) => e.target.value && handleCambiarFecha(e.target.value)}
                            className="portal-date-quick-input"
                            aria-label="Seleccionar otra fecha"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tarjetas de Especialidad */}
                    <div className="portal-esp-grid">
                      {especialidadesFiltradas.map((esp) => {
                        const tieneCupos = esp.cuposDisponibles > 0;
                        return (
                          <div
                            key={esp.codigo}
                            id={`card-especialidad-${esp.codigo.toLowerCase()}`}
                            onClick={() => tieneCupos && seleccionarEspecialidad(esp.codigo)}
                            className={`${
                              tieneCupos ? "portal-esp-card" : "portal-esp-card-disabled"
                            } group`}
                          >
                            <div className="portal-esp-card-top">
                              <div className="portal-esp-card-meta">
                                <span className="portal-esp-code-pill">
                                  {esp.codigo.replace("_", " ")}
                                </span>
                                <span className="portal-esp-date-label">
                                  <ClockIcon className="portal-esp-date-icon" />
                                  <span>{formatearFechaLegible(fechaSeleccionada)}</span>
                                </span>
                              </div>

                              <div className="portal-esp-title-row">
                                <div className="portal-esp-icon-box">
                                  {esp.icono === "medicina" && <HeartIcon className="portal-esp-icon" />}
                                  {esp.icono === "dental" && <SparklesIcon className="portal-esp-icon" />}
                                  {esp.icono === "matroneria" && <UserIcon className="portal-esp-icon" />}
                                </div>
                                <h4 className="portal-esp-name">
                                  {esp.nombre}
                                </h4>
                              </div>

                              <p className="portal-esp-desc">
                                {esp.descripcion}
                              </p>

                              <div className="portal-esp-stats">
                                <div className="portal-esp-stat-row">
                                  <span className="portal-esp-stat-label">
                                    Cupos Disponibles:
                                  </span>
                                  <span
                                    className={
                                      tieneCupos
                                        ? "portal-esp-count-available"
                                        : "portal-esp-count-empty"
                                    }
                                  >
                                    {cargandoCupos ? "..." : esp.cuposDisponibles}
                                  </span>
                                </div>
                                {pacienteActivo.es_adulto_mayor && esp.codigo === "MEDICINA_GENERAL" && (
                                  <div className="portal-esp-senior-row">
                                    <span>★ Cuota 60+ Protegida:</span>
                                    <span>{esp.cuposProtegidos60} cupos</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="portal-esp-card-footer">
                              <button
                                type="button"
                                id={`btn-especialidad-${esp.codigo.toLowerCase()}`}
                                disabled={!tieneCupos}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  seleccionarEspecialidad(esp.codigo);
                                }}
                                className={tieneCupos ? "portal-esp-btn" : "portal-esp-btn-disabled"}
                              >
                                <span>{tieneCupos ? "Ver Horarios Disponibles" : "Sin cupos en esta fecha"}</span>
                                {tieneCupos && <ChevronRightIcon className="portal-icon-sm" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                )}

                {/* ========================================================== */}
                {/* PASO 3: Selección de Horario y Profesional                  */}
                {/* ========================================================== */}
                {pasoActual === 3 && pacienteActivo && especialidadSeleccionada && (
                  <div className="portal-step3-container">
                    
                    {/* Barra de Regreso + Especialidad Activa */}
                    <div className="portal-step3-header">
                      <button
                        type="button"
                        id="btn-volver-especialidades"
                        onClick={() => setPasoActual(2)}
                        className="portal-back-btn"
                      >
                        <ArrowLeftIcon className="portal-icon-sm" />
                        <span>Cambiar Especialidad</span>
                      </button>
                      <span className="portal-selected-esp-label">
                        Especialidad elegida:{" "}
                        <strong className="portal-selected-esp-strong">
                          {especialidadSeleccionada.replace("_", " ")}
                        </strong>
                      </span>
                    </div>

                    {/* Tira Interactiva de Selección de Fecha */}
                    <div className="portal-date-strip">
                      <div className="portal-date-strip-info">
                        <div className="portal-date-strip-icon-box">
                          <CalendarDaysIcon className="portal-icon-md" />
                        </div>
                        <div>
                          <span className="portal-date-strip-caption">
                            Fecha de Atención Seleccionada
                          </span>
                          <span className="portal-date-strip-current">
                            {formatearFechaLegible(fechaSeleccionada)}
                          </span>
                        </div>
                      </div>

                      {/* Botones de días rápidos + selector de calendario */}
                      <div className="portal-date-strip-buttons">
                        {opcionesFechas.map((f) => {
                          const activo = fechaSeleccionada === f.iso;
                          return (
                            <button
                              key={f.iso}
                              type="button"
                              onClick={() => handleCambiarFecha(f.iso)}
                              className={activo ? "portal-date-pill-active" : "portal-date-pill"}
                            >
                              <span className="portal-date-pill-label">{f.etiqueta}</span>
                              <span
                                className={
                                  activo ? "portal-date-pill-sub-active" : "portal-date-pill-sub"
                                }
                              >
                                {f.diaMes}
                              </span>
                            </button>
                          );
                        })}
                        <input
                          type="date"
                          value={fechaSeleccionada}
                          onChange={(e) => e.target.value && handleCambiarFecha(e.target.value)}
                          className="portal-date-picker-input"
                          aria-label="Elegir otra fecha"
                        />
                      </div>
                    </div>

                    {/* Filtros de Jornada (Mañana / Tarde) y Leyenda Visual */}
                    <div className="portal-jornada-bar">
                      <div>
                        <h3 className="portal-jornada-title">
                          Selecciona el Profesional y Horario
                        </h3>
                        {/* Leyenda de tipos de cupo */}
                        <div className="portal-slot-legend">
                          <span className="portal-slot-legend-item">
                            <span className="portal-swatch-general" />
                            <span>Cupo General</span>
                          </span>
                          <span className="portal-slot-legend-senior">
                            <span className="portal-swatch-senior" />
                            <span>★ Cupo Protegido 60+</span>
                          </span>
                          <span className="portal-slot-legend-item">
                            <span className="portal-bolt-icon">⚡</span>
                            <span>Liberado por cancelación oportuna</span>
                          </span>
                        </div>
                      </div>

                      <div className="portal-jornada-tabs">
                        <button
                          type="button"
                          onClick={() => setFiltroJornada("TODAS")}
                          className={
                            filtroJornada === "TODAS"
                              ? "portal-jornada-tab-active"
                              : "portal-jornada-tab"
                          }
                        >
                          Todo el Día
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroJornada("MANANA")}
                          className={
                            filtroJornada === "MANANA"
                              ? "portal-jornada-tab-active"
                              : "portal-jornada-tab"
                          }
                        >
                          Mañana (08:00 - 12:40)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroJornada("TARDE")}
                          className={
                            filtroJornada === "TARDE"
                              ? "portal-jornada-tab-active"
                              : "portal-jornada-tab"
                          }
                        >
                          Tarde (14:00 - 17:00)
                        </button>
                      </div>
                    </div>

                    {/* Error de reserva en línea (en vez de alert() nativo) */}
                    {errorReservaMsg && (
                      <div className="portal-alert-error">
                        <ExclamationTriangleIcon className="portal-alert-error-icon" />
                        <div>
                          <strong className="portal-alert-error-title">No se pudo completar la reserva</strong>
                          <span>{errorReservaMsg}</span>
                        </div>
                      </div>
                    )}

                    {/* Visualización de Horarios agrupados por Profesional */}
                    {cargandoBloques ? (
                      <div className="portal-blocks-loading">
                        <ArrowPathIcon className="portal-blocks-spinner" />
                        <span className="portal-blocks-loading-text">Sincronizando cupos disponibles en tiempo real...</span>
                      </div>
                    ) : profesionalesConBloques.length === 0 ? (
                      <div className="portal-blocks-empty">
                        <InformationCircleIcon className="portal-blocks-empty-icon" />
                        <h4 className="portal-blocks-empty-title">
                          No hay horarios disponibles para el filtro o fecha seleccionada
                        </h4>
                        <p className="portal-blocks-empty-desc">
                          Pruebe seleccionando otra jornada (Todo el Día) o consulte disponibilidad en Ventanilla SOME.
                        </p>
                      </div>
                    ) : (
                      <div className="portal-prof-list">
                        {profesionalesConBloques.map((item) => (
                          <div
                            key={`${item.profesional.id}_${item.fecha}`}
                            className="portal-prof-card"
                          >
                            {/* Ficha del Médico */}
                            <div className="portal-prof-header">
                              <div className="portal-prof-info">
                                <div className="portal-prof-avatar">
                                  Dr
                                </div>
                                <div>
                                  <h4 className="portal-prof-name">
                                    {item.profesional.nombre_completo}
                                  </h4>
                                  <div className="portal-prof-meta">
                                    <span className="portal-prof-box">{item.box.numero}</span>
                                    <span>•</span>
                                    <span className="portal-prof-slots-count">
                                      {item.bloques.length} bloques disponibles
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <span className="portal-prof-date-badge">
                                {formatearFechaLegible(item.fecha)}
                              </span>
                            </div>

                            {/* Pastillas de Hora (Área táctil mejorada min-h-[52px] para Adultos Mayores) */}
                            <div className="portal-slots-grid">
                              {item.bloques.map((bloque) => {
                                const isSelected = bloqueSeleccionado?.id === bloque.id;
                                const esSenior = bloque.es_cuota_adulto_mayor;

                                return (
                                  <button
                                    key={bloque.id}
                                    type="button"
                                    id={`slot-${bloque.id}`}
                                    onClick={() => setBloqueSeleccionado(bloque)}
                                    className={
                                      isSelected
                                        ? "portal-slot-pill-selected"
                                        : esSenior
                                        ? "portal-slot-pill-senior"
                                        : "portal-slot-pill-general"
                                    }
                                  >
                                    <span className="portal-slot-time">
                                      {bloque.hora_inicio}
                                    </span>
                                    {esSenior ? (
                                      <span
                                        className={
                                          isSelected
                                            ? "portal-slot-sub-senior-selected"
                                            : "portal-slot-sub-senior"
                                        }
                                      >
                                        ★ Cuota 60+
                                      </span>
                                    ) : (
                                      <span
                                        className={
                                          isSelected
                                            ? "portal-slot-sub-general-selected"
                                            : "portal-slot-sub-general"
                                        }
                                      >
                                        General
                                      </span>
                                    )}
                                    {bloque.es_cancelacion_reciente && (
                                      <span
                                        className="portal-slot-freed-badge"
                                        title="Cupo liberado recientemente por cancelación oportuna"
                                      >
                                        ⚡ Libre
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Barra Inferior Flotante de Confirmación */}
                    {bloqueSeleccionado && (
                      <div className="portal-confirm-sticky-bar">
                        <div className="portal-confirm-info">
                          <div className="portal-confirm-top-row">
                            <span className="portal-confirm-caption">
                              Horario Seleccionado
                            </span>
                            {bloqueSeleccionado.es_cuota_adulto_mayor && (
                              <span className="portal-confirm-senior-tag">
                                ★ Cupo Protegido 60+
                              </span>
                            )}
                          </div>
                          <strong className="portal-confirm-summary">
                            {bloqueSeleccionado.hora_inicio} a {bloqueSeleccionado.hora_fin} hrs •{" "}
                            {bloqueSeleccionado.profesional.nombre_completo}
                          </strong>
                          <span className="portal-confirm-sub">
                            {bloqueSeleccionado.box.numero} • {formatearFechaLegible(bloqueSeleccionado.fecha)}
                          </span>
                        </div>

                        <button
                          type="button"
                          id="btn-confirmar-reserva"
                          disabled={confirmandoReserva}
                          onClick={handleConfirmarReserva}
                          className="portal-confirm-btn"
                        >
                          {confirmandoReserva ? (
                            <>
                              <ArrowPathIcon className="portal-icon-spin" />
                              <span>Confirmando Cita...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircleIcon className="portal-icon-md" />
                              <span>Confirmar y Reservar Hora</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                  </div>
                )}

                {/* ========================================================== */}
                {/* PASO 4: Confirmación y Comprobante Oficial Imprimible       */}
                {/* ========================================================== */}
                {pasoActual === 4 && comprobanteGenerado && (
                  <div className="portal-step4-container">
                    
                    <div className="portal-step4-header">
                      <div className="portal-step4-check-circle">
                        <CheckCircleIcon className="portal-step4-check-icon" />
                      </div>

                      <span className="portal-step4-tag">
                        ¡Reserva Confirmada Exitosamente!
                      </span>
                      <h2 className="portal-step4-title">
                        Comprobante Oficial de Atención
                      </h2>
                      <p className="portal-step4-desc">
                        Su hora ha quedado registrada en la agenda clínica del CESFAM. Hemos enviado un respaldo SMS al número{" "}
                        <strong className="portal-step4-phone">{comprobanteGenerado.telefono}</strong>.
                      </p>
                    </div>

                    {/* Ticket / Ficha Resumen de Comprobante (Listo para impresora térmica o PDF) */}
                    <div className="print-ticket-container portal-receipt-card">
                      
                      <div className="portal-receipt-top">
                        <div>
                          <span className="portal-receipt-code-label">
                            Código Único de Reserva:
                          </span>
                          <span className="portal-receipt-code-value">
                            {comprobanteGenerado.codigo_reserva}
                          </span>
                        </div>
                        {comprobanteGenerado.es_adulto_mayor && (
                          <div className="portal-receipt-senior-wrap">
                            <span className="portal-receipt-senior-pill">
                              ★ Prioridad Adulto Mayor 60+
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="portal-receipt-grid">
                        <div>
                          <span className="portal-receipt-field-label">Paciente:</span>
                          <strong className="portal-receipt-field-value">
                            {comprobanteGenerado.paciente_nombre}
                          </strong>
                        </div>
                        <div>
                          <span className="portal-receipt-field-label">RUT:</span>
                          <strong className="portal-receipt-field-mono">
                            {comprobanteGenerado.paciente_rut}
                          </strong>
                        </div>
                        <div>
                          <span className="portal-receipt-field-label">Especialidad:</span>
                          <strong className="portal-receipt-field-esp">
                            {comprobanteGenerado.especialidad}
                          </strong>
                        </div>
                        <div>
                          <span className="portal-receipt-field-label">Fecha y Horario:</span>
                          <strong className="portal-receipt-field-value">
                            {comprobanteGenerado.fecha} • {comprobanteGenerado.hora_inicio} a {comprobanteGenerado.hora_fin} hrs
                          </strong>
                        </div>
                        <div>
                          <span className="portal-receipt-field-label">Profesional a Cargo:</span>
                          <strong className="portal-receipt-field-value">
                            {comprobanteGenerado.profesional}
                          </strong>
                        </div>
                        <div>
                          <span className="portal-receipt-field-label">Box de Atención:</span>
                          <strong className="portal-receipt-field-value">
                            {comprobanteGenerado.box}
                          </strong>
                        </div>
                      </div>

                      {/* Verificación electrónica */}
                      <div className="portal-receipt-barcode-box">
                        <div className="portal-receipt-barcode">
                          || | |||| || ||| ||||| ||| || ||||
                        </div>
                        <span className="portal-receipt-barcode-note">
                          Presentarse 15 minutos antes con Cédula de Identidad en recepción SOME
                        </span>
                      </div>

                      <div className="portal-receipt-tip">
                        💡 <strong>Compromiso Asistencial:</strong> Si no puede asistir, anule su cita con al menos{" "}
                        <strong>30 minutos de anticipación</strong> en la pestaña <em>Administrar / Anular Cita</em> para liberar el cupo a otro vecino.
                      </div>
                    </div>

                    {/* Botones de Acción (Ocultos al imprimir) */}
                    <div className="portal-step4-actions">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="portal-btn-print"
                      >
                        <PrinterIcon className="portal-icon-sm" />
                        <span>Imprimir / Guardar PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCerrarSesion}
                        className="portal-btn-new-reserva"
                      >
                        <span>Realizar Otra Reserva</span>
                      </button>
                    </div>

                  </div>
                )}

              </div>
            )}

            {/* -------------------------------------------------------------- */}
            {/* VISTA 2: ADMINISTRAR / ANULAR CITA                             */}
            {/* -------------------------------------------------------------- */}
            {modoPrincipal === "ADMINISTRAR" && (
              <div className="portal-admin-container">
                
                <div className="portal-step-heading-box">
                  <h2 className="portal-step-heading">
                    Administra o Anula tu Cita Agendada
                  </h2>
                  <p className="portal-step-subheading">
                    Consulta tus horas médicas activas y anula oportunamente (mínimo 30 min antes) para liberar el cupo a la comunidad sin registrar inasistencia.
                  </p>
                </div>

                {/* Formulario de Consulta de Citas */}
                <form onSubmit={handleBuscarCitasAdmin} className="portal-rut-form">
                  <div>
                    <label
                      htmlFor="rutAdminInput"
                      className="portal-rut-label"
                    >
                      RUT del Paciente
                    </label>
                    <div className="portal-rut-input-wrap">
                      <div className="portal-rut-icon-wrap">
                        <IdentificationIcon className="portal-rut-icon" />
                      </div>
                      <input
                        id="rutAdminInput"
                        type="text"
                        value={rutAdminInput}
                        onChange={(e) => {
                          const limpio = limpiarRut(e.target.value);
                          if (limpio.length <= 9) setRutAdminInput(formatearRut(limpio));
                        }}
                        placeholder="Ej: 5.555.555-5 o 21.111.111-1"
                        className="portal-rut-input"
                      />
                    </div>
                  </div>

                  {/* Accesos rápidos para probar consulta de citas */}
                  <div className="portal-admin-quick-row">
                    <span className="portal-admin-quick-label">Prueba rápida:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const r = formatearRut("5555555-5");
                        setRutAdminInput(r);
                        buscarCitasPorRut(r);
                      }}
                      className="portal-admin-quick-btn"
                    >
                      5.555.555-5 (Adulto Mayor)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const r = formatearRut("21111111-1");
                        setRutAdminInput(r);
                        buscarCitasPorRut(r);
                      }}
                      className="portal-admin-quick-btn"
                    >
                      21.111.111-1 (Joven)
                    </button>
                  </div>

                  <button
                    type="submit"
                    id="btn-buscar-citas-admin"
                    disabled={cargandoAdmin}
                    className="portal-admin-submit-btn"
                  >
                    {cargandoAdmin ? (
                      <>
                        <ArrowPathIcon className="portal-icon-spin" />
                        <span>Buscando Citas Registradas...</span>
                      </>
                    ) : (
                      <>
                        <MagnifyingGlassIcon className="portal-icon-md" />
                        <span>Consultar Mis Citas</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Mensaje de Éxito al Anular */}
                {mensajeExitoAdmin && (
                  <div className="portal-admin-success-msg">
                    {mensajeExitoAdmin}
                  </div>
                )}

                {/* Mensaje de Error al Anular */}
                {errorAdminMsg && (
                  <div className="portal-admin-error-msg">
                    {errorAdminMsg}
                  </div>
                )}

                {/* Resultados de la Búsqueda */}
                {adminBuscado && !cargandoAdmin && (
                  <div className="portal-admin-results">
                    {citasDelPaciente.length === 0 ? (
                      <div className="portal-admin-empty">
                        <InformationCircleIcon className="portal-blocks-empty-icon" />
                        <h4 className="portal-blocks-empty-title">
                          No se registran citas para este RUT
                        </h4>
                        <p className="portal-step-subheading">
                          {pacienteAdmin
                            ? `El paciente ${pacienteAdmin.nombres} ${pacienteAdmin.apellidos} no tiene atenciones registradas.`
                            : "El RUT ingresado no posee citas en el sistema."}
                        </p>
                        <div className="portal-admin-empty-cta-wrap">
                          <button
                            type="button"
                            onClick={() => setModoPrincipal("RESERVAR")}
                            className="portal-admin-empty-cta-btn"
                          >
                            <span>Reservar una Hora Ahora</span>
                            <ChevronRightIcon className="portal-icon-sm" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="portal-admin-list">
                        <div className="portal-admin-list-header">
                          <h4 className="portal-admin-list-title">
                            Historial de Citas de {pacienteAdmin?.nombres} {pacienteAdmin?.apellidos}
                          </h4>
                          <span className="portal-admin-list-count">
                            {citasDelPaciente.length} registro(s)
                          </span>
                        </div>

                        {citasDelPaciente.map((cita) => {
                          const estaAgendada = cita.estado_cita === "AGENDADA";
                          const horaIni = formatearHoraIso(cita.bloque?.hora_inicio);
                          const horaFin = formatearHoraIso(cita.bloque?.hora_fin);
                          const fechaCita = cita.bloque?.hora_inicio
                            ? formatearFechaLegible(cita.bloque.hora_inicio)
                            : formatearFechaLegible(cita.created_at);
                          const boxNumero = cita.bloque?.agenda?.box?.numero;

                          return (
                            <div
                              key={cita.id}
                              className="portal-cita-card"
                            >
                              <div className="portal-cita-body">
                                <div className="portal-cita-badges">
                                  <span className="portal-cita-esp">
                                    {cita.especialidad.replace("_", " ")}
                                  </span>
                                  <span
                                    className={
                                      estaAgendada
                                        ? "portal-cita-status-active"
                                        : "portal-cita-status-inactive"
                                    }
                                  >
                                    {cita.estado_cita.replace("_", " ")}
                                  </span>
                                  {cita.bloque?.es_cuota_adulto_mayor && (
                                    <span className="portal-cita-senior-badge">
                                      ★ Cuota 60+
                                    </span>
                                  )}
                                </div>

                                <div className="portal-cita-meta-grid">
                                  <p>
                                    Código Reserva:{" "}
                                    <strong className="portal-cita-code">
                                      {cita.codigo_reserva}
                                    </strong>
                                  </p>
                                  <p>
                                    Horario:{" "}
                                    <strong className="portal-patient-meta-mono">
                                      {horaIni} a {horaFin} hrs
                                    </strong>
                                  </p>
                                  <p>
                                    Profesional:{" "}
                                    <strong className="portal-patient-meta-strong">
                                      Dr(a). {cita.profesional.nombres} {cita.profesional.apellidos}
                                    </strong>
                                  </p>
                                  <p className="portal-cita-capitalize">
                                    Fecha: <strong className="portal-patient-meta-strong">{fechaCita}</strong>
                                    {boxNumero ? ` • ${boxNumero}` : ""}
                                  </p>
                                </div>
                              </div>

                              {estaAgendada && (
                                <button
                                  type="button"
                                  id={`btn-anular-${cita.id}`}
                                  disabled={anulandoCitaId === cita.id}
                                  onClick={() => setCitaPorAnular(cita)}
                                  className="portal-cita-cancel-btn"
                                >
                                  {anulandoCitaId === cita.id ? (
                                    <>
                                      <ArrowPathIcon className="portal-icon-spin-sm" />
                                      <span>Liberando Cupo...</span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircleIcon className="portal-icon-sm" />
                                      <span>Anular Cita Oportunamente</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

          </div>

        </div>

      </section>

      {/* ==================================================================== */}
      {/* 3. SECCIONES INFORMATIVAS CON ANCLAS CONECTADAS (Oculto al imprimir) */}
      {/* ==================================================================== */}
      <section className="portal-info-sections">
        
        {/* ¿Cómo Funciona tu Reserva en 3 Pasos? */}
        <div id="como-funciona" className="portal-how-section">
          <h3 className="portal-section-title">
            ¿Cómo Funciona el Agendamiento en MallaSalud?
          </h3>
          <p className="portal-step-subheading">
            Diseñado especialmente para brindar rapidez, claridad visual y prioridad al adulto mayor.
          </p>

          <div className="portal-how-grid">
            <div className="portal-how-card">
              <div className="portal-how-num">
                PASO 01
              </div>
              <h4 className="portal-how-card-title">
                Ingresa tu RUT
              </h4>
              <p className="portal-how-card-desc">
                El sistema valida tu inscripción comunal en el CESFAM y detecta automáticamente si eres beneficiario de la cuota protegida 60+.
              </p>
            </div>

            <div className="portal-how-card">
              <div className="portal-how-num">
                PASO 02
              </div>
              <h4 className="portal-how-card-title">
                Elige Especialidad y Hora
              </h4>
              <p className="portal-how-card-desc">
                Revisa los cupos disponibles en tiempo real sincronizados con mesón SOME y selecciona el profesional y horario que prefieras.
              </p>
            </div>

            <div className="portal-how-card">
              <div className="portal-how-num">
                PASO 03
              </div>
              <h4 className="portal-how-card-title">
                Recibe tu Comprobante y SMS
              </h4>
              <p className="portal-how-card-desc">
                Obtén tu código de reserva al instante. Si no puedes acudir, anula desde la web para liberar el cupo a otro vecino.
              </p>
            </div>
          </div>
        </div>

        {/* Preguntas Frecuentes (FAQ) */}
        <div id="faq" className="portal-faq-section">
          <div className="portal-faq-header">
            <h3 className="portal-section-title">
              Preguntas Frecuentes
            </h3>
            <p className="portal-step-subheading">
              Respuestas sobre agendamiento, cuota protegida 60+ y cancelación oportuna.
            </p>
          </div>

          <div className="portal-faq-list">
            {[
              {
                q: "¿Cómo funciona la cuota protegida del 30% para adultos mayores (60+)?",
                a: "En Medicina General, el 30% de los cupos diarios se reservan de forma intercalada para personas de 60 años o más. Si un cupo protegido no es tomado hasta 30 minutos antes de la hora de inicio, se libera automáticamente para todo público.",
              },
              {
                q: "¿Qué ocurre si no puedo asistir a la cita médica agendada?",
                a: "Debe ingresar a la pestaña 'Administrar / Anular Cita' con al menos 30 minutos de antelación. Así el cupo se libera de inmediato para otro vecino y no se registrará inasistencia en su ficha.",
              },
              {
                q: "¿Puedo reservar una hora médica para un familiar o adulto mayor?",
                a: "Sí. En el Paso 1 seleccione la opción 'Familiar / Adulto Mayor' e ingrese el RUT del paciente que recibirá la atención médica.",
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="portal-faq-item"
              >
                <button
                  type="button"
                  onClick={() => setFaqAbierta(faqAbierta === idx ? null : idx)}
                  className="portal-faq-btn"
                >
                  <span>{faq.q}</span>
                  <ChevronDownIcon
                    className={
                      faqAbierta === idx ? "portal-faq-chevron-open" : "portal-faq-chevron"
                    }
                  />
                </button>
                {faqAbierta === idx && (
                  <div className="portal-faq-answer">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* ==================================================================== */}
      {/* 4. MODAL EDUCATIVO DE INASISTENCIAS                                  */}
      {/* ==================================================================== */}
      {mostrarModalNsp && pacienteActivo && (
        <div className="portal-modal-backdrop">
          <div className="portal-modal-box-nsp">
            
            <div className="portal-modal-header">
              <div className="portal-modal-icon-amber">
                <ExclamationTriangleIcon className="portal-esp-icon" />
              </div>
              <div>
                <span className="portal-modal-tag-amber">
                  Compromiso Asistencial CESFAM
                </span>
                <h3 className="portal-modal-title">
                  Registro de Inasistencias Previas
                </h3>
              </div>
            </div>

            <p className="portal-modal-text">
              Estimado/a <strong className="portal-patient-meta-strong">{pacienteActivo.nombre_completo}</strong>, nuestro sistema registra que usted cuenta con{" "}
              <strong className="portal-modal-amber-strong">
                {pacienteActivo.contador_inasistencias} inasistencia(s) previa(s)
              </strong>{" "}
              no justificadas en citas anteriores.
            </p>

            <div className="portal-modal-info-card">
              <p className="portal-modal-info-title">Cuidemos la salud de nuestra comunidad:</p>
              <p className="portal-modal-info-desc">
                Si no puede asistir a su próxima cita, recuerde anularla con al menos{" "}
                <strong>30 minutos de anticipación</strong> desde esta plataforma o llamando al 800 500 123.
              </p>
            </div>

            <p className="portal-modal-footnote">
              * Este aviso es informativo y no bloquea su derecho a reservar atención médica.
            </p>

            <div className="portal-modal-footer">
              <button
                type="button"
                id="btn-cerrar-modal-nsp"
                onClick={() => setMostrarModalNsp(false)}
                className="portal-modal-btn-primary"
              >
                Entendido, Continuar al Agendamiento →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. MODAL DE CONFIRMACIÓN DE ANULACIÓN OPORTUNA                       */}
      {/* ==================================================================== */}
      {citaPorAnular && (
        <div className="portal-modal-backdrop">
          <div className="portal-modal-box-cancel">
            <div className="portal-modal-header">
              <div className="portal-modal-icon-red">
                <XCircleIcon className="portal-esp-icon" />
              </div>
              <div>
                <span className="portal-modal-tag-red">
                  Cancelación Oportuna
                </span>
                <h3 className="portal-modal-title">
                  ¿Confirmar anulación de cita?
                </h3>
              </div>
            </div>

            <p className="portal-modal-text">
              Está a punto de anular la cita <strong className="portal-patient-meta-mono">{citaPorAnular.codigo_reserva}</strong> de{" "}
              <strong>{citaPorAnular.especialidad.replace("_", " ")}</strong>.
            </p>

            <div className="portal-modal-checklist">
              <p>✓ El cupo será liberado de inmediato para otro vecino del CESFAM.</p>
              <p>✓ No se registrará penalización ni inasistencia (NSP) en su ficha.</p>
            </div>

            <div className="portal-modal-actions-row">
              <button
                type="button"
                onClick={ejecutarAnulacionCita}
                disabled={anulandoCitaId === citaPorAnular.id}
                className="portal-modal-btn-danger"
              >
                {anulandoCitaId === citaPorAnular.id ? "Anulando..." : "Sí, Anular y Liberar Cupo"}
              </button>
              <button
                type="button"
                onClick={() => setCitaPorAnular(null)}
                className="portal-modal-btn-secondary"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
