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
    <div className="w-full font-sans transition-colors duration-200">
      
      {/* ==================================================================== */}
      {/* 1. HERO INSTITUCIONAL ESTILO REDSALUD (Oculto al imprimir)           */}
      {/* ==================================================================== */}
      <section className="print:hidden bg-gradient-to-b from-[#D9F5EF]/70 via-[#F4FAF8] to-[#F4FAF8] dark:from-[#132723]/80 dark:via-[#0B1715] dark:to-[#0B1715] border-b border-[#CDECE5] dark:border-[#1E3F3B] pt-8 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#132A26] dark:text-[#E8F5F2] tracking-tight">
            Reserva tu Hora <span className="text-[#0F766E] dark:text-[#5BB9A6]">Médica y Dental</span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-[#355C56] dark:text-[#9CC2BC] leading-relaxed">
            Plataforma en línea de atención primaria. Obtén tu cita sin filas de madrugada, con resguardo automático del{" "}
            <strong className="text-[#132A26] dark:text-white font-bold">30% de cupos protegidos para personas mayores de 60 años</strong>.
          </p>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 2. CARD PRINCIPAL DE AGENDAMIENTO                                    */}
      {/* ==================================================================== */}
      <section id="especialidades" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 pb-16 print:mt-0 print:pb-0 print:px-0">
        
        <div className="bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#21403A] rounded-3xl shadow-xl overflow-hidden transition-all print:border-none print:shadow-none print:rounded-none">
          
          {/* Header Switcher: "Reservar Cita" vs "Administrar / Anular mi Cita" */}
          <div className="print:hidden grid grid-cols-2 border-b border-[#CDECE5] dark:border-[#21403A] bg-[#F4FAF8] dark:bg-[#0B1715]">
            <button
              type="button"
              id="tab-reservar-hora"
              onClick={() => setModoPrincipal("RESERVAR")}
              className={`py-4 px-4 sm:px-8 flex items-center justify-center gap-2.5 text-xs sm:text-base font-extrabold transition-all border-b-3 cursor-pointer ${
                modoPrincipal === "RESERVAR"
                  ? "bg-white dark:bg-[#122420] border-[#0F766E] dark:border-[#5BB9A6] text-[#0F766E] dark:text-[#A7E3D4] shadow-2xs"
                  : "border-transparent text-[#355C56] dark:text-[#9CC2BC] hover:text-[#132A26] dark:hover:text-white"
              }`}
            >
              <CalendarDaysIcon className={`w-5 h-5 ${modoPrincipal === "RESERVAR" ? "text-[#0F766E] dark:text-[#5BB9A6]" : "text-gray-400"}`} />
              <span>Reservar Hora Médica</span>
            </button>

            <button
              type="button"
              id="tab-administrar-cita"
              onClick={() => setModoPrincipal("ADMINISTRAR")}
              className={`py-4 px-4 sm:px-8 flex items-center justify-center gap-2.5 text-xs sm:text-base font-extrabold transition-all border-b-3 cursor-pointer ${
                modoPrincipal === "ADMINISTRAR"
                  ? "bg-white dark:bg-[#122420] border-[#0F766E] dark:border-[#5BB9A6] text-[#0F766E] dark:text-[#A7E3D4] shadow-2xs"
                  : "border-transparent text-[#355C56] dark:text-[#9CC2BC] hover:text-[#132A26] dark:hover:text-white"
              }`}
            >
              <MagnifyingGlassIcon className={`w-5 h-5 ${modoPrincipal === "ADMINISTRAR" ? "text-[#0F766E] dark:text-[#5BB9A6]" : "text-gray-400"}`} />
              <span>Administrar / Anular Cita</span>
            </button>
          </div>

          <div className="p-6 sm:p-8 lg:p-10 print:p-0">

            {/* -------------------------------------------------------------- */}
            {/* VISTA 1: FLUJO DE RESERVA DE CITAS                             */}
            {/* -------------------------------------------------------------- */}
            {modoPrincipal === "RESERVAR" && (
              <div>
                
                {/* Stepper Interactivo de 4 Pasos (Oculto al imprimir) */}
                <div className="print:hidden mb-8 border-b border-[#CDECE5] dark:border-[#21403A] pb-6">
                  <div className="flex items-center justify-between max-w-2xl mx-auto">
                    {stepsInfo.map((step, index) => {
                      const completado = pasoActual > step.num;
                      const activo = pasoActual === step.num;
                      const puedeRetroceder = completado && pasoActual < 4;

                      return (
                        <div key={step.num} className="flex items-center flex-1 last:flex-none">
                          <button
                            type="button"
                            disabled={!puedeRetroceder}
                            onClick={() => {
                              if (puedeRetroceder) {
                                setPasoActual(step.num);
                              }
                            }}
                            className={`flex flex-col items-center text-center group focus:outline-none ${
                              puedeRetroceder ? "cursor-pointer" : "cursor-default"
                            }`}
                            title={puedeRetroceder ? `Volver al paso ${step.num}: ${step.label}` : step.label}
                          >
                            <div
                              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-extrabold text-xs sm:text-sm transition-all ${
                                completado
                                  ? "bg-[#0F766E] text-white group-hover:bg-[#115E59] shadow-xs"
                                  : activo
                                  ? "bg-[#0F766E] text-white ring-4 ring-[#D9F5EF] dark:ring-[#1E3F3B] shadow-sm"
                                  : "bg-slate-100 dark:bg-[#17302B] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-[#264E46]"
                              }`}
                            >
                              {completado ? <CheckIcon className="w-5 h-5 stroke-[2.5]" /> : step.num}
                            </div>
                            <span
                              className={`text-[11px] sm:text-xs mt-1.5 transition-colors ${
                                activo
                                  ? "font-extrabold text-[#0F766E] dark:text-[#5BB9A6]"
                                  : completado
                                  ? "font-bold text-[#132A26] dark:text-[#D9F5EF] group-hover:underline"
                                  : "font-medium text-slate-400 dark:text-slate-500"
                              }`}
                            >
                              {step.label}
                            </span>
                          </button>

                          {index < stepsInfo.length - 1 && (
                            <div
                              className={`flex-1 h-1 mx-2 sm:mx-3 rounded-full transition-colors ${
                                pasoActual > step.num
                                  ? "bg-[#0F766E] dark:bg-[#5BB9A6]"
                                  : "bg-slate-200 dark:bg-[#17302B]"
                              }`}
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
                  <div className="mb-6 space-y-3 animate-fadeIn">
                    <div className="bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#264E46] p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-[#D9F5EF] dark:bg-[#1E3F3B] flex items-center justify-center flex-shrink-0 text-[#0F766E] dark:text-[#A7E3D4] font-bold">
                          <UserIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-extrabold text-[#132A26] dark:text-[#E8F5F2]">
                              {pacienteActivo.nombre_completo}
                            </h3>
                            {pacienteActivo.es_adulto_mayor ? (
                              <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-400 dark:border-amber-600 text-xs font-extrabold px-2.5 py-0.5 rounded-full shadow-2xs">
                                ★ Prioridad Adulto Mayor (60+)
                              </span>
                            ) : (
                              <span className="bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#A7E3D4] text-xs font-bold px-2.5 py-0.5 rounded-full">
                                Paciente Fonasa Inscrito
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] mt-1 font-medium">
                            <span>
                              RUT: <strong className="font-mono text-[#132A26] dark:text-white">{pacienteActivo.rut_formateado}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Edad: <strong className="text-[#132A26] dark:text-white">{pacienteActivo.edad} años</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Contacto: <strong className="font-mono text-[#132A26] dark:text-white">{pacienteActivo.telefono}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleCerrarSesion}
                        className="text-xs sm:text-sm font-bold text-[#355C56] dark:text-[#9CC2BC] hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#264E46] px-3.5 py-2 rounded-xl transition-colors self-start md:self-auto cursor-pointer"
                      >
                        Cambiar Paciente / RUT
                      </button>
                    </div>

                    {/* Aviso destacado si el paciente tiene prioridad 60+ */}
                    {pacienteActivo.es_adulto_mayor && (
                      <div className="flex items-center gap-3 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/70 p-3.5 rounded-2xl text-xs sm:text-sm text-amber-950 dark:text-amber-200">
                        <ShieldCheckIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <p>
                          <strong>Beneficio Adulto Mayor Activo:</strong> Se han desbloqueado los bloques horarios marcados con{" "}
                          <span className="inline-block bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-extrabold px-1.5 py-0.2 rounded text-xs">
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
                  <div className="max-w-xl mx-auto space-y-6 animate-fadeIn">
                    
                    {/* Selector: "¿Para quién es la hora?" */}
                    <div className="bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#264E46] p-4 rounded-2xl">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#1E4640] dark:text-[#A7E3D4] mb-2.5">
                        ¿Para quién es la atención médica?
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setTipoPaciente("PROPIO")}
                          className={`p-3.5 rounded-xl border-2 text-xs sm:text-sm font-bold text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                            tipoPaciente === "PROPIO"
                              ? "bg-white dark:bg-[#122420] border-[#0F766E] dark:border-[#5BB9A6] text-[#132A26] dark:text-white shadow-2xs"
                              : "border-slate-200 dark:border-[#1E3F3B] text-[#355C56] dark:text-[#9CC2BC] hover:border-[#5BB9A6]"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${tipoPaciente === "PROPIO" ? "border-[#0F766E] dark:border-[#5BB9A6]" : "border-gray-400"}`}>
                            {tipoPaciente === "PROPIO" && <div className="w-2 h-2 rounded-full bg-[#0F766E] dark:bg-[#5BB9A6]" />}
                          </div>
                          <span>Para mí</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTipoPaciente("TERCERO")}
                          className={`p-3.5 rounded-xl border-2 text-xs sm:text-sm font-bold text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                            tipoPaciente === "TERCERO"
                              ? "bg-white dark:bg-[#122420] border-[#0F766E] dark:border-[#5BB9A6] text-[#132A26] dark:text-white shadow-2xs"
                              : "border-slate-200 dark:border-[#1E3F3B] text-[#355C56] dark:text-[#9CC2BC] hover:border-[#5BB9A6]"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${tipoPaciente === "TERCERO" ? "border-[#0F766E] dark:border-[#5BB9A6]" : "border-gray-400"}`}>
                            {tipoPaciente === "TERCERO" && <div className="w-2 h-2 rounded-full bg-[#0F766E] dark:bg-[#5BB9A6]" />}
                          </div>
                          <span>Familiar / Adulto Mayor</span>
                        </button>
                      </div>
                    </div>

                    <div className="text-center space-y-1.5">
                      <h2 className="text-xl sm:text-2xl font-black text-[#132A26] dark:text-[#E8F5F2]">
                        {tipoPaciente === "PROPIO" ? "Ingresa tu RUT para comenzar" : "Ingresa el RUT del Paciente"}
                      </h2>
                      <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC]">
                        Validamos automáticamente tu inscripción en el CESFAM y habilitamos los cupos preferentes 60+ según tu edad.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label
                          htmlFor="rutInput"
                          className="block text-xs sm:text-sm font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1.5"
                        >
                          RUT del Paciente (se formatea automáticamente)
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <IdentificationIcon className="w-6 h-6 text-[#0F766E] dark:text-[#5BB9A6]" />
                          </div>
                          <input
                            id="rutInput"
                            type="text"
                            inputMode="numeric"
                            value={rutInput}
                            onChange={handleRutChange}
                            placeholder="Ej: 5.555.555-5 o 21.111.111-1"
                            className="w-full pl-12 pr-4 py-4 bg-[#F4FAF8] dark:bg-[#0B1715] border-2 border-[#CDECE5] dark:border-[#264E46] text-[#132A26] dark:text-white rounded-2xl text-base sm:text-lg font-mono font-bold tracking-wider placeholder-slate-400 focus:outline-none focus:border-[#0F766E] dark:focus:border-[#5BB9A6] focus:ring-4 focus:ring-[#A7E3D4]/40 transition-all"
                            autoFocus
                          />
                        </div>
                      </div>

                      {/* Mensaje de RUT Inválido (400) */}
                      {errorMsg && (
                        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 p-4 rounded-2xl text-xs sm:text-sm text-red-800 dark:text-red-200 animate-fadeIn">
                          <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                          <div>
                            <strong className="block font-bold">RUT No Válido</strong>
                            <span>{errorMsg}</span>
                          </div>
                        </div>
                      )}

                      {/* Mensaje de Paciente No Inscrito (404) */}
                      {noInscrito && (
                        <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 p-4 sm:p-5 rounded-2xl space-y-2.5 text-xs sm:text-sm text-amber-900 dark:text-amber-200 animate-fadeIn">
                          <div className="flex items-center gap-2 font-extrabold text-sm sm:text-base">
                            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                            <span>Paciente no inscrito en el padrón CESFAM</span>
                          </div>
                          <p>
                            El RUT <strong className="font-mono">{rutInput}</strong> no registra ficha comunal activa en este establecimiento.
                          </p>
                          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                            Para agendar en línea o acceder al alta rápida inmediata, acérquese con su Cédula de Identidad al mesón SOME.
                          </p>
                          <div className="pt-1">
                            <Link
                              href="/some/ventanilla"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F766E] dark:text-[#A7E3D4] bg-white dark:bg-[#122420] border border-amber-400 dark:border-amber-700 px-3.5 py-2 rounded-xl hover:bg-amber-100 transition-colors"
                            >
                              <span>Ir a Ventanilla SOME (Alta Rápida)</span>
                              <ChevronRightIcon className="w-4 h-4" />
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Botón Principal de Verificación con Contraste WCAG AA */}
                      <button
                        type="submit"
                        id="btn-continuar-agendamiento"
                        disabled={cargando}
                        className="w-full flex items-center justify-center gap-2 bg-[#0F766E] hover:bg-[#115E59] active:bg-[#134E4A] text-white py-4 rounded-2xl font-bold text-base shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {cargando ? (
                          <>
                            <ArrowPathIcon className="w-5 h-5 animate-spin" />
                            <span>Validando en Padrón CESFAM...</span>
                          </>
                        ) : (
                          <>
                            <span>Continuar al Agendamiento</span>
                            <ChevronRightIcon className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </form>

                    {/* Casos Rápidos de Prueba para Evaluación Capstone */}
                    <div className="pt-4 border-t border-[#CDECE5] dark:border-[#21403A]">
                      <button
                        type="button"
                        onClick={() => setMostrarPanelPrueba(!mostrarPanelPrueba)}
                        className="w-full flex items-center justify-between text-xs font-bold text-[#355C56] dark:text-[#9CC2BC] hover:text-[#0F766E] transition-colors py-1.5 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <span>🧪</span>
                          <span>Cuentas Rápidas de Demostración (Capstone APT122)</span>
                        </span>
                        <ChevronDownIcon
                          className={`w-4 h-4 transition-transform ${
                            mostrarPanelPrueba ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {mostrarPanelPrueba && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-fadeIn">
                          <button
                            type="button"
                            id="btn-test-senior"
                            onClick={() => seleccionarRutPrueba("5555555-5")}
                            className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/70 text-left hover:border-amber-500 transition-all group cursor-pointer"
                          >
                            <span className="text-xs font-mono font-bold text-[#132A26] dark:text-[#E8F5F2] block">
                              5.555.555-5 • Elena Valenzuela
                            </span>
                            <span className="text-[11px] text-amber-800 dark:text-amber-300 font-bold block mt-0.5">
                              ★ Adulto Mayor (75 años • Desbloquea 30% 60+)
                            </span>
                          </button>

                          <button
                            type="button"
                            id="btn-test-joven"
                            onClick={() => seleccionarRutPrueba("21111111-1")}
                            className="p-3 rounded-xl bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#264E46] text-left hover:border-[#0F766E] transition-all group cursor-pointer"
                          >
                            <span className="text-xs font-mono font-bold text-[#132A26] dark:text-[#E8F5F2] block">
                              21.111.111-1 • Matías Silva
                            </span>
                            <span className="text-[11px] text-[#355C56] dark:text-[#9CC2BC] block mt-0.5">
                              Joven Adulto (24 años • Cupos Generales)
                            </span>
                          </button>

                          <button
                            type="button"
                            id="btn-test-nsp"
                            onClick={() => seleccionarRutPrueba("16666666-6")}
                            className="p-3 rounded-xl bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#264E46] text-left hover:border-[#0F766E] transition-all group cursor-pointer"
                          >
                            <span className="text-xs font-mono font-bold text-[#132A26] dark:text-[#E8F5F2] block">
                              16.666.666-6 • Camila Rojas
                            </span>
                            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold block mt-0.5">
                              Inasistencias Previas (Alerta NSP HU-001)
                            </span>
                          </button>

                          <button
                            type="button"
                            id="btn-test-noinscrito"
                            onClick={() => seleccionarRutPrueba("21222222-2")}
                            className="p-3 rounded-xl bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#264E46] text-left hover:border-[#0F766E] transition-all group cursor-pointer"
                          >
                            <span className="text-xs font-mono font-bold text-[#132A26] dark:text-[#E8F5F2] block">
                              21.222.222-2 • Sin Inscripción
                            </span>
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              Deriva a Alta Rápida en Ventanilla SOME (404)
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
                  <div className="space-y-6 animate-fadeIn">
                    
                    {/* Barra de Fecha + Filtros de Especialidad */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#CDECE5] dark:border-[#21403A] pb-4">
                      {/* Pestañas de Especialidad */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
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
                            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                              tabFiltro === tab.id
                                ? "bg-[#0F766E] text-white shadow-2xs"
                                : "bg-[#F4FAF8] dark:bg-[#0B1715] text-[#355C56] dark:text-[#9CC2BC] border border-[#CDECE5] dark:border-[#264E46] hover:bg-[#D9F5EF]/60"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Selector rápido de Fecha */}
                      <div className="flex items-center gap-2 self-start lg:self-auto">
                        <span className="text-xs font-bold text-[#355C56] dark:text-[#9CC2BC]">
                          Fecha:
                        </span>
                        <div className="flex items-center gap-1 bg-[#F4FAF8] dark:bg-[#0B1715] p-1 rounded-xl border border-[#CDECE5] dark:border-[#264E46]">
                          {opcionesFechas.slice(0, 2).map((f) => (
                            <button
                              key={f.iso}
                              type="button"
                              onClick={() => handleCambiarFecha(f.iso)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                fechaSeleccionada === f.iso
                                  ? "bg-[#0F766E] text-white"
                                  : "text-[#355C56] dark:text-[#9CC2BC] hover:text-[#132A26] dark:hover:text-white"
                              }`}
                            >
                              {f.etiqueta} ({f.diaMes})
                            </button>
                          ))}
                          <input
                            type="date"
                            value={fechaSeleccionada}
                            onChange={(e) => e.target.value && handleCambiarFecha(e.target.value)}
                            className="px-2 py-0.5 text-xs font-mono font-bold bg-transparent text-[#132A26] dark:text-[#E8F5F2] focus:outline-none cursor-pointer"
                            aria-label="Seleccionar otra fecha"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Tarjetas de Especialidad */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {especialidadesFiltradas.map((esp) => {
                        const tieneCupos = esp.cuposDisponibles > 0;
                        return (
                          <div
                            key={esp.codigo}
                            id={`card-especialidad-${esp.codigo.toLowerCase()}`}
                            onClick={() => tieneCupos && seleccionarEspecialidad(esp.codigo)}
                            className={`bg-white dark:bg-[#0B1715] border-2 rounded-2xl p-5 sm:p-6 flex flex-col justify-between transition-all group ${
                              tieneCupos
                                ? "border-[#CDECE5] dark:border-[#264E46] hover:border-[#0F766E] dark:hover:border-[#5BB9A6] hover:shadow-lg cursor-pointer"
                                : "border-slate-200 dark:border-slate-800 opacity-75 cursor-not-allowed"
                            }`}
                          >
                            <div className="space-y-3.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0F766E] dark:text-[#A7E3D4] bg-[#D9F5EF] dark:bg-[#1E3F3B] px-2.5 py-0.5 rounded-full">
                                  {esp.codigo.replace("_", " ")}
                                </span>
                                <span className="flex items-center gap-1 text-xs font-bold text-[#355C56] dark:text-[#9CC2BC]">
                                  <ClockIcon className="w-4 h-4 text-[#0F766E] dark:text-[#5BB9A6]" />
                                  <span>{formatearFechaLegible(fechaSeleccionada)}</span>
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#5BB9A6] flex items-center justify-center flex-shrink-0">
                                  {esp.icono === "medicina" && <HeartIcon className="w-6 h-6" />}
                                  {esp.icono === "dental" && <SparklesIcon className="w-6 h-6" />}
                                  {esp.icono === "matroneria" && <UserIcon className="w-6 h-6" />}
                                </div>
                                <h4 className="text-lg font-extrabold text-[#132A26] dark:text-[#E8F5F2] group-hover:text-[#0F766E] dark:group-hover:text-[#5BB9A6] transition-colors">
                                  {esp.nombre}
                                </h4>
                              </div>

                              <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] leading-relaxed">
                                {esp.descripcion}
                              </p>

                              <div className="pt-3 border-t border-[#CDECE5] dark:border-[#21403A] space-y-2 text-xs sm:text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-[#355C56] dark:text-[#9CC2BC] font-medium">
                                    Cupos Disponibles:
                                  </span>
                                  <span
                                    className={`font-black text-base px-2.5 py-0.5 rounded-lg ${
                                      tieneCupos
                                        ? "bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#A7E3D4]"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                    }`}
                                  >
                                    {cargandoCupos ? "..." : esp.cuposDisponibles}
                                  </span>
                                </div>
                                {pacienteActivo.es_adulto_mayor && esp.codigo === "MEDICINA_GENERAL" && (
                                  <div className="flex items-center justify-between text-xs bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 px-2.5 py-1.5 rounded-xl font-bold">
                                    <span>★ Cuota 60+ Protegida:</span>
                                    <span>{esp.cuposProtegidos60} cupos</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="pt-5">
                              <button
                                type="button"
                                id={`btn-especialidad-${esp.codigo.toLowerCase()}`}
                                disabled={!tieneCupos}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  seleccionarEspecialidad(esp.codigo);
                                }}
                                className={`w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                  tieneCupos
                                    ? "bg-[#0F766E] hover:bg-[#115E59] text-white shadow-sm group-hover:shadow-md"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                                }`}
                              >
                                <span>{tieneCupos ? "Ver Horarios Disponibles" : "Sin cupos en esta fecha"}</span>
                                {tieneCupos && <ChevronRightIcon className="w-4 h-4" />}
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
                  <div className="space-y-6 animate-fadeIn">
                    
                    {/* Barra de Regreso + Especialidad Activa */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#CDECE5] dark:border-[#21403A] pb-3">
                      <button
                        type="button"
                        id="btn-volver-especialidades"
                        onClick={() => setPasoActual(2)}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#0F766E] dark:text-[#A7E3D4] hover:underline cursor-pointer"
                      >
                        <ArrowLeftIcon className="w-4 h-4" />
                        <span>Cambiar Especialidad</span>
                      </button>
                      <span className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] font-medium">
                        Especialidad elegida:{" "}
                        <strong className="text-[#132A26] dark:text-white uppercase font-extrabold">
                          {especialidadSeleccionada.replace("_", " ")}
                        </strong>
                      </span>
                    </div>

                    {/* Tira Interactiva de Selección de Fecha */}
                    <div className="bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#264E46] p-4 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#D9F5EF] dark:bg-[#1E3F3B] flex items-center justify-center text-[#0F766E] dark:text-[#5BB9A6] flex-shrink-0">
                          <CalendarDaysIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-[#355C56] dark:text-[#9CC2BC] uppercase tracking-wider block">
                            Fecha de Atención Seleccionada
                          </span>
                          <span className="text-sm sm:text-base font-black text-[#132A26] dark:text-[#E8F5F2] capitalize">
                            {formatearFechaLegible(fechaSeleccionada)}
                          </span>
                        </div>
                      </div>

                      {/* Botones de días rápidos + selector de calendario */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {opcionesFechas.map((f) => {
                          const activo = fechaSeleccionada === f.iso;
                          return (
                            <button
                              key={f.iso}
                              type="button"
                              onClick={() => handleCambiarFecha(f.iso)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                activo
                                  ? "bg-[#0F766E] text-white border-[#0F766E] shadow-2xs"
                                  : "bg-white dark:bg-[#122420] text-[#132A26] dark:text-[#D9F5EF] border-[#CDECE5] dark:border-[#264E46] hover:border-[#0F766E]"
                              }`}
                            >
                              <span className="block capitalize">{f.etiqueta}</span>
                              <span className={`text-[10px] ${activo ? "text-[#D9F5EF]" : "text-[#355C56] dark:text-[#9CC2BC]"}`}>
                                {f.diaMes}
                              </span>
                            </button>
                          );
                        })}
                        <input
                          type="date"
                          value={fechaSeleccionada}
                          onChange={(e) => e.target.value && handleCambiarFecha(e.target.value)}
                          className="px-3 py-2 rounded-xl text-xs font-mono font-bold bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#264E46] text-[#132A26] dark:text-[#E8F5F2] focus:outline-none focus:border-[#0F766E] cursor-pointer"
                          aria-label="Elegir otra fecha"
                        />
                      </div>
                    </div>

                    {/* Filtros de Jornada (Mañana / Tarde) y Leyenda Visual */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg sm:text-xl font-black text-[#132A26] dark:text-[#E8F5F2]">
                          Selecciona el Profesional y Horario
                        </h3>
                        {/* Leyenda de tipos de cupo */}
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[#355C56] dark:text-[#9CC2BC]">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded bg-[#F4FAF8] dark:bg-[#152B26] border border-[#CDECE5] dark:border-[#2A534B]" />
                            <span>Cupo General</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-400" />
                            <span>★ Cupo Protegido 60+</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-amber-500 font-bold">⚡</span>
                            <span>Liberado por cancelación oportuna</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-[#F4FAF8] dark:bg-[#0B1715] p-1.5 rounded-xl border border-[#CDECE5] dark:border-[#264E46] self-start md:self-auto">
                        <button
                          type="button"
                          onClick={() => setFiltroJornada("TODAS")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            filtroJornada === "TODAS"
                              ? "bg-[#0F766E] text-white shadow-2xs"
                              : "text-[#355C56] dark:text-[#9CC2BC] hover:text-[#132A26] dark:hover:text-white"
                          }`}
                        >
                          Todo el Día
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroJornada("MANANA")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            filtroJornada === "MANANA"
                              ? "bg-[#0F766E] text-white shadow-2xs"
                              : "text-[#355C56] dark:text-[#9CC2BC] hover:text-[#132A26] dark:hover:text-white"
                          }`}
                        >
                          Mañana (08:00 - 12:40)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroJornada("TARDE")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            filtroJornada === "TARDE"
                              ? "bg-[#0F766E] text-white shadow-2xs"
                              : "text-[#355C56] dark:text-[#9CC2BC] hover:text-[#132A26] dark:hover:text-white"
                          }`}
                        >
                          Tarde (14:00 - 17:00)
                        </button>
                      </div>
                    </div>

                    {/* Error de reserva en línea (en vez de alert() nativo) */}
                    {errorReservaMsg && (
                      <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 p-4 rounded-2xl text-xs sm:text-sm text-red-800 dark:text-red-200 animate-fadeIn">
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold block">No se pudo completar la reserva</strong>
                          <span>{errorReservaMsg}</span>
                        </div>
                      </div>
                    )}

                    {/* Visualización de Horarios agrupados por Profesional */}
                    {cargandoBloques ? (
                      <div className="py-12 flex flex-col items-center justify-center text-center text-sm text-[#355C56] dark:text-[#9CC2BC]">
                        <ArrowPathIcon className="w-8 h-8 animate-spin text-[#0F766E] dark:text-[#5BB9A6] mb-3" />
                        <span className="font-bold">Sincronizando cupos disponibles en tiempo real...</span>
                      </div>
                    ) : profesionalesConBloques.length === 0 ? (
                      <div className="text-center py-12 bg-[#F4FAF8] dark:bg-[#0B1715] rounded-2xl border border-[#CDECE5] dark:border-[#264E46] p-6 space-y-2">
                        <InformationCircleIcon className="w-9 h-9 text-[#0F766E] dark:text-[#5BB9A6] mx-auto mb-1" />
                        <h4 className="font-bold text-base text-[#132A26] dark:text-[#E8F5F2]">
                          No hay horarios disponibles para el filtro o fecha seleccionada
                        </h4>
                        <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] max-w-md mx-auto">
                          Pruebe seleccionando otra jornada (Todo el Día) o consulte disponibilidad en Ventanilla SOME.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {profesionalesConBloques.map((item) => (
                          <div
                            key={`${item.profesional.id}_${item.fecha}`}
                            className="bg-white dark:bg-[#0B1715] border-2 border-[#CDECE5] dark:border-[#264E46] rounded-2xl p-5 sm:p-6 space-y-4 hover:border-[#5BB9A6] transition-all shadow-2xs"
                          >
                            {/* Ficha del Médico */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#CDECE5] dark:border-[#21403A] pb-3.5">
                              <div className="flex items-center gap-3.5">
                                <div className="w-11 h-11 rounded-xl bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#A7E3D4] font-black text-sm flex items-center justify-center">
                                  Dr
                                </div>
                                <div>
                                  <h4 className="text-base font-extrabold text-[#132A26] dark:text-[#E8F5F2]">
                                    {item.profesional.nombre_completo}
                                  </h4>
                                  <div className="flex items-center gap-2 text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC]">
                                    <span className="font-bold text-[#132A26] dark:text-[#D9F5EF]">{item.box.numero}</span>
                                    <span>•</span>
                                    <span className="text-[#0F766E] dark:text-[#5BB9A6] font-bold">
                                      {item.bloques.length} bloques disponibles
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <span className="text-xs font-bold text-[#1E4640] dark:text-[#A7E3D4] bg-[#F4FAF8] dark:bg-[#152B26] px-3 py-1.5 rounded-xl border border-[#CDECE5] dark:border-[#264E46] self-start sm:self-auto capitalize">
                                {formatearFechaLegible(item.fecha)}
                              </span>
                            </div>

                            {/* Pastillas de Hora (Área táctil mejorada min-h-[52px] para Adultos Mayores) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                              {item.bloques.map((bloque) => {
                                const isSelected = bloqueSeleccionado?.id === bloque.id;
                                const esSenior = bloque.es_cuota_adulto_mayor;

                                return (
                                  <button
                                    key={bloque.id}
                                    type="button"
                                    id={`slot-${bloque.id}`}
                                    onClick={() => setBloqueSeleccionado(bloque)}
                                    className={`min-h-[54px] py-2.5 px-3 rounded-xl border-2 text-center transition-all cursor-pointer relative flex flex-col items-center justify-center ${
                                      isSelected
                                        ? "bg-[#0F766E] text-white border-[#0F766E] shadow-md ring-4 ring-[#A7E3D4]/50 font-black scale-[1.02]"
                                        : esSenior
                                        ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/80 text-[#132A26] dark:text-[#E8F5F2] hover:border-amber-500 hover:bg-amber-100/70 font-bold"
                                        : "bg-[#F4FAF8] dark:bg-[#152B26] border-[#CDECE5] dark:border-[#2A534B] text-[#132A26] dark:text-[#E8F5F2] hover:border-[#0F766E] hover:bg-[#D9F5EF]/50 font-bold"
                                    }`}
                                  >
                                    <span className="text-sm sm:text-base font-mono block leading-tight">
                                      {bloque.hora_inicio}
                                    </span>
                                    {esSenior ? (
                                      <span
                                        className={`text-[10px] block font-extrabold mt-0.5 ${
                                          isSelected
                                            ? "text-amber-200"
                                            : "text-amber-800 dark:text-amber-300"
                                        }`}
                                      >
                                        ★ Cuota 60+
                                      </span>
                                    ) : (
                                      <span
                                        className={`text-[10px] block font-medium mt-0.5 ${
                                          isSelected
                                            ? "text-[#D9F5EF]"
                                            : "text-[#355C56] dark:text-[#9CC2BC]"
                                        }`}
                                      >
                                        General
                                      </span>
                                    )}
                                    {bloque.es_cancelacion_reciente && (
                                      <span
                                        className="absolute -top-2 -right-1.5 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-xs"
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
                      <div className="sticky bottom-4 z-40 bg-white dark:bg-[#122420] border-2 border-[#0F766E] dark:border-[#5BB9A6] p-4 sm:p-5 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
                        <div className="text-left space-y-0.5 w-full sm:w-auto">
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase font-extrabold tracking-wider text-[#0F766E] dark:text-[#5BB9A6]">
                              Horario Seleccionado
                            </span>
                            {bloqueSeleccionado.es_cuota_adulto_mayor && (
                              <span className="bg-amber-100 text-amber-900 border border-amber-400 text-[10px] font-extrabold px-2 py-0.2 rounded-full">
                                ★ Cupo Protegido 60+
                              </span>
                            )}
                          </div>
                          <strong className="text-base sm:text-lg text-[#132A26] dark:text-[#E8F5F2] block">
                            {bloqueSeleccionado.hora_inicio} a {bloqueSeleccionado.hora_fin} hrs •{" "}
                            {bloqueSeleccionado.profesional.nombre_completo}
                          </strong>
                          <span className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] block">
                            {bloqueSeleccionado.box.numero} • {formatearFechaLegible(bloqueSeleccionado.fecha)}
                          </span>
                        </div>

                        <button
                          type="button"
                          id="btn-confirmar-reserva"
                          disabled={confirmandoReserva}
                          onClick={handleConfirmarReserva}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0F766E] hover:bg-[#115E59] active:bg-[#134E4A] text-white px-7 py-4 rounded-xl font-bold text-sm sm:text-base shadow-lg transition-all disabled:opacity-50 cursor-pointer flex-shrink-0"
                        >
                          {confirmandoReserva ? (
                            <>
                              <ArrowPathIcon className="w-5 h-5 animate-spin" />
                              <span>Confirmando Cita...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircleIcon className="w-5 h-5" />
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
                  <div className="max-w-xl mx-auto space-y-6 text-center animate-fadeIn">
                    
                    <div className="print:hidden space-y-2">
                      <div className="w-16 h-16 rounded-full bg-[#D9F5EF] dark:bg-[#1E3F3B] flex items-center justify-center mx-auto text-[#0F766E] dark:text-[#5BB9A6]">
                        <CheckCircleIcon className="w-10 h-10" />
                      </div>

                      <span className="text-xs uppercase font-extrabold tracking-wider text-[#0F766E] dark:text-[#5BB9A6] block">
                        ¡Reserva Confirmada Exitosamente!
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-black text-[#132A26] dark:text-[#E8F5F2]">
                        Comprobante Oficial de Atención
                      </h2>
                      <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC]">
                        Su hora ha quedado registrada en la agenda clínica del CESFAM. Hemos enviado un respaldo SMS al número{" "}
                        <strong className="font-mono">{comprobanteGenerado.telefono}</strong>.
                      </p>
                    </div>

                    {/* Ticket / Ficha Resumen de Comprobante (Listo para impresora térmica o PDF) */}
                    <div className="print-ticket-container bg-[#F4FAF8] dark:bg-[#0B1715] border-2 border-[#A7E3D4] dark:border-[#264E46] rounded-3xl p-6 sm:p-7 text-left space-y-4 shadow-sm">
                      
                      <div className="flex items-center justify-between border-b border-[#CDECE5] dark:border-[#21403A] pb-3.5">
                        <div>
                          <span className="text-xs text-[#355C56] dark:text-[#9CC2BC] font-semibold block">
                            Código Único de Reserva:
                          </span>
                          <span className="font-mono font-black text-2xl text-[#0F766E] dark:text-[#A7E3D4] tracking-wider">
                            {comprobanteGenerado.codigo_reserva}
                          </span>
                        </div>
                        {comprobanteGenerado.es_adulto_mayor && (
                          <div className="text-right">
                            <span className="inline-block text-xs font-extrabold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 px-3 py-1 rounded-full">
                              ★ Prioridad Adulto Mayor 60+
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs sm:text-sm">
                        <div>
                          <span className="text-[#355C56] dark:text-[#9CC2BC] block">Paciente:</span>
                          <strong className="text-[#132A26] dark:text-white font-bold">
                            {comprobanteGenerado.paciente_nombre}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#355C56] dark:text-[#9CC2BC] block">RUT:</span>
                          <strong className="font-mono text-[#132A26] dark:text-white font-bold">
                            {comprobanteGenerado.paciente_rut}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#355C56] dark:text-[#9CC2BC] block">Especialidad:</span>
                          <strong className="text-[#0F766E] dark:text-[#5BB9A6] font-extrabold uppercase">
                            {comprobanteGenerado.especialidad}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#355C56] dark:text-[#9CC2BC] block">Fecha y Horario:</span>
                          <strong className="text-[#132A26] dark:text-white font-bold">
                            {comprobanteGenerado.fecha} • {comprobanteGenerado.hora_inicio} a {comprobanteGenerado.hora_fin} hrs
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#355C56] dark:text-[#9CC2BC] block">Profesional a Cargo:</span>
                          <strong className="text-[#132A26] dark:text-white font-bold">
                            {comprobanteGenerado.profesional}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#355C56] dark:text-[#9CC2BC] block">Box de Atención:</span>
                          <strong className="text-[#132A26] dark:text-white font-bold">
                            {comprobanteGenerado.box}
                          </strong>
                        </div>
                      </div>

                      {/* Verificación electrónica */}
                      <div className="pt-2 border-t border-[#CDECE5] dark:border-[#21403A] text-center">
                        <div className="font-mono text-xs tracking-widest text-slate-400 dark:text-slate-500 uppercase select-none">
                          || | |||| || ||| ||||| ||| || ||||
                        </div>
                        <span className="text-[11px] text-[#355C56] dark:text-[#9CC2BC]">
                          Presentarse 15 minutos antes con Cédula de Identidad en recepción SOME
                        </span>
                      </div>

                      <div className="print:hidden bg-[#D9F5EF]/50 dark:bg-[#1E3F3B]/40 p-3.5 rounded-2xl text-xs text-[#1E4640] dark:text-[#D9F5EF] leading-relaxed">
                        💡 <strong>Compromiso Asistencial:</strong> Si no puede asistir, anule su cita con al menos{" "}
                        <strong>30 minutos de anticipación</strong> en la pestaña <em>Administrar / Anular Cita</em> para liberar el cupo a otro vecino.
                      </div>
                    </div>

                    {/* Botones de Acción (Ocultos al imprimir) */}
                    <div className="print:hidden flex flex-col sm:flex-row items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1E4640] hover:bg-[#132A26] text-white px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                      >
                        <PrinterIcon className="w-4 h-4" />
                        <span>Imprimir / Guardar PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCerrarSesion}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0F766E] hover:bg-[#115E59] text-white px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
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
              <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                
                <div className="text-center space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-black text-[#132A26] dark:text-[#E8F5F2]">
                    Administra o Anula tu Cita Agendada
                  </h2>
                  <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC]">
                    Consulta tus horas médicas activas y anula oportunamente (mínimo 30 min antes) para liberar el cupo a la comunidad sin registrar inasistencia.
                  </p>
                </div>

                {/* Formulario de Consulta de Citas */}
                <form onSubmit={handleBuscarCitasAdmin} className="space-y-4">
                  <div>
                    <label
                      htmlFor="rutAdminInput"
                      className="block text-xs sm:text-sm font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1.5"
                    >
                      RUT del Paciente
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <IdentificationIcon className="w-6 h-6 text-[#0F766E] dark:text-[#5BB9A6]" />
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
                        className="w-full pl-12 pr-4 py-4 bg-[#F4FAF8] dark:bg-[#0B1715] border-2 border-[#CDECE5] dark:border-[#264E46] text-[#132A26] dark:text-white rounded-2xl text-base sm:text-lg font-mono font-bold tracking-wider placeholder-slate-400 focus:outline-none focus:border-[#0F766E] focus:ring-4 focus:ring-[#A7E3D4]/30 transition-all"
                      />
                    </div>
                  </div>

                  {/* Accesos rápidos para probar consulta de citas */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[#355C56] dark:text-[#9CC2BC] font-semibold">Prueba rápida:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const r = formatearRut("5555555-5");
                        setRutAdminInput(r);
                        buscarCitasPorRut(r);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#264E46] font-mono font-bold text-[#0F766E] dark:text-[#A7E3D4] hover:bg-[#D9F5EF]/50 cursor-pointer"
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
                      className="px-2.5 py-1 rounded-lg bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#264E46] font-mono font-bold text-[#0F766E] dark:text-[#A7E3D4] hover:bg-[#D9F5EF]/50 cursor-pointer"
                    >
                      21.111.111-1 (Joven)
                    </button>
                  </div>

                  <button
                    type="submit"
                    id="btn-buscar-citas-admin"
                    disabled={cargandoAdmin}
                    className="w-full flex items-center justify-center gap-2 bg-[#0F766E] hover:bg-[#115E59] text-white py-4 rounded-2xl font-bold text-sm sm:text-base shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {cargandoAdmin ? (
                      <>
                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
                        <span>Buscando Citas Registradas...</span>
                      </>
                    ) : (
                      <>
                        <MagnifyingGlassIcon className="w-5 h-5" />
                        <span>Consultar Mis Citas</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Mensaje de Éxito al Anular */}
                {mensajeExitoAdmin && (
                  <div className="bg-[#D9F5EF] dark:bg-[#1E3F3B] border border-[#5BB9A6] p-4 rounded-2xl text-xs sm:text-sm text-[#132A26] dark:text-[#E8F5F2] font-bold animate-fadeIn">
                    {mensajeExitoAdmin}
                  </div>
                )}

                {/* Mensaje de Error al Anular */}
                {errorAdminMsg && (
                  <div className="bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 p-4 rounded-2xl text-xs sm:text-sm text-red-800 dark:text-red-200 font-semibold animate-fadeIn">
                    {errorAdminMsg}
                  </div>
                )}

                {/* Resultados de la Búsqueda */}
                {adminBuscado && !cargandoAdmin && (
                  <div className="space-y-4 pt-2">
                    {citasDelPaciente.length === 0 ? (
                      <div className="text-center py-10 bg-[#F4FAF8] dark:bg-[#0B1715] rounded-2xl border border-[#CDECE5] dark:border-[#264E46] p-6 space-y-2.5">
                        <InformationCircleIcon className="w-9 h-9 text-[#0F766E] dark:text-[#5BB9A6] mx-auto mb-1" />
                        <h4 className="font-bold text-base text-[#132A26] dark:text-[#E8F5F2]">
                          No se registran citas para este RUT
                        </h4>
                        <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC]">
                          {pacienteAdmin
                            ? `El paciente ${pacienteAdmin.nombres} ${pacienteAdmin.apellidos} no tiene atenciones registradas.`
                            : "El RUT ingresado no posee citas en el sistema."}
                        </p>
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setModoPrincipal("RESERVAR")}
                            className="inline-flex items-center gap-1.5 bg-[#0F766E] hover:bg-[#115E59] text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
                          >
                            <span>Reservar una Hora Ahora</span>
                            <ChevronRightIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#1E4640] dark:text-[#A7E3D4]">
                            Historial de Citas de {pacienteAdmin?.nombres} {pacienteAdmin?.apellidos}
                          </h4>
                          <span className="text-xs font-mono text-[#355C56] dark:text-[#9CC2BC]">
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
                              className="bg-white dark:bg-[#0B1715] border-2 border-[#CDECE5] dark:border-[#264E46] p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-2xs"
                            >
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-extrabold text-base text-[#132A26] dark:text-[#E8F5F2]">
                                    {cita.especialidad.replace("_", " ")}
                                  </span>
                                  <span
                                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                      estaAgendada
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                    }`}
                                  >
                                    {cita.estado_cita.replace("_", " ")}
                                  </span>
                                  {cita.bloque?.es_cuota_adulto_mayor && (
                                    <span className="bg-amber-100 text-amber-900 border border-amber-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                      ★ Cuota 60+
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] pt-1">
                                  <p>
                                    Código Reserva:{" "}
                                    <strong className="font-mono text-[#0F766E] dark:text-[#A7E3D4]">
                                      {cita.codigo_reserva}
                                    </strong>
                                  </p>
                                  <p>
                                    Horario:{" "}
                                    <strong className="font-mono text-[#132A26] dark:text-white">
                                      {horaIni} a {horaFin} hrs
                                    </strong>
                                  </p>
                                  <p>
                                    Profesional:{" "}
                                    <strong className="text-[#132A26] dark:text-white">
                                      Dr(a). {cita.profesional.nombres} {cita.profesional.apellidos}
                                    </strong>
                                  </p>
                                  <p className="capitalize">
                                    Fecha: <strong className="text-[#132A26] dark:text-white">{fechaCita}</strong>
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
                                  className="self-start sm:self-auto inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/70 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex-shrink-0"
                                >
                                  {anulandoCitaId === cita.id ? (
                                    <>
                                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                      <span>Liberando Cupo...</span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircleIcon className="w-4 h-4" />
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
      <section className="print:hidden max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-14">
        
        {/* ¿Cómo Funciona tu Reserva en 3 Pasos? */}
        <div id="como-funciona" className="text-center space-y-2 scroll-mt-24">
          <h3 className="text-xl sm:text-2xl font-black text-[#132A26] dark:text-[#E8F5F2]">
            ¿Cómo Funciona el Agendamiento en MallaSalud?
          </h3>
          <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC]">
            Diseñado especialmente para brindar rapidez, claridad visual y prioridad al adulto mayor.
          </p>

          <div className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-white dark:bg-[#122420] p-6 rounded-2xl border border-[#CDECE5] dark:border-[#21403A] shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#5BB9A6] flex items-center justify-center font-black text-base">
                1
              </div>
              <h4 className="font-bold text-base text-[#132A26] dark:text-[#E8F5F2]">
                Ingresa tu RUT
              </h4>
              <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] leading-relaxed">
                El sistema valida tu inscripción comunal en el CESFAM y detecta automáticamente si eres beneficiario de la cuota protegida 60+.
              </p>
            </div>

            <div className="bg-white dark:bg-[#122420] p-6 rounded-2xl border border-[#CDECE5] dark:border-[#21403A] shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#5BB9A6] flex items-center justify-center font-black text-base">
                2
              </div>
              <h4 className="font-bold text-base text-[#132A26] dark:text-[#E8F5F2]">
                Elige Especialidad y Hora
              </h4>
              <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] leading-relaxed">
                Revisa los cupos disponibles en tiempo real sincronizados con mesón SOME y selecciona el profesional y horario que prefieras.
              </p>
            </div>

            <div className="bg-white dark:bg-[#122420] p-6 rounded-2xl border border-[#CDECE5] dark:border-[#21403A] shadow-2xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#5BB9A6] flex items-center justify-center font-black text-base">
                3
              </div>
              <h4 className="font-bold text-base text-[#132A26] dark:text-[#E8F5F2]">
                Recibe tu Comprobante y SMS
              </h4>
              <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] leading-relaxed">
                Obtén tu código de reserva al instante. Si no puedes acudir, anula desde la web para liberar el cupo a otro vecino.
              </p>
            </div>
          </div>
        </div>

        {/* Preguntas Frecuentes (FAQ) */}
        <div id="faq" className="scroll-mt-24 space-y-4 max-w-4xl mx-auto">
          <div className="text-center space-y-1">
            <h3 className="text-xl sm:text-2xl font-black text-[#132A26] dark:text-[#E8F5F2]">
              Preguntas Frecuentes
            </h3>
            <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC]">
              Respuestas sobre agendamiento, cuota protegida 60+ y cancelación oportuna.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            {[
              {
                q: "¿Cómo funciona la cuota protegida del 30% para adultos mayores (60+)?",
                a: "Al ingresar el RUT de una persona de 60 años o más, el sistema desbloquea automáticamente el 30% de los cupos diarios de Medicina General reservados por normativa para personas mayores (identificados con la estrella dorada ★ 60+).",
              },
              {
                q: "¿Qué ocurre si no puedo asistir a la cita médica agendada?",
                a: "Debe ingresar a la pestaña 'Administrar / Anular Cita' con al menos 30 minutos de antelación. Así el cupo se libera de inmediato para otro vecino y no se registrará inasistencia (NSP) en su ficha.",
              },
              {
                q: "¿Puedo reservar una hora médica para un familiar o adulto mayor?",
                a: "Sí. En el Paso 1 seleccione la opción 'Familiar / Adulto Mayor' e ingrese el RUT del paciente que recibirá la atención médica.",
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#21403A] rounded-2xl overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setFaqAbierta(faqAbierta === idx ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between text-xs sm:text-base font-bold text-[#132A26] dark:text-[#E8F5F2] hover:text-[#0F766E] dark:hover:text-[#5BB9A6] cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDownIcon
                    className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ml-2 ${
                      faqAbierta === idx ? "rotate-180 text-[#0F766E] dark:text-[#5BB9A6]" : ""
                    }`}
                  />
                </button>
                {faqAbierta === idx && (
                  <div className="px-4 sm:px-5 pb-5 pt-1 text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] leading-relaxed border-t border-[#CDECE5]/60 dark:border-[#21403A]/60 animate-fadeIn">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* ==================================================================== */}
      {/* 4. MODAL EDUCATIVO DE INASISTENCIAS (NSP) - HU-001                   */}
      {/* ==================================================================== */}
      {mostrarModalNsp && pacienteActivo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#122420] border border-[#A7E3D4] dark:border-[#2A534B] max-w-md w-full p-6 sm:p-7 rounded-3xl shadow-2xl space-y-4">
            
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 flex items-center justify-center flex-shrink-0">
                <ExclamationTriangleIcon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Compromiso Asistencial CESFAM
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-[#132A26] dark:text-[#E8F5F2]">
                  Registro de Inasistencias Previas
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] leading-relaxed">
              Estimado/a <strong className="text-[#132A26] dark:text-white">{pacienteActivo.nombre_completo}</strong>, nuestro sistema registra que usted cuenta con{" "}
              <strong className="text-amber-700 dark:text-amber-300">
                {pacienteActivo.contador_inasistencias} inasistencia(s) previa(s)
              </strong>{" "}
              no justificadas en citas anteriores.
            </p>

            <div className="bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#21403A] p-4 rounded-2xl text-xs sm:text-sm space-y-1 text-[#132A26] dark:text-[#D9F5EF]">
              <p className="font-bold text-[#0F766E] dark:text-[#5BB9A6]">Cuidemos la salud de nuestra comunidad:</p>
              <p className="text-xs leading-relaxed text-[#355C56] dark:text-[#9CC2BC]">
                Si no puede asistir a su próxima cita, recuerde anularla con al menos{" "}
                <strong>30 minutos de anticipación</strong> desde esta plataforma o llamando al 800 500 123.
              </p>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              * Este aviso es educativo (HU-001) y no bloquea su derecho a reservar atención médica.
            </p>

            <div className="pt-2">
              <button
                type="button"
                id="btn-cerrar-modal-nsp"
                onClick={() => setMostrarModalNsp(false)}
                className="w-full bg-[#0F766E] hover:bg-[#115E59] text-white py-3.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer"
              >
                Entendido, Continuar al Agendamiento →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. MODAL DE CONFIRMACIÓN DE ANULACIÓN OPORTUNA (Sin confirm nativo)  */}
      {/* ==================================================================== */}
      {citaPorAnular && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#2A534B] max-w-md w-full p-6 sm:p-7 rounded-3xl shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-950/70 text-red-600 flex items-center justify-center flex-shrink-0">
                <XCircleIcon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                  Cancelación Oportuna • HU-003
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-[#132A26] dark:text-[#E8F5F2]">
                  ¿Confirmar anulación de cita?
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] leading-relaxed">
              Está a punto de anular la cita <strong className="font-mono text-[#132A26] dark:text-white">{citaPorAnular.codigo_reserva}</strong> de{" "}
              <strong>{citaPorAnular.especialidad.replace("_", " ")}</strong>.
            </p>

            <div className="bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#21403A] p-3.5 rounded-2xl text-xs text-[#355C56] dark:text-[#9CC2BC] space-y-1">
              <p>✓ El cupo será liberado de inmediato para otro vecino del CESFAM.</p>
              <p>✓ No se registrará penalización ni inasistencia (NSP) en su ficha.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={ejecutarAnulacionCita}
                disabled={anulandoCitaId === citaPorAnular.id}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {anulandoCitaId === citaPorAnular.id ? "Anulando..." : "Sí, Anular y Liberar Cupo"}
              </button>
              <button
                type="button"
                onClick={() => setCitaPorAnular(null)}
                className="px-4 py-3 rounded-xl border border-[#CDECE5] dark:border-[#264E46] text-xs sm:text-sm font-bold text-[#132A26] dark:text-[#D9F5EF] hover:bg-slate-100 dark:hover:bg-[#17302B] transition-all cursor-pointer"
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
