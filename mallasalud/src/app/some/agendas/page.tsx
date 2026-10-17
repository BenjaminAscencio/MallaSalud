"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

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
        // Calcular inicio y fin de la semana (Lunes a Sábado)
        const d = new Date(fechaSeleccionada + "T00:00:00");
        const dayOfWeek = d.getDay(); // 0: Dom, 1: Lun, ...
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

    const cuota = nuevaEsp === "MEDICINA_GENERAL" ? Math.round((count * nuevoPorcentajeCuota) / 100) : 0;
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
        `Agenda creada con éxito: ${data.total_bloques} cupos generados (${data.bloques_cuota_mayor} cuota 60+).`
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
  const handlePausarAgenda = async (id: string) => {
    if (!confirm("¿Está seguro de pausar esta agenda médica? Los cupos disponibles se bloquearán.")) {
      return;
    }

    setAlertaPausa(null);
    try {
      const res = await fetch(`/api/v1/some/agendas/${id}/pausar`, {
        method: "PUT",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al pausar");

      setAlertaPausa(data.mensaje);
      await cargarAgendas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al pausar agenda";
      alert(msg);
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
    <main className="max-w-[1440px] mx-auto px-4 py-6 font-sans">
      {/* 1. Header del Calendario y Controles */}
      <div className="border-2 border-black bg-white p-5 mb-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-black pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs uppercase px-2 py-0.5 bg-black text-white font-bold">
                HU-005
              </span>
              <span className="text-xs font-mono text-neutral-600">
                Consola SOME • Vista Calendario Interactivo
              </span>
            </div>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-black font-mono">
              Programación y Control de Agendas
            </h1>
          </div>

          {/* Botón de Publicación Destacado */}
          <button
            type="button"
            onClick={() => abrirModalCrear()}
            className="bg-black text-white hover:bg-neutral-800 border-2 border-black px-5 py-2.5 text-xs font-mono uppercase font-bold tracking-wider transition-colors shadow-sm self-start lg:self-auto flex items-center gap-2"
          >
            <span>+ Publicar Nueva Agenda</span>
          </button>
        </div>

        {/* Barra de Navegación y Filtros */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 text-xs font-mono">
          {/* Selector de Modo de Vista */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setModoVista("matriz")}
              className={`px-3 py-1.5 border transition-colors ${
                modoVista === "matriz"
                  ? "bg-black text-white border-black font-bold"
                  : "bg-white text-black border-neutral-300 hover:border-black"
              }`}
            >
              1. Matriz Diaria por Boxes
            </button>
            <button
              type="button"
              onClick={() => setModoVista("semanal")}
              className={`px-3 py-1.5 border transition-colors ${
                modoVista === "semanal"
                  ? "bg-black text-white border-black font-bold"
                  : "bg-white text-black border-neutral-300 hover:border-black"
              }`}
            >
              2. Horario Semanal (Lun - Sáb)
            </button>
            <button
              type="button"
              onClick={() => setModoVista("tabla")}
              className={`px-3 py-1.5 border transition-colors ${
                modoVista === "tabla"
                  ? "bg-black text-white border-black font-bold"
                  : "bg-white text-black border-neutral-300 hover:border-black"
              }`}
            >
              3. Lista Resumen (Tabla)
            </button>
          </div>

          {/* Controles de Navegación de Fecha */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => cambiarDia(-1)}
              className="border border-black px-2.5 py-1 hover:bg-neutral-100"
              title="Día anterior"
            >
              &lt; Anterior
            </button>
            <button
              type="button"
              onClick={irAHoy}
              className="border border-black px-2.5 py-1 hover:bg-neutral-100 font-bold"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={irAMañana}
              className="border border-black px-2.5 py-1 hover:bg-neutral-100"
            >
              Mañana
            </button>
            <button
              type="button"
              onClick={() => cambiarDia(1)}
              className="border border-black px-2.5 py-1 hover:bg-neutral-100"
              title="Día siguiente"
            >
              Siguiente &gt;
            </button>
            <input
              type="date"
              value={fechaSeleccionada}
              onChange={(e) => setFechaSeleccionada(e.target.value)}
              className="border-2 border-black px-2 py-0.5 text-xs font-mono bg-white focus:outline-none"
            />
          </div>

          {/* Filtros de Dominio */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtroEspecialidad}
              onChange={(e) => setFiltroEspecialidad(e.target.value)}
              className="border border-black px-2 py-1 bg-white text-xs font-mono"
            >
              <option value="">Todas las Especialidades</option>
              <option value="MEDICINA_GENERAL">Medicina General</option>
              <option value="DENTAL">Dental</option>
              <option value="MATRONERIA">Matronería</option>
            </select>

            <select
              value={filtroBoxId}
              onChange={(e) => setFiltroBoxId(e.target.value)}
              className="border border-black px-2 py-1 bg-white text-xs font-mono"
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
              className="border border-black px-2 py-1 bg-white text-xs font-mono"
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

        {/* Leyenda de Estados en Blanco y Negro */}
        <div className="mt-4 pt-3 border-t border-neutral-300 flex flex-wrap items-center gap-4 text-[11px] font-mono text-neutral-600">
          <span className="font-bold uppercase text-black">Leyenda:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 border border-black bg-white inline-block"></span>
            <span>Disponible General</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 border-2 border-black bg-white inline-block"></span>
            <span className="font-bold text-black">★ Cuota 60+ (Protegido)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-neutral-900 inline-block"></span>
            <span className="text-black font-semibold">Reservado / Paciente</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-neutral-200 border border-neutral-400 inline-block line-through"></span>
            <span>Bloqueado SOME</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-neutral-100 border border-dashed border-black inline-block"></span>
            <span>13:00 - 14:00 Colación (Sin atención)</span>
          </span>
        </div>
      </div>

      {/* Alertas Globales */}
      {mensajeExito && (
        <div className="border-2 border-black bg-neutral-100 p-3 mb-4 text-xs font-mono">
          <span className="font-bold">[✓] OPERACIÓN EXITOSA:</span> {mensajeExito}
        </div>
      )}

      {alertaPausa && (
        <div className="border-2 border-black bg-white p-3 mb-4 text-xs font-mono">
          <span className="font-bold">[!] ALERTA SOME:</span> {alertaPausa}
        </div>
      )}

      {/* CONTENIDO PRINCIPAL SEGÚN EL MODO DE VISTA */}
      {cargando ? (
        <div className="border-2 border-black p-12 text-center text-xs font-mono text-neutral-500 bg-white">
          Cargando agendas médicas y bloques horarios...
        </div>
      ) : modoVista === "matriz" ? (
        /* ========================================================================= */
        /* PESTAÑA 1: Matriz Diaria por Boxes (Estilo Google Calendar de Recursos)   */
        /* ========================================================================= */
        <div className="border-2 border-black bg-white overflow-x-auto shadow-sm">
          <div className="min-w-[900px]">
            {/* Cabecera de la Grilla: Boxes Clínicos */}
            <div
              className="grid border-b-2 border-black bg-neutral-100"
              style={{
                gridTemplateColumns: `100px repeat(${boxesFiltrados.length}, minmax(220px, 1fr))`,
              }}
            >
              {/* Celda de esquina (Hora / Box) */}
              <div className="p-3 font-mono text-xs font-bold uppercase border-r-2 border-black flex items-center justify-center bg-neutral-200">
                HORA
              </div>

              {/* Columnas de Boxes */}
              {boxesFiltrados.map((box) => {
                const agendaBox = agendas.find(
                  (a) => a.box_id === box.id && a.fecha === fechaSeleccionada
                );

                return (
                  <div key={box.id} className="p-3 border-r border-black last:border-r-0 font-mono">
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="font-bold text-sm uppercase tracking-tight block">
                        {box.numero}
                      </span>
                      <span className="text-[10px] uppercase px-1 border border-black bg-white font-bold">
                        {box.especialidad}
                      </span>
                    </div>

                    {agendaBox ? (
                      <div className="space-y-1.5 pt-1 border-t border-neutral-300 text-[11px]">
                        <div className="font-bold text-black truncate" title={agendaBox.profesional_nombre}>
                          {agendaBox.profesional_nombre}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-neutral-600">
                          <span>
                            {agendaBox.hora_inicio} - {agendaBox.hora_fin}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 border text-[9px] font-bold ${
                              agendaBox.activa
                                ? "bg-black text-white border-black"
                                : "bg-neutral-200 text-neutral-700 border-neutral-400"
                            }`}
                          >
                            {agendaBox.activa ? "ACTIVA" : "BLOQUEADA"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold pt-0.5">
                          <span>
                            Libres: {agendaBox.estadisticas.disponibles}/{agendaBox.estadisticas.total}
                          </span>
                          {agendaBox.activa && (
                            <button
                              type="button"
                              onClick={() => handlePausarAgenda(agendaBox.id)}
                              className="text-[10px] uppercase underline hover:no-underline text-neutral-800"
                            >
                              [Pausar]
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 text-[11px] text-neutral-500">
                        <span className="block mb-1.5 italic">Sin agenda hoy</span>
                        <button
                          type="button"
                          onClick={() => abrirModalCrear({ boxId: box.id, fecha: fechaSeleccionada })}
                          className="w-full text-[10px] font-bold uppercase py-1 border border-black bg-white hover:bg-black hover:text-white transition-colors"
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
            <div className="divide-y divide-neutral-200">
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
                    {/* Eje Y: Franja Horaria */}
                    <div className="p-2 border-r-2 border-black font-mono text-xs font-bold text-center bg-neutral-50 flex items-center justify-center">
                      {hora}
                    </div>

                    {/* Si es hora de colación (13:00 a 14:00), desplegar franja especial si no hay bloques */}
                    {esColacion ? (
                      <div
                        className="p-2 bg-neutral-100 border-r border-black font-mono text-[11px] text-center text-neutral-600 flex items-center justify-center italic"
                        style={{ gridColumn: `span ${boxesFiltrados.length}` }}
                      >
                        [ 13:00 - 14:00 | PAUSA DE COLACIÓN — SIN ATENCIÓN MÉDICA ]
                      </div>
                    ) : (
                      /* Casilleros por cada Box Clínico */
                      boxesFiltrados.map((box) => {
                        const agendaBox = agendas.find(
                          (a) => a.box_id === box.id && a.fecha === fechaSeleccionada
                        );
                        const bloquesList = agendaBox?.bloques_horarios || agendaBox?.bloques || [];
                        const bloque = bloquesList.find((b) => b.hora_inicio === hora);

                        return (
                          <div
                            key={box.id}
                            className="p-1.5 border-r border-neutral-300 last:border-r-0 min-h-[48px] flex items-stretch"
                          >
                            {bloque ? (
                              <button
                                type="button"
                                onClick={() =>
                                  agendaBox && setBloqueSeleccionado({ bloque, agenda: agendaBox })
                                }
                                className={`w-full p-1.5 text-left font-mono text-[11px] transition-all flex flex-col justify-between ${
                                  bloque.estado_bloque === "RESERVADO"
                                    ? "bg-neutral-900 text-white shadow-sm hover:bg-black"
                                    : bloque.estado_bloque === "BLOQUEADO_SOME"
                                    ? "bg-neutral-200 text-neutral-500 line-through border border-neutral-300 hover:bg-neutral-300"
                                    : bloque.es_cuota_adulto_mayor
                                    ? "bg-white text-black border-2 border-black hover:bg-neutral-50 font-bold"
                                    : "bg-white text-black border border-neutral-400 hover:border-black hover:bg-neutral-50"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 w-full">
                                  <span className="font-bold">
                                    {bloque.hora_inicio} - {bloque.hora_fin}
                                  </span>
                                  {bloque.es_cuota_adulto_mayor && bloque.estado_bloque === "DISPONIBLE" && (
                                    <span className="text-[9px] px-1 bg-black text-white font-bold">
                                      ★ 60+
                                    </span>
                                  )}
                                </div>

                                <div className="text-[10px] truncate w-full mt-0.5">
                                  {bloque.estado_bloque === "RESERVADO" ? (
                                    <span className="font-bold text-neutral-200">
                                      [RES: {bloque.cita?.codigo_reserva || "OCUPADO"}]
                                    </span>
                                  ) : bloque.estado_bloque === "BLOQUEADO_SOME" ? (
                                    <span>[BLOQUEADO SOME]</span>
                                  ) : bloque.es_cuota_adulto_mayor ? (
                                    <span>[CUOTA ADULTO MAYOR]</span>
                                  ) : (
                                    <span className="text-neutral-600">[DISPONIBLE]</span>
                                  )}
                                </div>
                              </button>
                            ) : agendaBox ? (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-300 font-mono italic">
                                -
                              </div>
                            ) : (
                              <div className="w-full h-full"></div>
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
        /* PESTAÑA 2: Horario Semanal (Estilo Horario de Clases Universitario)       */
        /* ========================================================================= */
        <div className="border-2 border-black bg-white overflow-x-auto shadow-sm">
          <div className="min-w-[1000px]">
            {/* Cabecera Semanal: Lunes a Sábado */}
            <div className="grid grid-cols-6 border-b-2 border-black bg-neutral-100 font-mono">
              {diasSemana.map((dia) => {
                const esHoy = dia.fecha === new Date().toISOString().split("T")[0];
                return (
                  <div
                    key={dia.fecha}
                    className={`p-3 border-r border-black last:border-r-0 text-center ${
                      esHoy ? "bg-neutral-200 font-bold" : ""
                    }`}
                  >
                    <span className="block text-xs uppercase text-neutral-600 font-semibold">
                      {dia.nombre}
                    </span>
                    <span className="text-lg font-bold text-black">
                      {dia.numeroDia} {dia.mes}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Contenido de la Semana */}
            <div className="grid grid-cols-6 divide-x divide-black min-h-[500px]">
              {diasSemana.map((dia) => {
                const agendasDelDia = agendas.filter((a) => a.fecha === dia.fecha);

                return (
                  <div key={dia.fecha} className="p-3 space-y-3 font-mono text-xs bg-white">
                    {agendasDelDia.length > 0 ? (
                      agendasDelDia.map((agenda) => (
                        <div
                          key={agenda.id}
                          className="border-2 border-black p-3 space-y-2 hover:bg-neutral-50 transition-colors"
                        >
                          <div className="flex items-center justify-between border-b border-black pb-1.5">
                            <span className="font-bold text-xs uppercase">{agenda.box_numero}</span>
                            <span className="text-[10px] px-1 bg-black text-white font-bold">
                              {agenda.especialidad}
                            </span>
                          </div>

                          <div>
                            <span className="font-bold block text-neutral-900 truncate">
                              {agenda.profesional_nombre}
                            </span>
                            <span className="text-[11px] text-neutral-600 block">
                              {agenda.hora_inicio} - {agenda.hora_fin} ({agenda.duracion_bloque_min} min)
                            </span>
                          </div>

                          <div className="pt-1.5 border-t border-neutral-300 text-[11px] space-y-0.5">
                            <div className="flex justify-between">
                              <span>Disponibles:</span>
                              <strong>{agenda.estadisticas.disponibles}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Reservados:</span>
                              <strong>{agenda.estadisticas.reservados}</strong>
                            </div>
                            {agenda.estadisticas.cuota_adulto_mayor > 0 && (
                              <div className="flex justify-between text-neutral-700 font-semibold">
                                <span>Cuota 60+:</span>
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
                              className="flex-1 text-[10px] uppercase font-bold py-1 border border-black bg-white hover:bg-black hover:text-white transition-colors text-center"
                            >
                              Ver Día →
                            </button>
                            {agenda.activa && (
                              <button
                                type="button"
                                onClick={() => handlePausarAgenda(agenda.id)}
                                className="text-[10px] uppercase px-1.5 py-1 border border-black hover:bg-neutral-200"
                                title="Pausar agenda"
                              >
                                Pausar
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-neutral-400 border border-dashed border-neutral-300 p-4 space-y-2">
                        <span className="block text-[11px] italic">Sin agenda</span>
                        <button
                          type="button"
                          onClick={() => abrirModalCrear({ fecha: dia.fecha })}
                          className="text-[10px] uppercase font-bold px-2 py-1 border border-black bg-white hover:bg-black hover:text-white transition-colors"
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
        /* PESTAÑA 3: Lista Resumen (Tabla Tradicional)                              */
        /* ========================================================================= */
        <div className="border-2 border-black p-5 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black pb-3 mb-4 font-mono">
            <div>
              <h2 className="text-base font-bold uppercase tracking-tight text-black">
                Lista Resumen de Agendas ({agendas.length})
              </h2>
              <p className="text-xs text-neutral-600">
                Detalle tabular consolidado de jornadas y cupos.
              </p>
            </div>
            <button
              onClick={cargarAgendas}
              className="text-xs font-mono uppercase px-3 py-1 border border-black hover:bg-neutral-100 font-bold"
            >
              Actualizar
            </button>
          </div>

          {agendas.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-neutral-500 border border-dashed border-neutral-300">
              No se encontraron agendas registradas con los filtros seleccionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b-2 border-black bg-neutral-100">
                    <th className="py-2.5 px-3 uppercase font-bold">Fecha</th>
                    <th className="py-2.5 px-3 uppercase font-bold">Horario</th>
                    <th className="py-2.5 px-3 uppercase font-bold">Profesional / Box</th>
                    <th className="py-2.5 px-3 uppercase font-bold text-center">Cupos</th>
                    <th className="py-2.5 px-3 uppercase font-bold text-center">Estado</th>
                    <th className="py-2.5 px-3 uppercase font-bold text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-300">
                  {agendas.map((ag) => (
                    <tr key={ag.id} className="hover:bg-neutral-50">
                      <td className="py-3 px-3 font-bold whitespace-nowrap">{ag.fecha}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {ag.hora_inicio} - {ag.hora_fin}
                        <span className="block text-[10px] text-neutral-500">
                          {ag.duracion_bloque_min} min/bloque
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold block">{ag.profesional_nombre}</span>
                        <span className="text-[10px] text-neutral-600 block">
                          {ag.especialidad} • {ag.box_numero}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-bold">{ag.estadisticas.disponibles}</span>
                        <span className="text-neutral-500"> / {ag.estadisticas.total}</span>
                        {ag.estadisticas.cuota_adulto_mayor > 0 && (
                          <span className="block text-[10px] text-neutral-600">
                            (60+: {ag.estadisticas.cuota_adulto_mayor})
                          </span>
                        )}
                        {ag.estadisticas.reservados > 0 && (
                          <span className="block text-[10px] font-bold text-black">
                            Reservados: {ag.estadisticas.reservados}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {ag.activa ? (
                          <span className="px-2 py-0.5 border border-black bg-black text-white text-[10px] font-bold">
                            ACTIVA
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 border border-neutral-400 bg-neutral-200 text-neutral-700 text-[10px] font-bold">
                            BLOQUEADA SOME
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {ag.activa ? (
                          <button
                            type="button"
                            onClick={() => handlePausarAgenda(ag.id)}
                            className="text-[11px] font-mono uppercase px-2.5 py-1 border border-black hover:bg-black hover:text-white transition-colors"
                          >
                            Pausar Agenda
                          </button>
                        ) : (
                          <span className="text-[11px] text-neutral-400 font-mono italic">Pausada</span>
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
      {/* MODAL 1: Detalle del Bloque Horario al hacer clic                         */}
      {/* ========================================================================= */}
      {bloqueSeleccionado && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black max-w-md w-full p-6 shadow-2xl font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <span className="text-xs uppercase px-2 py-0.5 bg-black text-white font-bold">
                Detalle del Bloque Horario
              </span>
              <button
                type="button"
                onClick={() => setBloqueSeleccionado(null)}
                className="text-sm font-bold px-2 py-0.5 border border-black hover:bg-neutral-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 border-b border-neutral-300 pb-3">
              <div className="flex justify-between">
                <span className="text-neutral-600">Horario:</span>
                <strong className="text-sm">
                  {bloqueSeleccionado.bloque.hora_inicio} a {bloqueSeleccionado.bloque.hora_fin} hrs
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Fecha:</span>
                <strong>{bloqueSeleccionado.agenda.fecha}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Box Clínico:</span>
                <strong>{bloqueSeleccionado.agenda.box_numero}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Profesional:</span>
                <strong>{bloqueSeleccionado.agenda.profesional_nombre}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Especialidad:</span>
                <strong>{bloqueSeleccionado.agenda.especialidad}</strong>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-neutral-200">
                <span className="text-neutral-600">Estado del Cupo:</span>
                <span
                  className={`px-2 py-0.5 border font-bold text-[10px] ${
                    bloqueSeleccionado.bloque.estado_bloque === "RESERVADO"
                      ? "bg-neutral-900 text-white border-black"
                      : bloqueSeleccionado.bloque.estado_bloque === "BLOQUEADO_SOME"
                      ? "bg-neutral-200 text-neutral-700 border-neutral-400"
                      : "bg-white text-black border-black"
                  }`}
                >
                  {bloqueSeleccionado.bloque.estado_bloque}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Protección Cuota 60+:</span>
                <strong>{bloqueSeleccionado.bloque.es_cuota_adulto_mayor ? "Sí (★ Cuota Adulto Mayor)" : "No (General)"}</strong>
              </div>
            </div>

            {/* Datos de la Cita si está reservado */}
            {bloqueSeleccionado.bloque.cita ? (
              <div className="border border-black bg-neutral-50 p-3 space-y-1.5">
                <span className="font-bold block uppercase text-black border-b border-neutral-300 pb-1">
                  Datos de la Reserva:
                </span>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Código Reserva:</span>
                  <strong className="text-sm font-bold text-black">
                    {bloqueSeleccionado.bloque.cita.codigo_reserva}
                  </strong>
                </div>
                {bloqueSeleccionado.bloque.cita.paciente && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Paciente:</span>
                      <strong>{bloqueSeleccionado.bloque.cita.paciente.nombre_completo}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">RUT:</span>
                      <strong>{bloqueSeleccionado.bloque.cita.paciente.rut_formateado}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Contacto:</span>
                      <span>{bloqueSeleccionado.bloque.cita.paciente.telefono}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="text-neutral-500 italic text-[11px] text-center py-2">
                Este cupo no registra citas asociadas.
              </div>
            )}

            <button
              type="button"
              onClick={() => setBloqueSeleccionado(null)}
              className="w-full bg-black text-white hover:bg-neutral-800 border-2 border-black py-2 uppercase font-bold transition-colors"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Publicar Nueva Agenda Médica                                     */}
      {/* ========================================================================= */}
      {modalCrearAbierto && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black max-w-lg w-full p-6 shadow-2xl font-mono text-xs space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <div>
                <span className="text-xs uppercase px-2 py-0.5 bg-black text-white font-bold block mb-1 w-fit">
                  Apertura de Agenda
                </span>
                <h3 className="text-base font-bold uppercase tracking-tight text-black">
                  Publicar Nueva Agenda Médica
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalCrearAbierto(false)}
                className="text-sm font-bold px-2.5 py-1 border border-black hover:bg-neutral-200"
              >
                ✕
              </button>
            </div>

            {errorModal && (
              <div className="border-2 border-black bg-white p-3 text-xs">
                <span className="font-bold text-black">[!] ERROR:</span> {errorModal}
              </div>
            )}

            <form onSubmit={handleCrearAgendaSubmit} className="space-y-3.5">
              <div>
                <label className="block font-bold uppercase mb-1">Profesional de Salud</label>
                <select
                  value={nuevoProfId}
                  onChange={(e) => handleModalProfChange(e.target.value)}
                  className="w-full border-2 border-black px-3 py-2 bg-white text-xs font-mono focus:outline-none"
                  required
                >
                  {profesionales.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombres} {p.apellidos} ({p.especialidad})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase mb-1">Especialidad</label>
                  <input
                    type="text"
                    value={nuevaEsp}
                    readOnly
                    className="w-full border-2 border-black px-3 py-2 bg-neutral-100 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase mb-1">Box Clínico</label>
                  <select
                    value={nuevoBoxId}
                    onChange={(e) => setNuevoBoxId(e.target.value)}
                    className="w-full border-2 border-black px-3 py-2 bg-white text-xs font-mono focus:outline-none"
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
                <label className="block font-bold uppercase mb-1">Fecha de la Agenda</label>
                <input
                  type="date"
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  className="w-full border-2 border-black px-3 py-2 bg-white text-xs font-mono focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase mb-1">Hora Inicio</label>
                  <input
                    type="time"
                    value={nuevaHoraInicio}
                    onChange={(e) => setNuevaHoraInicio(e.target.value)}
                    className="w-full border-2 border-black px-3 py-2 bg-white text-xs font-mono focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold uppercase mb-1">Hora Fin</label>
                  <input
                    type="time"
                    value={nuevaHoraFin}
                    onChange={(e) => setNuevaHoraFin(e.target.value)}
                    className="w-full border-2 border-black px-3 py-2 bg-white text-xs font-mono focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold uppercase mb-1">Duración Bloque</label>
                  <select
                    value={nuevaDuracionMin}
                    onChange={(e) => setNuevaDuracionMin(Number(e.target.value))}
                    className="w-full border-2 border-black px-3 py-2 bg-white text-xs font-mono focus:outline-none"
                  >
                    <option value={15}>15 minutos</option>
                    <option value={20}>20 minutos (Estándar)</option>
                    <option value={30}>30 minutos</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold uppercase mb-1">% Cuota Adulto Mayor</label>
                  <select
                    value={nuevoPorcentajeCuota}
                    disabled={nuevaEsp !== "MEDICINA_GENERAL"}
                    onChange={(e) => setNuevoPorcentajeCuota(Number(e.target.value))}
                    className="w-full border-2 border-black px-3 py-2 bg-white text-xs font-mono focus:outline-none disabled:bg-neutral-100 disabled:cursor-not-allowed"
                  >
                    <option value={20}>20%</option>
                    <option value={30}>30% (Legal)</option>
                    <option value={40}>40%</option>
                    <option value={50}>50%</option>
                  </select>
                </div>
              </div>

              {/* Previsualizador */}
              <div className="border border-black bg-neutral-50 p-3 space-y-1 text-[11px]">
                <div className="font-bold uppercase text-black border-b border-neutral-300 pb-1 mb-1">
                  Previsualizador Automático:
                </div>
                <div className="flex justify-between">
                  <span>Bloques hábiles a crear:</span>
                  <strong>{previsualizacionModal.total} cupos</strong>
                </div>
                <div className="flex justify-between">
                  <span>Colación 13:00-14:00 (Omitida):</span>
                  <span>{previsualizacionModal.colacionOmitida} bloques</span>
                </div>
                {nuevaEsp === "MEDICINA_GENERAL" ? (
                  <div className="flex justify-between pt-1 border-t border-neutral-200">
                    <span>Cuota protegida Adulto Mayor:</span>
                    <strong>{previsualizacionModal.cuota} cupos ({nuevoPorcentajeCuota}%)</strong>
                  </div>
                ) : (
                  <div className="text-[10px] text-neutral-500 italic">
                    * La cuota protegida aplica a Medicina General.
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={guardandoAgenda || previsualizacionModal.total === 0}
                  className="flex-1 bg-black text-white hover:bg-neutral-800 border-2 border-black py-2.5 uppercase font-bold tracking-wider disabled:opacity-50"
                >
                  {guardandoAgenda ? "Publicando Agenda..." : "Publicar Agenda Médica →"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalCrearAbierto(false)}
                  className="border-2 border-black px-4 py-2.5 uppercase hover:bg-neutral-100"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
