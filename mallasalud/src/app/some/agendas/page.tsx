"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CalendarDaysIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  PauseCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  Squares2X2Icon,
  TableCellsIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

// Tipos de Dominio
type EspecialidadEnum = "MEDICINA_GENERAL" | "DENTAL" | "MATRONERIA";
type EstadoBloqueEnum = "DISPONIBLE" | "BLOQUEO_TEMPORAL" | "RESERVADO" | "BLOQUEADO_SOME";

interface PacienteCita {
  id: string;
  rut: string;
  rut_formateado: string;
  nombre_completo: string;
  telefono: string;
}

interface CitaBloque {
  codigo_reserva: string;
  estado_cita: string;
  paciente: PacienteCita | null;
}

interface BloqueDetalle {
  id: string;
  hora_inicio: string;
  hora_fin: string;
  timestamp_inicio: string;
  timestamp_fin: string;
  estado_bloque: EstadoBloqueEnum;
  es_cuota_adulto_mayor: boolean;
  cita: CitaBloque | null;
}

interface Profesional {
  id: string;
  rut: string;
  nombres: string;
  apellidos: string;
  especialidad: EspecialidadEnum;
  activo: boolean;
}

interface Box {
  id: string;
  numero: string;
  especialidad: EspecialidadEnum;
  activo: boolean;
}

interface AgendaMedica {
  id: string;
  profesional_id: string;
  profesional_nombre: string;
  profesional_rut: string;
  box_id: string;
  box_numero: string;
  especialidad: EspecialidadEnum;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_bloque_min: number;
  activa: boolean;
  estadisticas: {
    total: number;
    disponibles: number;
    reservados: number;
    bloqueados_some: number;
    bloqueo_temporal: number;
    cuota_adulto_mayor: number;
  };
  bloques: BloqueDetalle[];
  bloques_horarios?: BloqueDetalle[];
}

