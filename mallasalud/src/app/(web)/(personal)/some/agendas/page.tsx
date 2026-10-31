"use client";

import { useState, useEffect, useMemo, useCallback, type CSSProperties } from "react";
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
import "./agendas.css";

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
      if (profesionales.length > 0) {
        const primerProf = profesionales[0];
        setNuevoProfId(primerProf.id);
        setNuevaEsp(primerProf.especialidad);
        const boxCompatible = boxes.find((b) => b.especialidad === primerProf.especialidad);
        if (boxCompatible) {
          setNuevoBoxId(boxCompatible.id);
        } else if (boxes.length > 0) {
          setNuevoBoxId(boxes[0].id);
        }
      } else if (boxes.length > 0) {
        setNuevoBoxId(boxes[0].id);
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

  const matrixGridVars = {
    "--matrix-cols": Math.max(1, boxesFiltrados.length),
  } as CSSProperties;

  const getSlotBtnClass = (bloque: BloqueDetalle) => {
    if (bloque.estado_bloque === "RESERVADO") return "agendas-slot-btn-reserved";
    if (bloque.estado_bloque === "BLOQUEADO_SOME") return "agendas-slot-btn-blocked";
    if (bloque.es_cuota_adulto_mayor) return "agendas-slot-btn-senior";
    return "agendas-slot-btn-available";
  };

  return (
    <div className="agendas-page">
      
      {/* 1. Cabecera Institucional de Consola SOME */}
      <div className="agendas-header-card">
        <div className="agendas-header-top">
          <div>
            <div className="agendas-badge-row">
              <span className="agendas-hu-badge">
                HU-005 • Consola SOME
              </span>
              <span className="agendas-hu-subtitle">
                Gestión de Bloques y Parametrización de Cuota 60+
              </span>
            </div>
            <h1 className="agendas-title">
              Programación y Control de Agendas Médicas
            </h1>
          </div>

          {/* Botón de Publicación Destacado */}
          <button
            type="button"
            onClick={() => abrirModalCrear()}
            className="agendas-btn-create"
          >
            <PlusIcon className="agendas-icon-plus" />
            <span>Publicar Nueva Agenda</span>
          </button>
        </div>

        {/* Barra de Navegación y Filtros */}
        <div className="agendas-toolbar">
          {/* Selector de Modo de Vista */}
          <div className="agendas-view-switcher">
            <button
              type="button"
              onClick={() => setModoVista("matriz")}
              className={modoVista === "matriz" ? "agendas-view-btn-active" : "agendas-view-btn"}
            >
              <Squares2X2Icon className="agendas-icon-sm" />
              <span>1. Matriz Diaria por Boxes</span>
            </button>
            <button
              type="button"
              onClick={() => setModoVista("semanal")}
              className={modoVista === "semanal" ? "agendas-view-btn-active" : "agendas-view-btn"}
            >
              <CalendarDaysIcon className="agendas-icon-sm" />
              <span>2. Horario Semanal (Lun - Sáb)</span>
            </button>
            <button
              type="button"
              onClick={() => setModoVista("tabla")}
              className={modoVista === "tabla" ? "agendas-view-btn-active" : "agendas-view-btn"}
            >
              <TableCellsIcon className="agendas-icon-sm" />
              <span>3. Lista Resumen</span>
            </button>
          </div>

          {/* Controles de Navegación de Fecha */}
          <div className="agendas-date-nav">
            <button
              type="button"
              onClick={() => cambiarDia(-1)}
              className="agendas-date-btn"
              title="Día anterior"
            >
              <ChevronLeftIcon className="agendas-icon-xs" />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              onClick={irAHoy}
              className="agendas-date-btn-today"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={irAMañana}
              className="agendas-date-btn"
            >
              Mañana
            </button>
            <button
              type="button"
              onClick={() => cambiarDia(1)}
              className="agendas-date-btn"
              title="Día siguiente"
            >
              <span>Siguiente</span>
              <ChevronRightIcon className="agendas-icon-xs" />
            </button>
            <input
              type="date"
              value={fechaSeleccionada}
              onChange={(e) => setFechaSeleccionada(e.target.value)}
              className="agendas-date-input"
            />
          </div>

          {/* Filtros de Dominio */}
          <div className="agendas-filters">
            <select
              value={filtroEspecialidad}
              onChange={(e) => setFiltroEspecialidad(e.target.value)}
              className="agendas-filter-select"
            >
              <option value="">Todas las Especialidades</option>
              <option value="MEDICINA_GENERAL">Medicina General</option>
              <option value="DENTAL">Dental</option>
              <option value="MATRONERIA">Matronería</option>
            </select>

            <select
              value={filtroBoxId}
              onChange={(e) => setFiltroBoxId(e.target.value)}
              className="agendas-filter-select"
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
              className="agendas-filter-select"
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
        <div className="agendas-legend">
          <span className="agendas-legend-title">Leyenda:</span>
          <span className="agendas-legend-item">
            <span className="agendas-swatch-general" />
            <span>Disponible General</span>
          </span>
          <span className="agendas-legend-item">
            <span className="agendas-swatch-senior" />
            <span className="agendas-legend-text-senior">★ Cuota 60+ (Intercalada · se libera 30 min antes)</span>
          </span>
          <span className="agendas-legend-item">
            <span className="agendas-swatch-reserved" />
            <span className="agendas-legend-text-reserved">Reservado / Con Paciente</span>
          </span>
          <span className="agendas-legend-item">
            <span className="agendas-swatch-blocked" />
            <span>Bloqueado SOME</span>
          </span>
          <span className="agendas-legend-item">
            <span className="agendas-swatch-colacion" />
            <span>13:00 - 14:00 Pausa de Colación</span>
          </span>
        </div>
      </div>

      {/* Alertas Globales */}
      {mensajeExito && (
        <div className="agendas-alert-success">
          <CheckCircleIcon className="agendas-alert-success-icon" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {alertaPausa && (
        <div className="agendas-alert-warning">
          <ExclamationTriangleIcon className="agendas-alert-warning-icon" />
          <span>{alertaPausa}</span>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL SEGÚN EL MODO DE VISTA */}
      {cargando ? (
        <div className="agendas-loading-card">
          <ArrowPathIcon className="agendas-loading-spinner" />
          <span className="agendas-loading-text">Cargando agendas médicas y matriz de bloques...</span>
        </div>
      ) : modoVista === "matriz" ? (
        <>
          {/* ========================================================================= */}
          {/* PESTAÑA 1 (MÓVIL / TABLET < lg): Tarjetas Responsivas por Box y Cupos     */}
          {/* ========================================================================= */}
          <div className="agendas-mobile-boxes-list">
            {boxesFiltrados.map((box) => {
              const agendaBox = agendas.find(
                (a) => a.box_id === box.id && a.fecha === fechaSeleccionada
              );
              const bloquesList = agendaBox?.bloques_horarios || agendaBox?.bloques || [];

              return (
                <div key={box.id} className="agendas-mobile-box-card">
                  <div className="agendas-mobile-box-header">
                    <div className="agendas-mobile-box-title-wrap">
                      <span className="agendas-matrix-box-num">{box.numero}</span>
                      <span className="agendas-matrix-box-esp">
                        {box.especialidad.replace("_", " ")}
                      </span>
                    </div>

                    {agendaBox && (
                      <span
                        className={
                          agendaBox.activa
                            ? "agendas-status-badge-active"
                            : "agendas-status-badge-paused"
                        }
                      >
                        {agendaBox.activa ? "ACTIVA" : "PAUSADA"}
                      </span>
                    )}
                  </div>

                  {agendaBox ? (
                    <>
                      <div className="agendas-mobile-box-info">
                        <div>
                          <div className="agendas-matrix-prof-name">
                            {agendaBox.profesional_nombre}
                          </div>
                          <span className="agendas-matrix-time-range">
                            Jornada: {agendaBox.hora_inicio} - {agendaBox.hora_fin} hrs
                          </span>
                        </div>
                        <div className="agendas-matrix-stats-row">
                          <span className="agendas-matrix-free-count">
                            Libres: {agendaBox.estadisticas.disponibles}/{agendaBox.estadisticas.total}
                          </span>
                          {agendaBox.activa && (
                            <button
                              type="button"
                              onClick={() => setAgendaPorPausar(agendaBox)}
                              className="agendas-weekly-btn-pause"
                            >
                              Pausar Agenda
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="agendas-mobile-slots-grid">
                        {bloquesList.map((bloque) => (
                          <button
                            key={bloque.id}
                            type="button"
                            onClick={() =>
                              setBloqueSeleccionado({ bloque, agenda: agendaBox })
                            }
                            className={getSlotBtnClass(bloque)}
                          >
                            <div className="agendas-slot-top">
                              <span className="agendas-slot-time">
                                {bloque.hora_inicio}
                              </span>
                              {bloque.es_cuota_adulto_mayor &&
                                bloque.estado_bloque === "DISPONIBLE" && (
                                  <span className="agendas-slot-senior-tag">
                                    ★ 60+
                                  </span>
                                )}
                            </div>
                            <div className="agendas-slot-bottom">
                              {bloque.estado_bloque === "RESERVADO" ? (
                                <span className="agendas-slot-code-reserved">
                                  ✓ {bloque.cita?.codigo_reserva || "RESERVADO"}
                                </span>
                              ) : bloque.estado_bloque === "BLOQUEADO_SOME" ? (
                                <span>Pausado SOME</span>
                              ) : bloque.es_cuota_adulto_mayor ? (
                                <span className="agendas-slot-label-senior">
                                  Cuota 60+
                                </span>
                              ) : (
                                <span className="agendas-slot-label-available">
                                  Disponible
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                        <div className="agendas-mobile-colacion-banner">
                          13:00 - 14:00 • Pausa de Colación — Sin Atención Médica
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="agendas-mobile-empty-box">
                      <span className="agendas-matrix-empty-label">
                        Sin agenda asignada para el {fechaSeleccionada}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          abrirModalCrear({ boxId: box.id, fecha: fechaSeleccionada })
                        }
                        className="agendas-matrix-assign-btn"
                      >
                        + Asignar Agenda en {box.numero}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* PESTAÑA 1 (ESCRITORIO >= lg): Matriz Diaria por Boxes                     */}
          {/* ========================================================================= */}
          <div className="agendas-matrix-card">
            <div className="agendas-matrix-inner" style={matrixGridVars}>
              {/* Cabecera de la Grilla: Boxes Clínicos */}
              <div className="agendas-matrix-header-grid">
                <div className="agendas-matrix-corner">
                  HORA
                </div>

                {boxesFiltrados.map((box) => {
                  const agendaBox = agendas.find(
                    (a) => a.box_id === box.id && a.fecha === fechaSeleccionada
                  );

                  return (
                    <div
                      key={box.id}
                      className="agendas-matrix-box-header"
                    >
                      <div className="agendas-matrix-box-top">
                        <span className="agendas-matrix-box-num">
                          {box.numero}
                        </span>
                        <span className="agendas-matrix-box-esp">
                          {box.especialidad.replace("_", " ")}
                        </span>
                      </div>

                      {agendaBox ? (
                        <div className="agendas-matrix-box-details">
                          <div
                            className="agendas-matrix-prof-name"
                            title={agendaBox.profesional_nombre}
                          >
                            {agendaBox.profesional_nombre}
                          </div>
                          <div className="agendas-matrix-meta-row">
                            <span className="agendas-matrix-time-range">
                              {agendaBox.hora_inicio} - {agendaBox.hora_fin}
                            </span>
                            <span
                              className={
                                agendaBox.activa
                                  ? "agendas-status-badge-active"
                                  : "agendas-status-badge-paused"
                              }
                            >
                              {agendaBox.activa ? "ACTIVA" : "PAUSADA"}
                            </span>
                          </div>
                          <div className="agendas-matrix-stats-row">
                            <span className="agendas-matrix-free-count">
                              Libres: {agendaBox.estadisticas.disponibles}/{agendaBox.estadisticas.total}
                            </span>
                            {agendaBox.activa && (
                              <button
                                type="button"
                                onClick={() => setAgendaPorPausar(agendaBox)}
                                className="agendas-matrix-pause-link"
                              >
                                Pausar
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="agendas-matrix-empty-box">
                          <span className="agendas-matrix-empty-label">Sin agenda asignada</span>
                          <button
                            type="button"
                            onClick={() => abrirModalCrear({ boxId: box.id, fecha: fechaSeleccionada })}
                            className="agendas-matrix-assign-btn"
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
              <div className="agendas-matrix-body">
                {franjasHorarias.map((hora) => {
                  const esColacion = hora >= "13:00" && hora < "14:00";

                  return (
                    <div
                      key={hora}
                      className="agendas-matrix-row-grid"
                    >
                      <div className="agendas-matrix-hour-cell">
                        {hora}
                      </div>

                      {esColacion ? (
                        <div className="agendas-matrix-colacion-cell">
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
                              className="agendas-matrix-slot-cell"
                            >
                              {bloque ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    agendaBox && setBloqueSeleccionado({ bloque, agenda: agendaBox })
                                  }
                                  className={getSlotBtnClass(bloque)}
                                >
                                  <div className="agendas-slot-top">
                                    <span className="agendas-slot-time">
                                      {bloque.hora_inicio} - {bloque.hora_fin}
                                    </span>
                                    {bloque.es_cuota_adulto_mayor &&
                                      bloque.estado_bloque === "DISPONIBLE" && (
                                        <span className="agendas-slot-senior-tag">
                                          ★ 60+
                                        </span>
                                      )}
                                  </div>

                                  <div className="agendas-slot-bottom">
                                    {bloque.estado_bloque === "RESERVADO" ? (
                                      <span className="agendas-slot-code-reserved">
                                        ✓ {bloque.cita?.codigo_reserva || "RESERVADO"}
                                      </span>
                                    ) : bloque.estado_bloque === "BLOQUEADO_SOME" ? (
                                      <span>Pausado SOME</span>
                                    ) : bloque.es_cuota_adulto_mayor ? (
                                      <span className="agendas-slot-label-senior">
                                        Cuota Adulto Mayor
                                      </span>
                                    ) : (
                                      <span className="agendas-slot-label-available">
                                        Disponible
                                      </span>
                                    )}
                                  </div>
                                </button>
                              ) : agendaBox ? (
                                <div className="agendas-slot-dash">
                                  —
                                </div>
                              ) : (
                                <div className="agendas-slot-blank" />
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
        </>
      ) : modoVista === "semanal" ? (
        /* ========================================================================= */
        /* PESTAÑA 2: Horario Semanal Responsivo (Lunes a Sábado)                    */
        /* ========================================================================= */
        <div className="agendas-weekly-card">
          <div className="agendas-weekly-responsive-grid">
            {diasSemana.map((dia) => {
              const esHoy = dia.fecha === new Date().toISOString().split("T")[0];
              const agendasDelDia = agendas.filter((a) => a.fecha === dia.fecha);

              return (
                <div key={dia.fecha} className="agendas-weekly-day-col">
                  <div
                    className={
                      esHoy
                        ? "agendas-weekly-day-header-today"
                        : "agendas-weekly-day-header"
                    }
                  >
                    <span className="agendas-weekly-day-name">
                      {dia.nombre}
                    </span>
                    <span className="agendas-weekly-day-date">
                      {dia.numeroDia} {dia.mes}
                    </span>
                  </div>

                  <div className="agendas-weekly-col">
                    {agendasDelDia.length > 0 ? (
                      agendasDelDia.map((agenda) => (
                        <div
                          key={agenda.id}
                          className="agendas-weekly-item"
                        >
                          <div className="agendas-weekly-item-top">
                            <span className="agendas-weekly-item-box">
                              {agenda.box_numero}
                            </span>
                            <span className="agendas-weekly-item-esp">
                              {agenda.especialidad.replace("_", " ")}
                            </span>
                          </div>

                          <div>
                            <span className="agendas-weekly-item-prof">
                              {agenda.profesional_nombre}
                            </span>
                            <span className="agendas-weekly-item-hours">
                              {agenda.hora_inicio} - {agenda.hora_fin} ({agenda.duracion_bloque_min}m)
                            </span>
                          </div>

                          <div className="agendas-weekly-item-stats">
                            <div className="agendas-weekly-stat-row">
                              <span className="agendas-weekly-stat-label">Disponibles:</span>
                              <strong className="agendas-weekly-stat-free">
                                {agenda.estadisticas.disponibles}
                              </strong>
                            </div>
                            <div className="agendas-weekly-stat-row">
                              <span className="agendas-weekly-stat-label">Reservados:</span>
                              <strong>{agenda.estadisticas.reservados}</strong>
                            </div>
                            {agenda.estadisticas.cuota_adulto_mayor > 0 && (
                              <div className="agendas-weekly-stat-senior">
                                <span>★ Cuota 60+:</span>
                                <span>{agenda.estadisticas.cuota_adulto_mayor}</span>
                              </div>
                            )}
                          </div>

                          <div className="agendas-weekly-item-actions">
                            <button
                              type="button"
                              onClick={() => {
                                setFechaSeleccionada(agenda.fecha);
                                setModoVista("matriz");
                              }}
                              className="agendas-weekly-btn-matrix"
                            >
                              Ver Matriz →
                            </button>
                            {agenda.activa && (
                              <button
                                type="button"
                                onClick={() => setAgendaPorPausar(agenda)}
                                className="agendas-weekly-btn-pause"
                                title="Pausar agenda"
                              >
                                Pausar
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="agendas-weekly-empty">
                        <span className="agendas-weekly-empty-text">Sin agendas</span>
                        <button
                          type="button"
                          onClick={() => abrirModalCrear({ fecha: dia.fecha })}
                          className="agendas-weekly-empty-btn"
                        >
                          + Cargar Día
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* PESTAÑA 3: Lista Resumen (Tarjetas en móvil + Tabla en md+)               */
        /* ========================================================================= */
        <div className="agendas-table-card">
          <div className="agendas-table-header">
            <div>
              <h2 className="agendas-table-title">
                Lista Resumen de Agendas ({agendas.length})
              </h2>
              <p className="agendas-table-subtitle">
                Detalle tabular consolidado de jornadas y cupos clínicos.
              </p>
            </div>
            <button
              type="button"
              onClick={cargarAgendas}
              className="agendas-btn-refresh"
            >
              <ArrowPathIcon className="agendas-icon-sm" />
              <span>Actualizar</span>
            </button>
          </div>

          {agendas.length === 0 ? (
            <div className="agendas-table-empty">
              No se encontraron agendas registradas con los filtros seleccionados.
            </div>
          ) : (
            <>
              {/* Tarjetas Responsivas en Móvil (< md) */}
              <div className="agendas-mobile-summary-list">
                {agendas.map((ag) => (
                  <div key={ag.id} className="agendas-mobile-summary-card">
                    <div className="agendas-mobile-summary-top">
                      <div>
                        <span className="agendas-td-prof-name">
                          {ag.profesional_nombre}
                        </span>
                        <span className="agendas-td-prof-sub">
                          {ag.especialidad.replace("_", " ")} • {ag.box_numero}
                        </span>
                      </div>
                      {ag.activa ? (
                        <span className="agendas-pill-active">ACTIVA</span>
                      ) : (
                        <span className="agendas-pill-paused">PAUSADA</span>
                      )}
                    </div>

                    <div className="agendas-mobile-summary-grid">
                      <div>
                        <span className="agendas-modal-label">Fecha:</span>
                        <strong className="agendas-td-prof-name">{ag.fecha}</strong>
                      </div>
                      <div>
                        <span className="agendas-modal-label">Horario:</span>
                        <strong className="agendas-td-prof-name">
                          {ag.hora_inicio} - {ag.hora_fin} ({ag.duracion_bloque_min}m)
                        </strong>
                      </div>
                      <div>
                        <span className="agendas-modal-label">Disponibles:</span>
                        <div>
                          <span className="agendas-td-free">
                            {ag.estadisticas.disponibles}
                          </span>
                          <span className="agendas-td-total"> / {ag.estadisticas.total}</span>
                        </div>
                      </div>
                      <div>
                        <span className="agendas-modal-label">Cuota 60+:</span>
                        <span className="agendas-td-senior">
                          ★ {ag.estadisticas.cuota_adulto_mayor} cupos
                        </span>
                      </div>
                    </div>

                    {ag.activa && (
                      <button
                        type="button"
                        onClick={() => setAgendaPorPausar(ag)}
                        className="agendas-matrix-assign-btn"
                      >
                        Pausar Agenda
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Tabla en Tablet y Escritorio (>= md) */}
              <div className="agendas-table-wrap">
                <table className="agendas-table">
                  <thead>
                    <tr className="agendas-thead-row">
                      <th className="agendas-th">Fecha</th>
                      <th className="agendas-th">Horario</th>
                      <th className="agendas-th">Profesional / Box</th>
                      <th className="agendas-th-center">Cupos</th>
                      <th className="agendas-th-center">Estado</th>
                      <th className="agendas-th-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="agendas-tbody">
                    {agendas.map((ag) => (
                      <tr key={ag.id} className="agendas-tr">
                        <td className="agendas-td-date">{ag.fecha}</td>
                        <td className="agendas-td-time">
                          {ag.hora_inicio} - {ag.hora_fin}
                          <span className="agendas-td-duration">
                            {ag.duracion_bloque_min} min/bloque
                          </span>
                        </td>
                        <td className="agendas-td-prof">
                          <span className="agendas-td-prof-name">
                            {ag.profesional_nombre}
                          </span>
                          <span className="agendas-td-prof-sub">
                            {ag.especialidad.replace("_", " ")} • {ag.box_numero}
                          </span>
                        </td>
                        <td className="agendas-td-center">
                          <span className="agendas-td-free">
                            {ag.estadisticas.disponibles}
                          </span>
                          <span className="agendas-td-total"> / {ag.estadisticas.total}</span>
                          {ag.estadisticas.cuota_adulto_mayor > 0 && (
                            <span className="agendas-td-senior">
                              ★ 60+: {ag.estadisticas.cuota_adulto_mayor}
                            </span>
                          )}
                        </td>
                        <td className="agendas-td-center">
                          {ag.activa ? (
                            <span className="agendas-pill-active">
                              ACTIVA
                            </span>
                          ) : (
                            <span className="agendas-pill-paused">
                              PAUSADA SOME
                            </span>
                          )}
                        </td>
                        <td className="agendas-td-right">
                          {ag.activa ? (
                            <button
                              type="button"
                              onClick={() => setAgendaPorPausar(ag)}
                              className="agendas-btn-pause-row"
                            >
                              Pausar Agenda
                            </button>
                          ) : (
                            <span className="agendas-text-blocked">Bloqueada</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Detalle del Bloque Horario                                       */}
      {/* ========================================================================= */}
      {bloqueSeleccionado && (
        <div className="agendas-modal-backdrop">
          <div className="agendas-modal-box">
            <div className="agendas-modal-header">
              <div className="agendas-modal-title-group">
                <ClockIcon className="agendas-modal-title-icon" />
                <span className="agendas-modal-title">
                  Detalle del Bloque Horario
                </span>
              </div>
              <button
                type="button"
                onClick={() => setBloqueSeleccionado(null)}
                className="agendas-modal-close-btn"
              >
                <XMarkIcon className="agendas-icon-md" />
              </button>
            </div>

            <div className="agendas-modal-details">
              <div className="agendas-modal-row">
                <span className="agendas-modal-label">Horario:</span>
                <strong className="agendas-modal-val-mono">
                  {bloqueSeleccionado.bloque.hora_inicio} a {bloqueSeleccionado.bloque.hora_fin} hrs
                </strong>
              </div>
              <div className="agendas-modal-row">
                <span className="agendas-modal-label">Fecha:</span>
                <strong className="agendas-modal-val-mono">{bloqueSeleccionado.agenda.fecha}</strong>
              </div>
              <div className="agendas-modal-row">
                <span className="agendas-modal-label">Box Clínico:</span>
                <strong>{bloqueSeleccionado.agenda.box_numero}</strong>
              </div>
              <div className="agendas-modal-row">
                <span className="agendas-modal-label">Profesional:</span>
                <strong>{bloqueSeleccionado.agenda.profesional_nombre}</strong>
              </div>
              <div className="agendas-modal-row-center">
                <span className="agendas-modal-label">Estado:</span>
                <span className="agendas-modal-status-pill">
                  {bloqueSeleccionado.bloque.estado_bloque}
                </span>
              </div>
              <div className="agendas-modal-row">
                <span className="agendas-modal-label">Cuota Adulto Mayor:</span>
                <strong className={bloqueSeleccionado.bloque.es_cuota_adulto_mayor ? "agendas-modal-senior-yes" : ""}>
                  {bloqueSeleccionado.bloque.es_cuota_adulto_mayor ? "★ Sí (Protegido 60+)" : "No (Cupo General)"}
                </strong>
              </div>
            </div>

            {bloqueSeleccionado.bloque.cita ? (
              <div className="agendas-modal-cita-card">
                <span className="agendas-modal-cita-title">
                  Datos de la Reserva Activa
                </span>
                <div className="agendas-modal-row">
                  <span className="agendas-modal-label">Código:</span>
                  <strong className="agendas-modal-val-code">
                    {bloqueSeleccionado.bloque.cita.codigo_reserva}
                  </strong>
                </div>
                {bloqueSeleccionado.bloque.cita.paciente && (
                  <>
                    <div className="agendas-modal-row">
                      <span className="agendas-modal-label">Paciente:</span>
                      <strong>{bloqueSeleccionado.bloque.cita.paciente.nombre_completo}</strong>
                    </div>
                    <div className="agendas-modal-row">
                      <span className="agendas-modal-label">RUT:</span>
                      <strong className="agendas-modal-val-mono">{bloqueSeleccionado.bloque.cita.paciente.rut_formateado}</strong>
                    </div>
                    <div className="agendas-modal-row">
                      <span className="agendas-modal-label">Teléfono:</span>
                      <span className="agendas-modal-val-mono">{bloqueSeleccionado.bloque.cita.paciente.telefono}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="agendas-modal-empty-note">
                Este bloque horario se encuentra libre sin citas asociadas.
              </div>
            )}

            <button
              type="button"
              onClick={() => setBloqueSeleccionado(null)}
              className="agendas-modal-btn-primary"
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
        <div className="agendas-modal-backdrop">
          <div className="agendas-modal-box">
            <div className="agendas-modal-warn-header">
              <div className="agendas-modal-warn-icon-box">
                <PauseCircleIcon className="agendas-modal-warn-icon" />
              </div>
              <div>
                <span className="agendas-modal-warn-tag">
                  Contingencia Operativa SOME
                </span>
                <h3 className="agendas-modal-title">
                  ¿Pausar agenda médica?
                </h3>
              </div>
            </div>

            <p className="agendas-modal-warn-text">
              Se bloquearán temporalmente los cupos libres de{" "}
              <strong className="agendas-modal-warn-strong">{agendaPorPausar.profesional_nombre}</strong> en el{" "}
              <strong>{agendaPorPausar.box_numero}</strong> ({agendaPorPausar.fecha}).
            </p>

            <div className="agendas-modal-actions">
              <button
                type="button"
                onClick={confirmarPausaAgenda}
                className="agendas-modal-btn-amber"
              >
                Confirmar Pausa de Agenda
              </button>
              <button
                type="button"
                onClick={() => setAgendaPorPausar(null)}
                className="agendas-modal-btn-cancel"
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
        <div className="agendas-modal-backdrop">
          <div className="agendas-modal-box-lg">
            <div className="agendas-modal-header">
              <div>
                <span className="agendas-modal-tag-pill">
                  Apertura de Agenda • HU-005
                </span>
                <h3 className="agendas-modal-title-lg">
                  Publicar Nueva Agenda Médica
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalCrearAbierto(false)}
                className="agendas-modal-close-btn"
              >
                <XMarkIcon className="agendas-icon-md" />
              </button>
            </div>

            {errorModal && (
              <div className="agendas-modal-error">
                {errorModal}
              </div>
            )}

            <form onSubmit={handleCrearAgendaSubmit} className="agendas-modal-form">
              <div>
                <label className="agendas-modal-field-label">
                  Profesional de Salud
                </label>
                <select
                  value={nuevoProfId}
                  onChange={(e) => handleModalProfChange(e.target.value)}
                  className="agendas-modal-select"
                  required
                >
                  {profesionales.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombres} {p.apellidos} ({p.especialidad.replace("_", " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="agendas-modal-grid-2">
                <div>
                  <label className="agendas-modal-field-label">
                    Especialidad
                  </label>
                  <input
                    type="text"
                    value={nuevaEsp.replace("_", " ")}
                    readOnly
                    className="agendas-modal-input-readonly"
                  />
                </div>
                <div>
                  <label className="agendas-modal-field-label">
                    Box Clínico ({nuevaEsp.replace("_", " ")})
                  </label>
                  <select
                    value={nuevoBoxId}
                    onChange={(e) => setNuevoBoxId(e.target.value)}
                    className="agendas-modal-select"
                    required
                  >
                    {boxes
                      .filter((b) => b.especialidad === nuevaEsp)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.numero} · {b.especialidad.replace("_", " ")}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="agendas-modal-field-label">
                  Fecha de la Agenda
                </label>
                <input
                  type="date"
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  className="agendas-modal-input-mono"
                  required
                />
              </div>

              <div className="agendas-modal-grid-2">
                <div>
                  <label className="agendas-modal-field-label">
                    Hora Inicio
                  </label>
                  <input
                    type="time"
                    value={nuevaHoraInicio}
                    onChange={(e) => setNuevaHoraInicio(e.target.value)}
                    className="agendas-modal-input-mono"
                    required
                  />
                </div>
                <div>
                  <label className="agendas-modal-field-label">
                    Hora Fin
                  </label>
                  <input
                    type="time"
                    value={nuevaHoraFin}
                    onChange={(e) => setNuevaHoraFin(e.target.value)}
                    className="agendas-modal-input-mono"
                    required
                  />
                </div>
              </div>

              <div className="agendas-modal-grid-2">
                <div>
                  <label className="agendas-modal-field-label">
                    Duración por Bloque
                  </label>
                  <select
                    value={nuevaDuracionMin}
                    onChange={(e) => setNuevaDuracionMin(Number(e.target.value))}
                    className="agendas-modal-select"
                  >
                    <option value={15}>15 minutos</option>
                    <option value={20}>20 minutos (Estándar)</option>
                    <option value={30}>30 minutos</option>
                  </select>
                </div>
                <div>
                  <label className="agendas-modal-field-label">
                    % Cuota Adulto Mayor (60+)
                  </label>
                  {nuevaEsp === "MEDICINA_GENERAL" ? (
                    <select
                      value={nuevoPorcentajeCuota}
                      onChange={(e) => setNuevoPorcentajeCuota(Number(e.target.value))}
                      className="agendas-modal-select"
                    >
                      <option value={20}>20%</option>
                      <option value={30}>30% (Normativa Legal)</option>
                      <option value={40}>40%</option>
                      <option value={50}>50%</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value="0% (Exclusivo Medicina General)"
                      readOnly
                      className="agendas-modal-input-readonly"
                    />
                  )}
                </div>
              </div>

              {/* Previsualizador */}
              <div className="agendas-preview-box">
                <div className="agendas-preview-title">
                  Previsualizador Automático de Bloques:
                </div>
                <div className="agendas-modal-row">
                  <span className="agendas-modal-label">Bloques hábiles a crear:</span>
                  <strong className="agendas-modal-warn-strong">{previsualizacionModal.total} cupos</strong>
                </div>
                <div className="agendas-modal-row">
                  <span className="agendas-modal-label">Pausa colación 13:00-14:00 (Omitida):</span>
                  <span>{previsualizacionModal.colacionOmitida} bloques</span>
                </div>
                {nuevaEsp === "MEDICINA_GENERAL" ? (
                  <>
                    <div className="agendas-preview-senior-row">
                      <span>★ Cuota protegida Adulto Mayor (intercalada):</span>
                      <span>
                        {previsualizacionModal.cuota} cupos ({nuevoPorcentajeCuota}%)
                      </span>
                    </div>
                    <div className="agendas-preview-note">
                      * Se asignan de forma intercalada (08:20, 09:00...) y se liberan a todo público 30 min antes si no son tomados.
                    </div>
                  </>
                ) : (
                  <div className="agendas-preview-note">
                    * La cuota protegida 60+ aplica exclusivamente a Medicina General.
                  </div>
                )}
              </div>

              <div className="agendas-modal-actions">
                <button
                  type="submit"
                  disabled={guardandoAgenda || previsualizacionModal.total === 0}
                  className="agendas-modal-submit-btn"
                >
                  {guardandoAgenda ? "Publicando Agenda..." : "Publicar Agenda Médica →"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalCrearAbierto(false)}
                  className="agendas-modal-btn-cancel"
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