export default function AgendasPage() {
  // Modo de vista: 'matriz' (diaria por boxes), 'semanal', 'tabla'
  const [modoVista, setModoVista] = useState<"matriz" | "semanal" | "tabla">("matriz");

  // Catálogos y Datos
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [agendas, setAgendas] = useState<AgendaMedica[]>([]);
  const [cargando, setCargando] = useState(true);

  // Fecha seleccionada (YYYY-MM-DD)
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Filtros de visualización
  const [filtroEspecialidad, setFiltroEspecialidad] = useState<string>("");
  const [filtroBoxId, setFiltroBoxId] = useState<string>("");
  const [filtroProfesionalId, setFiltroProfesionalId] = useState<string>("");

  // Modal de Detalle de Bloque
  const [bloqueSeleccionado, setBloqueSeleccionado] = useState<{
    bloque: BloqueDetalle;
    agenda: AgendaMedica;
  } | null>(null);

  // Modal de Confirmación para Pausar Agenda
  const [agendaPorPausar, setAgendaPorPausar] = useState<AgendaMedica | null>(null);

  // Modal de Creación de Agenda
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [nuevoProfId, setNuevoProfId] = useState("");
  const [nuevaEsp, setNuevaEsp] = useState<EspecialidadEnum>("MEDICINA_GENERAL");
  const [nuevoBoxId, setNuevoBoxId] = useState("");
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevaHoraInicio, setNuevaHoraInicio] = useState("08:00");
  const [nuevaHoraFin, setNuevaHoraFin] = useState("17:00");
  const [nuevaDuracionMin, setNuevaDuracionMin] = useState(20);
  const [nuevoPorcentajeCuota, setNuevoPorcentajeCuota] = useState(30);

  // Estados de envío y alertas
  const [guardandoAgenda, setGuardandoAgenda] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [alertaPausa, setAlertaPausa] = useState<string | null>(null);

  // Cargar agendas desde la API según el modo de vista y la fecha
  const cargarAgendas = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();

      if (modoVista === "semanal") {
        const d = new Date(fechaSeleccionada + "T00:00:00");
        const dayOfWeek = d.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const lunes = new Date(d);
        lunes.setDate(d.getDate() + diffToMonday);
        const sabado = new Date(lunes);
        sabado.setDate(lunes.getDate() + 5);

        params.set("fecha_desde", lunes.toISOString().split("T")[0]);
        params.set("fecha_hasta", sabado.toISOString().split("T")[0]);
      } else if (modoVista === "matriz") {
        params.set("fecha", fechaSeleccionada);
      }

      if (filtroEspecialidad) params.set("especialidad", filtroEspecialidad);
      if (filtroBoxId) params.set("box_id", filtroBoxId);
      if (filtroProfesionalId) params.set("profesional_id", filtroProfesionalId);

      const res = await fetch(`/api/v1/some/agendas?${params.toString()}`);
      if (!res.ok) throw new Error("Error al obtener agendas");
      const data = await res.json();

      setAgendas(data.agendas || []);
      setProfesionales(data.profesionales || []);
      setBoxes(data.boxes || []);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  }, [fechaSeleccionada, modoVista, filtroEspecialidad, filtroBoxId, filtroProfesionalId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarAgendas();
  }, [cargarAgendas]);

  // Manejo de cambio de fecha relativa
  const cambiarDia = (offsetDias: number) => {
    const d = new Date(fechaSeleccionada + "T00:00:00");
    d.setDate(d.getDate() + offsetDias);
    setFechaSeleccionada(d.toISOString().split("T")[0]);
  };

  const irAHoy = () => {
    setFechaSeleccionada(new Date().toISOString().split("T")[0]);
  };

  const irAMañana = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setFechaSeleccionada(d.toISOString().split("T")[0]);
  };

  // Abrir modal de creación con pre-carga contextual
  const abrirModalCrear = (prefill?: { boxId?: string; fecha?: string }) => {
    setErrorModal(null);
    setMensajeExito(null);

    const f = prefill?.fecha || fechaSeleccionada;
    setNuevaFecha(f);

    if (prefill?.boxId) {
      setNuevoBoxId(prefill.boxId);
      const b = boxes.find((item) => item.id === prefill.boxId);
      if (b) {
        setNuevaEsp(b.especialidad);
        const profCompatible = profesionales.find((p) => p.especialidad === b.especialidad);
        if (profCompatible) setNuevoProfId(profCompatible.id);
      }
    } else {
      if (boxes.length > 0) setNuevoBoxId(boxes[0].id);
      if (profesionales.length > 0) {
        setNuevoProfId(profesionales[0].id);
        setNuevaEsp(profesionales[0].especialidad);
      }
    }

    setNuevaHoraInicio("08:00");
    setNuevaHoraFin("17:00");
    setNuevaDuracionMin(20);
    setNuevoPorcentajeCuota(30);
    setModalCrearAbierto(true);
  };

  // Sincronizar profesional -> especialidad en modal
  const handleModalProfChange = (pId: string) => {
    setNuevoProfId(pId);
    const p = profesionales.find((item) => item.id === pId);
    if (p) {
      setNuevaEsp(p.especialidad);
      const boxCompatible = boxes.find((b) => b.especialidad === p.especialidad);
      if (boxCompatible) setNuevoBoxId(boxCompatible.id);
    }
  };

  // Previsualizador en vivo dentro del modal
  const previsualizacionModal = useMemo(() => {
    const toMin = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };
    const ini = toMin(nuevaHoraInicio);
    const fin = toMin(nuevaHoraFin);

    if (isNaN(ini) || isNaN(fin) || ini >= fin || nuevaDuracionMin <= 0) {
      return { total: 0, cuota: 0, colacionOmitida: 0 };
    }

    const COL_INI = 13 * 60;
    const COL_FIN = 14 * 60;
    let count = 0;
    let colacionCount = 0;
    let curr = ini;

    while (curr + nuevaDuracionMin <= fin) {
      const blockEnd = curr + nuevaDuracionMin;
      if (curr < COL_FIN && blockEnd > COL_INI) {
        colacionCount++;
      } else {
        count++;
      }
      curr += nuevaDuracionMin;
    }

    const cuota =
      nuevaEsp === "MEDICINA_GENERAL" ? Math.round((count * nuevoPorcentajeCuota) / 100) : 0;
    return { total: count, cuota, colacionOmitida: colacionCount };
  }, [nuevaHoraInicio, nuevaHoraFin, nuevaDuracionMin, nuevoPorcentajeCuota, nuevaEsp]);

  // Publicar nueva agenda
  const handleCrearAgendaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorModal(null);
    setGuardandoAgenda(true);

    try {
      const res = await fetch("/api/v1/some/agendas/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profesional_id: nuevoProfId,
          box_id: nuevoBoxId,
          especialidad: nuevaEsp,
          fecha: nuevaFecha,
          hora_inicio: nuevaHoraInicio,
          hora_fin: nuevaHoraFin,
          duracion_bloque_min: nuevaDuracionMin,
          porcentaje_cuota_mayor: nuevaEsp === "MEDICINA_GENERAL" ? nuevoPorcentajeCuota : 0,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setErrorModal(`[CONFLICTO DE HORARIO]: ${data.mensaje || data.error}`);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || data.mensaje || "Error al crear agenda");
      }

      setMensajeExito(
        `Agenda publicada exitosamente: ${data.total_bloques} bloques generados (${data.bloques_cuota_mayor} cupos protegidos 60+).`
      );
      setModalCrearAbierto(false);
      setFechaSeleccionada(nuevaFecha);
      await cargarAgendas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido al crear agenda";
      setErrorModal(msg);
    } finally {
      setGuardandoAgenda(false);
    }
  };

  // Pausar agenda
  const confirmarPausaAgenda = async () => {
    if (!agendaPorPausar) return;
    const id = agendaPorPausar.id;

    setAlertaPausa(null);
    try {
      const res = await fetch(`/api/v1/some/agendas/${id}/pausar`, {
        method: "PUT",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al pausar");

      setAlertaPausa(data.mensaje);
      setAgendaPorPausar(null);
      await cargarAgendas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al pausar agenda";
      setAlertaPausa(msg);
      setAgendaPorPausar(null);
    }
  };

  // Boxes filtrados para la matriz
  const boxesFiltrados = useMemo(() => {
    return boxes.filter((b) => {
      if (filtroBoxId && b.id !== filtroBoxId) return false;
      if (filtroEspecialidad && b.especialidad !== filtroEspecialidad) return false;
      return true;
    });
  }, [boxes, filtroBoxId, filtroEspecialidad]);

  // Lista de horas fijas de la jornada (08:00 a 16:40 cada 20 min)
  const franjasHorarias = useMemo(() => {
    const slots: string[] = [];
    let m = 8 * 60; // 08:00
    const end = 17 * 60; // 17:00
    while (m + 20 <= end) {
      const h = String(Math.floor(m / 60)).padStart(2, "0");
      const min = String(m % 60).padStart(2, "0");
      slots.push(`${h}:${min}`);
      m += 20;
    }
    return slots;
  }, []);

  // Días de la semana para modo semanal
  const diasSemana = useMemo(() => {
    if (modoVista !== "semanal") return [];
    const d = new Date(fechaSeleccionada + "T00:00:00");
    const dayOfWeek = d.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const lunes = new Date(d);
    lunes.setDate(d.getDate() + diffToMonday);

    const nombresDias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    return nombresDias.map((nombre, i) => {
      const curr = new Date(lunes);
      curr.setDate(lunes.getDate() + i);
      const iso = curr.toISOString().split("T")[0];
      return {
        nombre,
        fecha: iso,
        numeroDia: curr.getDate(),
        mes: curr.toLocaleString("es-CL", { month: "short" }),
      };
    });
  }, [fechaSeleccionada, modoVista]);

  return (
    <div className="max-w-[1540px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans space-y-6">
      
      {/* 1. Cabecera Institucional de Consola SOME */}
      <div className="bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#21403A] rounded-3xl p-6 shadow-md space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#CDECE5] dark:border-[#21403A] pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#A7E3D4] border border-[#A7E3D4] dark:border-[#2A534B]">
                HU-005 • Consola SOME
              </span>
              <span className="text-xs font-medium text-[#355C56] dark:text-[#9CC2BC]">
                Gestión de Bloques y Parametrización de Cuota 60+
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#132A26] dark:text-[#E8F5F2]">
              Programación y Control de Agendas Médicas
            </h1>
          </div>

          {/* Botón de Publicación Destacado */}
          <button
            type="button"
            onClick={() => abrirModalCrear()}
            className="bg-[#0F766E] hover:bg-[#115E59] text-white px-5 py-3 rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all self-start lg:self-auto flex items-center gap-2 cursor-pointer"
          >
            <PlusIcon className="w-5 h-5 stroke-[2.5]" />
            <span>Publicar Nueva Agenda</span>
          </button>
        </div>

        {/* Barra de Navegación y Filtros */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-xs">
          {/* Selector de Modo de Vista */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#F4FAF8] dark:bg-[#0B1715] p-1.5 rounded-xl border border-[#CDECE5] dark:border-[#264E46]">
            <button
              type="button"
              onClick={() => setModoVista("matriz")}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                modoVista === "matriz"
                  ? "bg-[#0F766E] text-white shadow-2xs"
                  : "text-[#355C56] dark:text-[#9CC2BC] hover:text-[#132A26] dark:hover:text-white"
              }`}
            >
              <Squares2X2Icon className="w-4 h-4" />
              <span>1. Matriz Diaria por Boxes</span>
            </button>
            <button
              type="button"
              onClick={() => setModoVista("semanal")}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                modoVista === "semanal"
                  ? "bg-[#0F766E] text-white shadow-2xs"
                  : "text-[#355C56] dark:text-[#9CC2BC] hover:text-[#132A26] dark:hover:text-white"
              }`}
            >
              <CalendarDaysIcon className="w-4 h-4" />
              <span>2. Horario Semanal (Lun - Sáb)</span>
            </button>
            <button
              type="button"
              onClick={() => setModoVista("tabla")}
              className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                modoVista === "tabla"
                  ? "bg-[#0F766E] text-white shadow-2xs"
                  : "text-[#355C56] dark:text-[#9CC2BC] hover:text-[#132A26] dark:hover:text-white"
              }`}
            >
              <TableCellsIcon className="w-4 h-4" />
              <span>3. Lista Resumen</span>
            </button>
          </div>

          {/* Controles de Navegación de Fecha */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => cambiarDia(-1)}
              className="border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-[#D9F5EF] px-3 py-2 rounded-xl font-bold hover:border-[#0F766E] transition-colors flex items-center gap-1 cursor-pointer"
              title="Día anterior"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5" />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              onClick={irAHoy}
              className="border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#0F766E] dark:text-[#A7E3D4] px-3 py-2 rounded-xl font-extrabold hover:border-[#0F766E] transition-colors cursor-pointer"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={irAMañana}
              className="border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-[#D9F5EF] px-3 py-2 rounded-xl font-bold hover:border-[#0F766E] transition-colors cursor-pointer"
            >
              Mañana
            </button>
            <button
              type="button"
              onClick={() => cambiarDia(1)}
              className="border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-[#D9F5EF] px-3 py-2 rounded-xl font-bold hover:border-[#0F766E] transition-colors flex items-center gap-1 cursor-pointer"
              title="Día siguiente"
            >
              <span>Siguiente</span>
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
            <input
              type="date"
              value={fechaSeleccionada}
              onChange={(e) => setFechaSeleccionada(e.target.value)}
              className="border-2 border-[#CDECE5] dark:border-[#264E46] bg-white dark:bg-[#0B1715] text-[#132A26] dark:text-[#E8F5F2] px-3 py-1.5 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-[#0F766E]"
            />
          </div>

          {/* Filtros de Dominio */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtroEspecialidad}
              onChange={(e) => setFiltroEspecialidad(e.target.value)}
              className="border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-[#E8F5F2] px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0F766E]"
            >
              <option value="">Todas las Especialidades</option>
              <option value="MEDICINA_GENERAL">Medicina General</option>
              <option value="DENTAL">Dental</option>
              <option value="MATRONERIA">Matronería</option>
            </select>

            <select
              value={filtroBoxId}
              onChange={(e) => setFiltroBoxId(e.target.value)}
              className="border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-[#E8F5F2] px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0F766E]"
            >
              <option value="">Todos los Boxes</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.numero}
                </option>
              ))}
            </select>

            <select
              value={filtroProfesionalId}
              onChange={(e) => setFiltroProfesionalId(e.target.value)}
              className="border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-[#E8F5F2] px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0F766E]"
            >
              <option value="">Todos los Profesionales</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombres} {p.apellidos}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Leyenda de Estados */}
        <div className="pt-3 border-t border-[#CDECE5] dark:border-[#21403A] flex flex-wrap items-center gap-4 text-xs text-[#355C56] dark:text-[#9CC2BC]">
          <span className="font-extrabold uppercase text-[#132A26] dark:text-white">Leyenda:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded border border-[#CDECE5] bg-[#F4FAF8] inline-block" />
            <span>Disponible General</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded border-2 border-amber-400 bg-amber-50 inline-block" />
            <span className="font-bold text-amber-800 dark:text-amber-300">★ Cuota 60+ (Protegido)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#0F766E] inline-block" />
            <span className="text-[#0F766E] dark:text-[#5BB9A6] font-bold">Reservado / Con Paciente</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-400 inline-block" />
            <span>Bloqueado SOME</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-100 dark:bg-slate-900 border border-dashed border-slate-400 inline-block" />
            <span>13:00 - 14:00 Pausa de Colación</span>
          </span>
        </div>
      </div>

      {/* Alertas Globales */}
      {mensajeExito && (
        <div className="flex items-center gap-2.5 bg-[#D9F5EF] dark:bg-[#1E3F3B] border border-[#5BB9A6] p-4 rounded-2xl text-xs sm:text-sm text-[#132A26] dark:text-[#E8F5F2] font-bold animate-fadeIn">
          <CheckCircleIcon className="w-5 h-5 text-[#0F766E] dark:text-[#5BB9A6] flex-shrink-0" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {alertaPausa && (
        <div className="flex items-center gap-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 p-4 rounded-2xl text-xs sm:text-sm text-amber-900 dark:text-amber-200 font-semibold animate-fadeIn">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span>{alertaPausa}</span>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL SEGÚN EL MODO DE VISTA */}
      {cargando ? (
        <div className="bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#21403A] rounded-3xl p-14 text-center text-sm text-[#355C56] dark:text-[#9CC2BC] flex flex-col items-center justify-center gap-3">
          <ArrowPathIcon className="w-8 h-8 animate-spin text-[#0F766E] dark:text-[#5BB9A6]" />
          <span className="font-bold">Cargando agendas médicas y matriz de bloques...</span>
        </div>
      ) : modoVista === "matriz" ? (
        /* ========================================================================= */
        /* PESTAÑA 1: Matriz Diaria por Boxes                                        */
        /* ========================================================================= */
        <div className="bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#21403A] rounded-3xl overflow-x-auto shadow-md">
          <div className="min-w-[920px]">
            {/* Cabecera de la Grilla: Boxes Clínicos */}
            <div
              className="grid border-b border-[#CDECE5] dark:border-[#21403A] bg-[#F4FAF8] dark:bg-[#0B1715]"
              style={{
                gridTemplateColumns: `100px repeat(${boxesFiltrados.length}, minmax(220px, 1fr))`,
              }}
            >
              <div className="p-3 font-mono text-xs font-extrabold uppercase border-r border-[#CDECE5] dark:border-[#21403A] flex items-center justify-center text-[#1E4640] dark:text-[#A7E3D4]">
                HORA
              </div>

              {boxesFiltrados.map((box) => {
                const agendaBox = agendas.find(
                  (a) => a.box_id === box.id && a.fecha === fechaSeleccionada
                );

                return (
                  <div
                    key={box.id}
                    className="p-3.5 border-r border-[#CDECE5] dark:border-[#21403A] last:border-r-0"
                  >
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <span className="font-extrabold text-sm text-[#132A26] dark:text-white">
                        {box.numero}
                      </span>
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#A7E3D4] font-bold">
                        {box.especialidad.replace("_", " ")}
                      </span>
                    </div>

                    {agendaBox ? (
                      <div className="space-y-1.5 pt-2 border-t border-[#CDECE5] dark:border-[#21403A] text-xs">
                        <div
                          className="font-bold text-[#132A26] dark:text-[#E8F5F2] truncate"
                          title={agendaBox.profesional_nombre}
                        >
                          {agendaBox.profesional_nombre}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#355C56] dark:text-[#9CC2BC]">
                          <span className="font-mono">
                            {agendaBox.hora_inicio} - {agendaBox.hora_fin}
                          </span>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                              agendaBox.activa
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {agendaBox.activa ? "ACTIVA" : "PAUSADA"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-bold pt-0.5">
                          <span className="text-[#0F766E] dark:text-[#5BB9A6]">
                            Libres: {agendaBox.estadisticas.disponibles}/{agendaBox.estadisticas.total}
                          </span>
                          {agendaBox.activa && (
                            <button
                              type="button"
                              onClick={() => setAgendaPorPausar(agendaBox)}
                              className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
                            >
                              Pausar
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 text-xs text-[#355C56] dark:text-[#9CC2BC]">
                        <span className="block mb-2 italic text-[11px]">Sin agenda asignada</span>
                        <button
                          type="button"
                          onClick={() => abrirModalCrear({ boxId: box.id, fecha: fechaSeleccionada })}
                          className="w-full text-[11px] font-bold py-1.5 rounded-xl border border-[#0F766E] dark:border-[#5BB9A6] text-[#0F766E] dark:text-[#A7E3D4] hover:bg-[#0F766E] hover:text-white transition-colors cursor-pointer"
                        >
                          + Asignar Agenda
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Filas Horarias de la Jornada */}
            <div className="divide-y divide-[#CDECE5]/60 dark:divide-[#21403A]">
              {franjasHorarias.map((hora) => {
                const esColacion = hora >= "13:00" && hora < "14:00";

                return (
                  <div
                    key={hora}
                    className="grid"
                    style={{
                      gridTemplateColumns: `100px repeat(${boxesFiltrados.length}, minmax(220px, 1fr))`,
                    }}
                  >
                    <div className="p-2 border-r border-[#CDECE5] dark:border-[#21403A] font-mono text-xs font-bold text-center bg-[#F4FAF8]/70 dark:bg-[#0B1715]/70 text-[#1E4640] dark:text-[#A7E3D4] flex items-center justify-center">
                      {hora}
                    </div>

                    {esColacion ? (
                      <div
                        className="p-2.5 bg-slate-100/80 dark:bg-[#0B1715] font-mono text-xs text-center text-slate-500 dark:text-slate-400 flex items-center justify-center italic"
                        style={{ gridColumn: `span ${boxesFiltrados.length}` }}
                      >
                        13:00 - 14:00 • Pausa de Colación — Sin Atención Médica
                      </div>
                    ) : (
                      boxesFiltrados.map((box) => {
                        const agendaBox = agendas.find(
                          (a) => a.box_id === box.id && a.fecha === fechaSeleccionada
                        );
                        const bloquesList = agendaBox?.bloques_horarios || agendaBox?.bloques || [];
                        const bloque = bloquesList.find((b) => b.hora_inicio === hora);

                        return (
                          <div
                            key={box.id}
                            className="p-1.5 border-r border-[#CDECE5]/60 dark:border-[#21403A] last:border-r-0 min-h-[52px] flex items-stretch"
                          >
                            {bloque ? (
                              <button
                                type="button"
                                onClick={() =>
                                  agendaBox && setBloqueSeleccionado({ bloque, agenda: agendaBox })
                                }
                                className={`w-full p-2 rounded-xl text-left text-xs transition-all flex flex-col justify-between cursor-pointer ${
                                  bloque.estado_bloque === "RESERVADO"
                                    ? "bg-[#0F766E] text-white shadow-xs hover:bg-[#115E59]"
                                    : bloque.estado_bloque === "BLOQUEADO_SOME"
                                    ? "bg-slate-100 dark:bg-slate-800/70 text-slate-400 line-through border border-slate-300 dark:border-slate-700"
                                    : bloque.es_cuota_adulto_mayor
                                    ? "bg-amber-50/90 dark:bg-amber-950/40 text-[#132A26] dark:text-[#E8F5F2] border-2 border-amber-400 dark:border-amber-600 hover:bg-amber-100/80 font-bold"
                                    : "bg-[#F4FAF8] dark:bg-[#152B26] text-[#132A26] dark:text-[#E8F5F2] border border-[#CDECE5] dark:border-[#2A534B] hover:border-[#0F766E]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 w-full">
                                  <span className="font-mono font-bold text-[11px]">
                                    {bloque.hora_inicio} - {bloque.hora_fin}
                                  </span>
                                  {bloque.es_cuota_adulto_mayor &&
                                    bloque.estado_bloque === "DISPONIBLE" && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-400/30 text-amber-900 dark:text-amber-200 font-extrabold">
                                        ★ 60+
                                      </span>
                                    )}
                                </div>

                                <div className="text-[10px] truncate w-full mt-0.5">
                                  {bloque.estado_bloque === "RESERVADO" ? (
                                    <span className="font-mono font-bold text-[#D9F5EF]">
                                      ✓ {bloque.cita?.codigo_reserva || "RESERVADO"}
                                    </span>
                                  ) : bloque.estado_bloque === "BLOQUEADO_SOME" ? (
                                    <span>Pausado SOME</span>
                                  ) : bloque.es_cuota_adulto_mayor ? (
                                    <span className="text-amber-800 dark:text-amber-300">
                                      Cuota Adulto Mayor
                                    </span>
                                  ) : (
                                    <span className="text-[#355C56] dark:text-[#9CC2BC]">
                                      Disponible
                                    </span>
                                  )}
                                </div>
                              </button>
                            ) : agendaBox ? (
                              <div className="w-full h-full flex items-center justify-center text-xs text-slate-300 dark:text-slate-600 font-mono">
                                —
                              </div>
                            ) : (
                              <div className="w-full h-full" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : modoVista === "semanal" ? (
        /* ========================================================================= */
        /* PESTAÑA 2: Horario Semanal (Lunes a Sábado)                               */
        /* ========================================================================= */
        <div className="bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#21403A] rounded-3xl overflow-x-auto shadow-md">
          <div className="min-w-[1000px]">
            <div className="grid grid-cols-6 border-b border-[#CDECE5] dark:border-[#21403A] bg-[#F4FAF8] dark:bg-[#0B1715]">
              {diasSemana.map((dia) => {
                const esHoy = dia.fecha === new Date().toISOString().split("T")[0];
                return (
                  <div
                    key={dia.fecha}
                    className={`p-3.5 border-r border-[#CDECE5] dark:border-[#21403A] last:border-r-0 text-center ${
                      esHoy ? "bg-[#D9F5EF]/60 dark:bg-[#1E3F3B]" : ""
                    }`}
                  >
                    <span className="block text-xs uppercase text-[#355C56] dark:text-[#9CC2BC] font-bold">
                      {dia.nombre}
                    </span>
                    <span className="text-base font-black text-[#132A26] dark:text-white">
                      {dia.numeroDia} {dia.mes}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-6 divide-x divide-[#CDECE5] dark:divide-[#21403A] min-h-[480px]">
              {diasSemana.map((dia) => {
                const agendasDelDia = agendas.filter((a) => a.fecha === dia.fecha);

                return (
                  <div key={dia.fecha} className="p-3 space-y-3 text-xs">
                    {agendasDelDia.length > 0 ? (
                      agendasDelDia.map((agenda) => (
                        <div
                          key={agenda.id}
                          className="border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] rounded-2xl p-3.5 space-y-2 hover:border-[#0F766E] transition-colors"
                        >
                          <div className="flex items-center justify-between border-b border-[#CDECE5] dark:border-[#21403A] pb-1.5">
                            <span className="font-extrabold text-xs text-[#132A26] dark:text-white">
                              {agenda.box_numero}
                            </span>
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#A7E3D4] font-bold">
                              {agenda.especialidad.replace("_", " ")}
                            </span>
                          </div>

                          <div>
                            <span className="font-bold block text-[#132A26] dark:text-[#E8F5F2] truncate">
                              {agenda.profesional_nombre}
                            </span>
                            <span className="text-[11px] font-mono text-[#355C56] dark:text-[#9CC2BC] block">
                              {agenda.hora_inicio} - {agenda.hora_fin} ({agenda.duracion_bloque_min}m)
                            </span>
                          </div>

                          <div className="pt-1.5 border-t border-[#CDECE5] dark:border-[#21403A] text-[11px] space-y-0.5">
                            <div className="flex justify-between">
                              <span className="text-[#355C56] dark:text-[#9CC2BC]">Disponibles:</span>
                              <strong className="text-[#0F766E] dark:text-[#5BB9A6]">
                                {agenda.estadisticas.disponibles}
                              </strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#355C56] dark:text-[#9CC2BC]">Reservados:</span>
                              <strong>{agenda.estadisticas.reservados}</strong>
                            </div>
                            {agenda.estadisticas.cuota_adulto_mayor > 0 && (
                              <div className="flex justify-between text-amber-800 dark:text-amber-300 font-bold">
                                <span>★ Cuota 60+:</span>
                                <span>{agenda.estadisticas.cuota_adulto_mayor}</span>
                              </div>
                            )}
                          </div>

                          <div className="pt-2 flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setFechaSeleccionada(agenda.fecha);
                                setModoVista("matriz");
                              }}
                              className="flex-1 text-[11px] font-bold py-1.5 rounded-xl bg-[#0F766E] text-white hover:bg-[#115E59] transition-colors text-center cursor-pointer"
                            >
                              Ver Matriz →
                            </button>
                            {agenda.activa && (
                              <button
                                type="button"
                                onClick={() => setAgendaPorPausar(agenda)}
                                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border border-[#CDECE5] dark:border-[#264E46] hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300 cursor-pointer"
                                title="Pausar agenda"
                              >
                                Pausar
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-10 text-center text-slate-400 border border-dashed border-[#CDECE5] dark:border-[#264E46] rounded-2xl p-4 space-y-2">
                        <span className="block text-xs italic">Sin agendas</span>
                        <button
                          type="button"
                          onClick={() => abrirModalCrear({ fecha: dia.fecha })}
                          className="text-xs font-bold px-3 py-1.5 rounded-xl border border-[#0F766E] text-[#0F766E] dark:text-[#A7E3D4] hover:bg-[#0F766E] hover:text-white transition-colors cursor-pointer"
                        >
                          + Cargar Día
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* PESTAÑA 3: Lista Resumen (Tabla)                                          */
        /* ========================================================================= */
        <div className="bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#21403A] rounded-3xl p-6 shadow-md">
          <div className="flex items-center justify-between border-b border-[#CDECE5] dark:border-[#21403A] pb-4 mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#132A26] dark:text-[#E8F5F2]">
                Lista Resumen de Agendas ({agendas.length})
              </h2>
              <p className="text-xs text-[#355C56] dark:text-[#9CC2BC]">
                Detalle tabular consolidado de jornadas y cupos clínicos.
              </p>
            </div>
            <button
              type="button"
              onClick={cargarAgendas}
              className="text-xs font-bold px-3.5 py-2 rounded-xl border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#0F766E] dark:text-[#A7E3D4] hover:bg-[#D9F5EF]/50 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span>Actualizar</span>
            </button>
          </div>

          {agendas.length === 0 ? (
            <div className="py-12 text-center text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] border border-dashed border-[#CDECE5] dark:border-[#264E46] rounded-2xl">
              No se encontraron agendas registradas con los filtros seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#CDECE5] dark:border-[#21403A] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#1E4640] dark:text-[#A7E3D4]">
                    <th className="py-3 px-4 font-bold">Fecha</th>
                    <th className="py-3 px-4 font-bold">Horario</th>
                    <th className="py-3 px-4 font-bold">Profesional / Box</th>
                    <th className="py-3 px-4 font-bold text-center">Cupos</th>
                    <th className="py-3 px-4 font-bold text-center">Estado</th>
                    <th className="py-3 px-4 font-bold text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CDECE5]/60 dark:divide-[#21403A]">
                  {agendas.map((ag) => (
                    <tr key={ag.id} className="hover:bg-[#F4FAF8]/60 dark:hover:bg-[#152B26]/60">
                      <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">{ag.fecha}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                        {ag.hora_inicio} - {ag.hora_fin}
                        <span className="block text-[11px] font-sans text-[#355C56] dark:text-[#9CC2BC]">
                          {ag.duracion_bloque_min} min/bloque
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold block text-[#132A26] dark:text-white">
                          {ag.profesional_nombre}
                        </span>
                        <span className="text-xs text-[#355C56] dark:text-[#9CC2BC] block">
                          {ag.especialidad.replace("_", " ")} • {ag.box_numero}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="font-bold text-[#0F766E] dark:text-[#5BB9A6]">
                          {ag.estadisticas.disponibles}
                        </span>
                        <span className="text-slate-400"> / {ag.estadisticas.total}</span>
                        {ag.estadisticas.cuota_adulto_mayor > 0 && (
                          <span className="block text-[11px] text-amber-800 dark:text-amber-300 font-bold">
                            ★ 60+: {ag.estadisticas.cuota_adulto_mayor}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {ag.activa ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 text-xs font-bold">
                            ACTIVA
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400 text-xs font-bold">
                            PAUSADA SOME
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {ag.activa ? (
                          <button
                            type="button"
                            onClick={() => setAgendaPorPausar(ag)}
                            className="text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-400 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                          >
                            Pausar Agenda
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Bloqueada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Detalle del Bloque Horario                                       */}
      {/* ========================================================================= */}
      {bloqueSeleccionado && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#2A534B] max-w-md w-full p-6 rounded-3xl shadow-2xl text-xs sm:text-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#CDECE5] dark:border-[#21403A] pb-3">
              <div className="flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-[#0F766E] dark:text-[#5BB9A6]" />
                <span className="font-extrabold text-base text-[#132A26] dark:text-white">
                  Detalle del Bloque Horario
                </span>
              </div>
              <button
                type="button"
                onClick={() => setBloqueSeleccionado(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#17302B] text-slate-500 cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 border-b border-[#CDECE5] dark:border-[#21403A] pb-3">
              <div className="flex justify-between">
                <span className="text-[#355C56] dark:text-[#9CC2BC]">Horario:</span>
                <strong className="font-mono text-[#132A26] dark:text-white">
                  {bloqueSeleccionado.bloque.hora_inicio} a {bloqueSeleccionado.bloque.hora_fin} hrs
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#355C56] dark:text-[#9CC2BC]">Fecha:</span>
                <strong className="font-mono">{bloqueSeleccionado.agenda.fecha}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#355C56] dark:text-[#9CC2BC]">Box Clínico:</span>
                <strong>{bloqueSeleccionado.agenda.box_numero}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#355C56] dark:text-[#9CC2BC]">Profesional:</span>
                <strong>{bloqueSeleccionado.agenda.profesional_nombre}</strong>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-[#355C56] dark:text-[#9CC2BC]">Estado:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#A7E3D4] font-bold text-xs">
                  {bloqueSeleccionado.bloque.estado_bloque}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#355C56] dark:text-[#9CC2BC]">Cuota Adulto Mayor:</span>
                <strong className={bloqueSeleccionado.bloque.es_cuota_adulto_mayor ? "text-amber-700 dark:text-amber-300" : ""}>
                  {bloqueSeleccionado.bloque.es_cuota_adulto_mayor ? "★ Sí (Protegido 60+)" : "No (Cupo General)"}
                </strong>
              </div>
            </div>

            {bloqueSeleccionado.bloque.cita ? (
              <div className="bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#264E46] rounded-2xl p-4 space-y-1.5">
                <span className="font-extrabold block text-xs uppercase text-[#0F766E] dark:text-[#A7E3D4] pb-1">
                  Datos de la Reserva Activa
                </span>
                <div className="flex justify-between">
                  <span className="text-[#355C56] dark:text-[#9CC2BC]">Código:</span>
                  <strong className="font-mono text-[#0F766E] dark:text-[#5BB9A6]">
                    {bloqueSeleccionado.bloque.cita.codigo_reserva}
                  </strong>
                </div>
                {bloqueSeleccionado.bloque.cita.paciente && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[#355C56] dark:text-[#9CC2BC]">Paciente:</span>
                      <strong>{bloqueSeleccionado.bloque.cita.paciente.nombre_completo}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#355C56] dark:text-[#9CC2BC]">RUT:</span>
                      <strong className="font-mono">{bloqueSeleccionado.bloque.cita.paciente.rut_formateado}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#355C56] dark:text-[#9CC2BC]">Teléfono:</span>
                      <span className="font-mono">{bloqueSeleccionado.bloque.cita.paciente.telefono}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-[#355C56] dark:text-[#9CC2BC] italic text-xs text-center py-2">
                Este bloque horario se encuentra libre sin citas asociadas.
              </div>
            )}

            <button
              type="button"
              onClick={() => setBloqueSeleccionado(null)}
              className="w-full bg-[#0F766E] hover:bg-[#115E59] text-white py-3 rounded-xl font-bold transition-colors cursor-pointer"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Confirmación para Pausar Agenda                                  */}
      {/* ========================================================================= */}
      {agendaPorPausar && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#2A534B] max-w-md w-full p-6 rounded-3xl shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 flex items-center justify-center flex-shrink-0">
                <PauseCircleIcon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Contingencia Operativa SOME
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-[#132A26] dark:text-[#E8F5F2]">
                  ¿Pausar agenda médica?
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] leading-relaxed">
              Se bloquearán temporalmente los cupos libres de{" "}
              <strong className="text-[#132A26] dark:text-white">{agendaPorPausar.profesional_nombre}</strong> en el{" "}
              <strong>{agendaPorPausar.box_numero}</strong> ({agendaPorPausar.fecha}).
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={confirmarPausaAgenda}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
              >
                Confirmar Pausa de Agenda
              </button>
              <button
                type="button"
                onClick={() => setAgendaPorPausar(null)}
                className="px-4 py-3 rounded-xl border border-[#CDECE5] dark:border-[#264E46] text-xs sm:text-sm font-bold text-[#132A26] dark:text-[#D9F5EF] hover:bg-slate-100 dark:hover:bg-[#17302B] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Publicar Nueva Agenda Médica                                     */}
      {/* ========================================================================= */}
      {modalCrearAbierto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#2A534B] max-w-lg w-full p-6 sm:p-7 rounded-3xl shadow-2xl text-xs sm:text-sm space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#CDECE5] dark:border-[#21403A] pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#A7E3D4] inline-block mb-1">
                  Apertura de Agenda • HU-005
                </span>
                <h3 className="text-lg font-extrabold text-[#132A26] dark:text-white">
                  Publicar Nueva Agenda Médica
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalCrearAbierto(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#17302B] text-slate-500 cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {errorModal && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 p-3.5 rounded-2xl text-xs text-red-800 dark:text-red-200 font-semibold">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleCrearAgendaSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">
                  Profesional de Salud
                </label>
                <select
                  value={nuevoProfId}
                  onChange={(e) => handleModalProfChange(e.target.value)}
                  className="w-full border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#0F766E]"
                  required
                >
                  {profesionales.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombres} {p.apellidos} ({p.especialidad.replace("_", " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">
                    Especialidad
                  </label>
                  <input
                    type="text"
                    value={nuevaEsp.replace("_", " ")}
                    readOnly
                    className="w-full border border-[#CDECE5] dark:border-[#264E46] px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/70 font-bold text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">
                    Box Clínico
                  </label>
                  <select
                    value={nuevoBoxId}
                    onChange={(e) => setNuevoBoxId(e.target.value)}
                    className="w-full border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#0F766E]"
                    required
                  >
                    {boxes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.numero}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">
                  Fecha de la Agenda
                </label>
                <input
                  type="date"
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  className="w-full border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-[#0F766E]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">
                    Hora Inicio
                  </label>
                  <input
                    type="time"
                    value={nuevaHoraInicio}
                    onChange={(e) => setNuevaHoraInicio(e.target.value)}
                    className="w-full border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-[#0F766E]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">
                    Hora Fin
                  </label>
                  <input
                    type="time"
                    value={nuevaHoraFin}
                    onChange={(e) => setNuevaHoraFin(e.target.value)}
                    className="w-full border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-[#0F766E]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">
                    Duración por Bloque
                  </label>
                  <select
                    value={nuevaDuracionMin}
                    onChange={(e) => setNuevaDuracionMin(Number(e.target.value))}
                    className="w-full border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#0F766E]"
                  >
                    <option value={15}>15 minutos</option>
                    <option value={20}>20 minutos (Estándar)</option>
                    <option value={30}>30 minutos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">
                    % Cuota Adulto Mayor (60+)
                  </label>
                  <select
                    value={nuevoPorcentajeCuota}
                    disabled={nuevaEsp !== "MEDICINA_GENERAL"}
                    onChange={(e) => setNuevoPorcentajeCuota(Number(e.target.value))}
                    className="w-full border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none disabled:opacity-50"
                  >
                    <option value={20}>20%</option>
                    <option value={30}>30% (Normativa Legal)</option>
                    <option value={40}>40%</option>
                    <option value={50}>50%</option>
                  </select>
                </div>
              </div>

              {/* Previsualizador */}
              <div className="bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#264E46] rounded-2xl p-4 space-y-1.5 text-xs">
                <div className="font-extrabold uppercase text-[#0F766E] dark:text-[#A7E3D4] pb-1">
                  Previsualizador Automático de Bloques:
                </div>
                <div className="flex justify-between">
                  <span className="text-[#355C56] dark:text-[#9CC2BC]">Bloques hábiles a crear:</span>
                  <strong className="text-[#132A26] dark:text-white">{previsualizacionModal.total} cupos</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#355C56] dark:text-[#9CC2BC]">Pausa colación 13:00-14:00 (Omitida):</span>
                  <span>{previsualizacionModal.colacionOmitida} bloques</span>
                </div>
                {nuevaEsp === "MEDICINA_GENERAL" ? (
                  <div className="flex justify-between pt-1.5 border-t border-[#CDECE5] dark:border-[#21403A] text-amber-800 dark:text-amber-300 font-bold">
                    <span>★ Cuota protegida Adulto Mayor:</span>
                    <span>
                      {previsualizacionModal.cuota} cupos ({nuevoPorcentajeCuota}%)
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 italic">
                    * La cuota protegida 60+ aplica exclusivamente a Medicina General.
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={guardandoAgenda || previsualizacionModal.total === 0}
                  className="flex-1 bg-[#0F766E] hover:bg-[#115E59] text-white py-3 rounded-xl font-bold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {guardandoAgenda ? "Publicando Agenda..." : "Publicar Agenda Médica →"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalCrearAbierto(false)}
                  className="px-4 py-3 rounded-xl border border-[#CDECE5] dark:border-[#264E46] font-bold hover:bg-slate-100 dark:hover:bg-[#17302B] cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
