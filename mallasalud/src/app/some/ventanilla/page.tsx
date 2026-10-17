"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatearRut, limpiarRut } from "@/lib/utils/rut";
import { estimarFechaNacimientoPorRut } from "@/lib/utils/edad";

interface PacienteFicha {
  id: string;
  rut: string;
  rut_formateado: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  edad: number;
  telefono: string;
  es_adulto_mayor: boolean;
  contador_inasistencias: number;
  estado_inscripcion: boolean;
}

interface CupoDisponible {
  id: string;
  agenda_id: string;
  especialidad: "MEDICINA_GENERAL" | "DENTAL" | "MATRONERIA";
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
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

interface ComprobanteCita {
  codigo_reserva: string;
  cita_id: string;
  canal_origen: string;
  estado_cita: string;
  created_at: string;
  paciente: {
    id: string;
    rut: string;
    rut_formateado: string;
    nombre_completo: string;
    telefono: string;
  };
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
  horario: {
    fecha: string;
    hora_inicio: string;
  };
  notificacion_sms: {
    id: string;
    telefono: string;
    mensaje: string;
    estado: string;
  };
}

export default function VentanillaSomePage() {
  const rutInputRef = useRef<HTMLInputElement>(null);

  // Sección 1: Búsqueda y Selección
  const [rutBusqueda, setRutBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [paciente, setPaciente] = useState<PacienteFicha | null>(null);
  const [mostrarAltaRapida, setMostrarAltaRapida] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  // Formulario Alta Rápida
  const [altaNombres, setAltaNombres] = useState("");
  const [altaApellidos, setAltaApellidos] = useState("");
  const [altaFechaNac, setAltaFechaNac] = useState("");
  const [altaTelefono, setAltaTelefono] = useState("");
  const [guardandoAlta, setGuardandoAlta] = useState(false);
  const [errorAlta, setErrorAlta] = useState<string | null>(null);

  // Sección 2: Cupos y Agendamiento
  const [filtroEspecialidad, setFiltroEspecialidad] = useState<string>("");
  const [filtroFecha, setFiltroFecha] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [cupos, setCupos] = useState<CupoDisponible[]>([]);
  const [cargandoCupos, setCargandoCupos] = useState(false);
  const [agendandoId, setAgendandoId] = useState<string | null>(null);
  const [errorAgendamiento, setErrorAgendamiento] = useState<string | null>(null);

  // Sección 3: Comprobante Imprimible
  const [comprobante, setComprobante] = useState<ComprobanteCita | null>(null);

  // Manejo de búsqueda por RUT
  const buscarPaciente = async (rutParaBuscar?: string) => {
    const rutTarget = rutParaBuscar || rutBusqueda;
    if (!rutTarget.trim()) return;

    setErrorBusqueda(null);
    setMostrarAltaRapida(false);
    setErrorAlta(null);
    setBuscando(true);

    try {
      const res = await fetch(`/api/v1/some/pacientes/${encodeURIComponent(rutTarget)}`);
      const data = await res.json();

      if (res.status === 404) {
        // No existe en padrón local -> Abrir formulario de Alta Rápida
        setPaciente(null);
        setMostrarAltaRapida(true);
        // Estimar fecha de nacimiento coherente según RUT
        const fechaEstimada = estimarFechaNacimientoPorRut(rutTarget);
        setAltaFechaNac(fechaEstimada.toISOString().split("T")[0]);
        setAltaNombres("");
        setAltaApellidos("");
        setAltaTelefono("+569");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || data.mensaje || "Error al buscar paciente");
      }

      const p: PacienteFicha = {
        id: data.paciente.id,
        rut: data.paciente.rut,
        rut_formateado: data.paciente.rut_formateado || formatearRut(data.paciente.rut),
        nombres: data.paciente.nombres,
        apellidos: data.paciente.apellidos,
        fecha_nacimiento: new Date(data.paciente.fecha_nacimiento).toISOString().split("T")[0],
        edad: data.paciente.edad,
        telefono: data.paciente.telefono,
        es_adulto_mayor: data.paciente.es_adulto_mayor,
        contador_inasistencias: data.paciente.contador_inasistencias,
        estado_inscripcion: data.paciente.estado_inscripcion,
      };

      setPaciente(p);
      setMostrarAltaRapida(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error de búsqueda";
      setErrorBusqueda(msg);
      setPaciente(null);
    } finally {
      setBuscando(false);
    }
  };

  const seleccionarRutPrueba = (rutPrueba: string) => {
    const formateado = formatearRut(rutPrueba);
    setRutBusqueda(formateado);
    buscarPaciente(formateado);
  };

  // Alta Rápida
  const handleAltaRapidaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAlta(null);
    setGuardandoAlta(true);

    try {
      const res = await fetch("/api/v1/some/pacientes/alta-rapida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rut: rutBusqueda,
          nombres: altaNombres,
          apellidos: altaApellidos,
          fecha_nacimiento: altaFechaNac,
          telefono: altaTelefono,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.mensaje || "Error al inscribir paciente");
      }

      const nuevo: PacienteFicha = {
        id: data.paciente.id,
        rut: data.paciente.rut,
        rut_formateado: data.paciente.rut_formateado || formatearRut(data.paciente.rut),
        nombres: data.paciente.nombres,
        apellidos: data.paciente.apellidos,
        fecha_nacimiento: new Date(data.paciente.fecha_nacimiento).toISOString().split("T")[0],
        edad: data.paciente.edad,
        telefono: data.paciente.telefono,
        es_adulto_mayor: data.paciente.es_adulto_mayor,
        contador_inasistencias: data.paciente.contador_inasistencias,
        estado_inscripcion: data.paciente.estado_inscripcion,
      };

      setPaciente(nuevo);
      setMostrarAltaRapida(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al registrar paciente";
      setErrorAlta(msg);
    } finally {
      setGuardandoAlta(false);
    }
  };

  // Carga de Cupos Disponibles
  const cargarCupos = useCallback(async () => {
    if (!paciente) return;
    setCargandoCupos(true);
    setErrorAgendamiento(null);

    try {
      const params = new URLSearchParams();
      if (filtroEspecialidad) params.set("especialidad", filtroEspecialidad);
      if (filtroFecha) params.set("fecha", filtroFecha);
      params.set("es_adulto_mayor", String(paciente.es_adulto_mayor));

      const res = await fetch(`/api/v1/some/cupos-disponibles?${params.toString()}`);
      if (!res.ok) throw new Error("Error al obtener cupos");
      const data = await res.json();
      setCupos(data.cupos || []);
    } catch (err: unknown) {
      console.error(err);
      setCupos([]);
    } finally {
      setCargandoCupos(false);
    }
  }, [paciente, filtroEspecialidad, filtroFecha]);

  useEffect(() => {
    if (paciente) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarCupos();
    }
  }, [paciente, cargarCupos]);

  // Agendamiento en Ventanilla
  const handleAgendar = useCallback(async (bloqueId: string) => {
    if (!paciente) return;
    setAgendandoId(bloqueId);
    setErrorAgendamiento(null);

    try {
      const res = await fetch("/api/v1/some/citas/agendar-ventanilla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paciente_id: paciente.id,
          bloque_id: bloqueId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No fue posible agendar la cita.");
      }

      setComprobante(data.comprobante);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al agendar cita";
      setErrorAgendamiento(msg);
    } finally {
      setAgendandoId(null);
    }
  }, [paciente]);

  const handleNuevaAtencion = useCallback(() => {
    setComprobante(null);
    setPaciente(null);
    setRutBusqueda("");
    setMostrarAltaRapida(false);
    setErrorBusqueda(null);
    setErrorAgendamiento(null);
    setTimeout(() => {
      rutInputRef.current?.focus();
    }, 50);
  }, []);

  // Atajos de teclado para atención ágil (< 45s por usuario, DoD HU-006)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2: Enfocar búsqueda de RUT
      if (e.key === "F2") {
        e.preventDefault();
        rutInputRef.current?.focus();
        rutInputRef.current?.select();
        return;
      }

      // Alt + N: Nueva Atención
      if (e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        handleNuevaAtencion();
        return;
      }

      // Alt + 1..9: Asignación rápida de cupos por índice
      if (e.altKey && !isNaN(Number(e.key))) {
        const num = Number(e.key);
        if (num >= 1 && num <= 9 && paciente && cupos.length >= num) {
          e.preventDefault();
          const target = cupos[num - 1];
          if (target && agendandoId !== target.id) {
            handleAgendar(target.id);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paciente, cupos, agendandoId, handleNuevaAtencion, handleAgendar]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Encabezado (oculto en impresión) */}
      <div className="border-b-2 border-black pb-4 mb-8 print:hidden">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs uppercase px-2 py-0.5 bg-neutral-200 text-black border border-black font-bold">
            HU-006
          </span>
          <span className="text-xs font-mono text-neutral-600">
            Sprint 1 • Atención Presencial SOME
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-black uppercase">
          Ventanilla de Agendamiento Presencial
        </h1>
        <p className="text-sm text-neutral-600 mt-1">
          Búsqueda de paciente, alta rápida en padrón local, asignación de cupos y emisión de comprobante oficial.
        </p>

        {/* Barra de Atajos de Teclado Ventanilla (DoD HU-006: atención ágil < 45s) */}
        <div className="mt-4 bg-neutral-100 border border-black px-3 py-1.5 text-[11px] font-mono text-neutral-700 flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold uppercase text-black">Atajos de Teclado:</span>
          <div className="flex flex-wrap gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-white border border-black font-bold">F2</kbd> Buscar RUT</span>
            <span><kbd className="px-1.5 py-0.5 bg-white border border-black font-bold">Alt + 1..9</kbd> Asignar Cupo</span>
            <span><kbd className="px-1.5 py-0.5 bg-white border border-black font-bold">Alt + N</kbd> Nueva Atención</span>
            <span><kbd className="px-1.5 py-0.5 bg-white border border-black font-bold">Ctrl + P</kbd> Imprimir Ticket</span>
          </div>
        </div>
      </div>

      {/* Si hay comprobante emitido, mostrar vista de Comprobante Imprimible */}
      {comprobante ? (
        <div className="max-w-md mx-auto my-4">
          {/* Botones de acción (ocultos al imprimir) */}
          <div className="flex items-center justify-between gap-3 mb-6 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex-1 bg-black text-white hover:bg-neutral-800 border-2 border-black py-2.5 text-xs font-mono uppercase font-bold tracking-wider transition-colors"
            >
              Imprimir Comprobante (PDF / Térmica)
            </button>
            <button
              onClick={handleNuevaAtencion}
              className="border-2 border-black px-4 py-2.5 text-xs font-mono uppercase hover:bg-neutral-100 transition-colors"
            >
              Nueva Atención [Alt+N]
            </button>
          </div>

          {/* Ticket Comprobante Oficial CESFAM */}
          <div className="print-ticket-container border-2 border-dashed border-black p-6 bg-white font-mono text-xs text-black space-y-4 shadow-sm">
            <div className="text-center border-b-2 border-black pb-3">
              <span className="font-bold text-sm uppercase block tracking-wider">
                CESFAM MALLASALUD
              </span>
              <span className="text-[10px] text-neutral-600 uppercase block">
                Comprobante de Reserva de Hora Médica
              </span>
              <span className="text-[10px] text-neutral-500 block mt-1">
                Canal: {comprobante.canal_origen}
              </span>
            </div>

            {/* Código de Reserva Destacado */}
            <div className="border border-black bg-neutral-100 p-3 text-center">
              <span className="text-[10px] uppercase text-neutral-600 block">
                Código Único de Reserva
              </span>
              <span className="text-2xl font-bold tracking-widest text-black">
                {comprobante.codigo_reserva}
              </span>
            </div>

            {/* Datos de la Cita */}
            <div className="space-y-1.5 border-b border-black pb-3 text-[11px]">
              <div className="flex justify-between">
                <span className="text-neutral-600">Fecha:</span>
                <strong>{comprobante.horario.fecha}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Hora de Atención:</span>
                <strong>{comprobante.horario.hora_inicio} hrs</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Especialidad:</span>
                <strong>{comprobante.profesional.especialidad}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Box Asignado:</span>
                <strong>{comprobante.box.numero}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Profesional:</span>
                <strong>{comprobante.profesional.nombre_completo}</strong>
              </div>
            </div>

            {/* Datos del Paciente */}
            <div className="space-y-1.5 border-b border-black pb-3 text-[11px]">
              <div className="flex justify-between">
                <span className="text-neutral-600">Paciente:</span>
                <strong>{comprobante.paciente.nombre_completo}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">RUT:</span>
                <strong>{comprobante.paciente.rut_formateado}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600">Teléfono Notificación:</span>
                <strong>{comprobante.paciente.telefono}</strong>
              </div>
            </div>

            {/* Confirmación SMS */}
            <div className="text-[10px] text-neutral-600 border border-neutral-300 p-2">
              <span className="font-bold block uppercase mb-0.5">Notificación SMS Enviada:</span>
              <p className="italic leading-tight">{comprobante.notificacion_sms.mensaje}</p>
            </div>

            {/* Indicaciones al Paciente */}
            <div className="text-[10px] text-neutral-600 text-center pt-2 space-y-1">
              <p className="font-bold uppercase">Presentarse 15 minutos antes</p>
              <p>Con su Cédula de Identidad en la sala de espera correspondiente.</p>
              <p className="text-[9px] text-neutral-400">Emisión: {new Date().toLocaleString("es-CL")}</p>
            </div>
          </div>
        </div>
      ) : (
        /* Flujo Regular de Ventanilla SOME */
        <div className="space-y-8">
          {/* SECCIÓN 1: Búsqueda de Paciente */}
          <div className="border-2 border-black p-6 bg-white">
            <h2 className="text-base font-bold uppercase tracking-tight text-black mb-1 font-mono">
              1. Identificación del Paciente en Ventanilla
            </h2>
            <p className="text-xs text-neutral-600 mb-4 font-mono">
              Consulte el RUT del usuario en el padrón del establecimiento.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                buscarPaciente();
              }}
              className="flex flex-wrap gap-2 max-w-xl"
            >
              <input
                ref={rutInputRef}
                type="text"
                value={rutBusqueda}
                onChange={(e) => {
                  const limpio = limpiarRut(e.target.value);
                  if (limpio.length <= 9) {
                    setRutBusqueda(formatearRut(limpio));
                  }
                  setErrorBusqueda(null);
                }}
                placeholder="RUT: 21.111.111-1 o 5.555.555-5 [F2]"
                className="flex-1 min-w-[200px] border-2 border-black px-3 py-2 text-sm font-mono tracking-wider focus:outline-none"
              />
              <button
                type="submit"
                disabled={buscando}
                className="bg-black text-white hover:bg-neutral-800 border-2 border-black px-4 py-2 text-xs font-mono uppercase font-bold tracking-wider disabled:opacity-50"
              >
                {buscando ? "Buscando..." : "Buscar Paciente"}
              </button>
            </form>

            {/* Botones Rápidos de Prueba */}
            <div className="mt-4 pt-4 border-t border-neutral-300">
              <span className="block text-[11px] font-mono text-neutral-500 uppercase font-bold mb-2">
                Accesos Directos de Prueba (SOME):
              </span>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => seleccionarRutPrueba("21111111-1")}
                  className="border border-black px-2.5 py-1 hover:bg-neutral-100"
                >
                  Joven: <strong>21.111.111-1</strong>
                </button>
                <button
                  type="button"
                  onClick={() => seleccionarRutPrueba("5555555-5")}
                  className="border border-black px-2.5 py-1 hover:bg-neutral-100"
                >
                  60+: <strong>5.555.555-5</strong>
                </button>
                <button
                  type="button"
                  onClick={() => seleccionarRutPrueba("16666666-6")}
                  className="border border-black px-2.5 py-1 hover:bg-neutral-100"
                >
                  NSP: <strong>16.666.666-6</strong>
                </button>
                <button
                  type="button"
                  onClick={() => seleccionarRutPrueba("21222222-2")}
                  className="border border-black px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200"
                >
                  No Inscrito (Joven): <strong>21.222.222-2</strong>
                </button>
                <button
                  type="button"
                  onClick={() => seleccionarRutPrueba("6666666-6")}
                  className="border border-black px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200"
                >
                  No Inscrito (60+): <strong>6.666.666-6</strong>
                </button>
              </div>
            </div>

            {/* Error de Búsqueda */}
            {errorBusqueda && (
              <div className="mt-4 border border-black bg-neutral-100 p-3 text-xs font-mono">
                [!] {errorBusqueda}
              </div>
            )}

            {/* Paciente Encontrado */}
            {paciente && (
              <div className="mt-6 border-2 border-black p-4 bg-neutral-50 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase px-2 py-0.5 bg-black text-white font-bold">
                      Paciente Seleccionado
                    </span>
                    {paciente.es_adulto_mayor && (
                      <span className="text-xs font-mono uppercase px-2 py-0.5 border border-black bg-neutral-200 font-bold">
                        ★ ADULTO MAYOR (&gt;= 60 AÑOS)
                      </span>
                    )}
                    {paciente.contador_inasistencias > 0 && (
                      <span className="text-xs font-mono uppercase px-2 py-0.5 border border-black">
                        NSP Registradas: {paciente.contador_inasistencias}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setPaciente(null)}
                    className="text-[11px] font-mono uppercase underline hover:no-underline"
                  >
                    Cambiar Paciente
                  </button>
                </div>

                <div className="text-lg font-bold uppercase tracking-tight text-black">
                  {paciente.nombres} {paciente.apellidos}
                </div>

                <div className="flex flex-wrap gap-4 text-xs font-mono text-neutral-600">
                  <span>RUT: <strong>{paciente.rut_formateado}</strong></span>
                  <span>Edad: <strong>{paciente.edad} años</strong></span>
                  <span>F. Nac: <strong>{paciente.fecha_nacimiento}</strong></span>
                  <span>Tel: <strong>{paciente.telefono}</strong></span>
                </div>
              </div>
            )}

            {/* Formulario de Alta Rápida (cuando no está inscrito) */}
            {mostrarAltaRapida && (
              <div className="mt-6 border-2 border-black p-5 bg-white space-y-4">
                <div className="border-b border-black pb-2">
                  <span className="text-xs font-mono uppercase px-2 py-0.5 bg-black text-white font-bold inline-block mb-1">
                    Alta Rápida en Padrón Local SOME
                  </span>
                  <h3 className="text-sm font-bold uppercase tracking-tight text-black">
                    Inscripción Inmediata de Paciente Nuevo
                  </h3>
                  <p className="text-xs text-neutral-600 font-mono">
                    El paciente no figura en la base local. Complete los datos básicos para enrolarlo y permitir el agendamiento.
                  </p>
                </div>

                {errorAlta && (
                  <div className="border border-black bg-neutral-100 p-2 text-xs font-mono">
                    [!] {errorAlta}
                  </div>
                )}

                <form onSubmit={handleAltaRapidaSubmit} className="space-y-3 text-xs font-mono">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold uppercase mb-1">RUT</label>
                      <input
                        type="text"
                        value={rutBusqueda}
                        readOnly
                        className="w-full border-2 border-black px-3 py-2 bg-neutral-100 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase mb-1">Teléfono Contacto</label>
                      <input
                        type="text"
                        value={altaTelefono}
                        onChange={(e) => setAltaTelefono(e.target.value)}
                        placeholder="+56912345678"
                        className="w-full border-2 border-black px-3 py-2"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold uppercase mb-1">Nombres</label>
                      <input
                        type="text"
                        value={altaNombres}
                        onChange={(e) => setAltaNombres(e.target.value)}
                        placeholder="Ej: Juan Carlos"
                        className="w-full border-2 border-black px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold uppercase mb-1">Apellidos</label>
                      <input
                        type="text"
                        value={altaApellidos}
                        onChange={(e) => setAltaApellidos(e.target.value)}
                        placeholder="Ej: Pérez González"
                        className="w-full border-2 border-black px-3 py-2"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold uppercase mb-1">
                      Fecha de Nacimiento (Sugerida según serie del RUT)
                    </label>
                    <input
                      type="date"
                      value={altaFechaNac}
                      onChange={(e) => setAltaFechaNac(e.target.value)}
                      className="w-full border-2 border-black px-3 py-2"
                      required
                    />
                    <span className="text-[10px] text-neutral-500 italic block mt-0.5">
                      * Auto-calculada preliminarmente según los millones del RUT. Puede corregirse si difiere del carnet.
                    </span>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="submit"
                      disabled={guardandoAlta}
                      className="flex-1 bg-black text-white hover:bg-neutral-800 border-2 border-black py-2.5 text-xs font-mono uppercase font-bold tracking-wider disabled:opacity-50"
                    >
                      {guardandoAlta ? "Registrando en Padrón..." : "Inscribir Paciente y Proceder a Agendar →"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMostrarAltaRapida(false)}
                      className="border-2 border-black px-4 py-2.5 text-xs font-mono uppercase hover:bg-neutral-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: Asignación de Cupos Disponibles */}
          {paciente && (
            <div className="border-2 border-black p-6 bg-white space-y-4">
              <div className="border-b border-black pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold uppercase tracking-tight text-black font-mono">
                      2. Selección y Asignación de Cupo
                    </h2>
                    <p className="text-xs text-neutral-600 font-mono">
                      Cupos disponibles en tiempo real respetando cuota de Adulto Mayor.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-neutral-500">
                    Paciente activo: <strong>{paciente.nombres} {paciente.apellidos}</strong> (
                    {paciente.es_adulto_mayor ? "60+ Preferente" : "General"})
                  </span>
                </div>
              </div>

              {/* Filtros de Especialidad y Fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-bold uppercase mb-1">
                    Especialidad Médica
                  </label>
                  <select
                    value={filtroEspecialidad}
                    onChange={(e) => setFiltroEspecialidad(e.target.value)}
                    className="w-full border-2 border-black px-3 py-2 bg-white text-xs font-mono focus:outline-none"
                  >
                    <option value="">Todas las especialidades</option>
                    <option value="MEDICINA_GENERAL">Medicina General</option>
                    <option value="DENTAL">Urgencia Dental</option>
                    <option value="MATRONERIA">Matronería</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold uppercase mb-1">
                    Fecha de Atención
                  </label>
                  <input
                    type="date"
                    value={filtroFecha}
                    onChange={(e) => setFiltroFecha(e.target.value)}
                    className="w-full border-2 border-black px-3 py-2 bg-white text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Error de Agendamiento (ej: duplicidad en la misma fecha) */}
              {errorAgendamiento && (
                <div className="border-2 border-black bg-neutral-100 p-3 text-xs font-mono">
                  <span className="font-bold uppercase">[!] RECHAZO DE NEGOCIO:</span> {errorAgendamiento}
                </div>
              )}

              {/* Tabla de Cupos Disponibles */}
              {cargandoCupos ? (
                <div className="py-12 text-center text-xs font-mono text-neutral-500">
                  Consultando disponibilidad de cupos...
                </div>
              ) : cupos.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-neutral-500 border border-dashed border-neutral-300">
                  No hay cupos disponibles para los filtros seleccionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b-2 border-black bg-neutral-100">
                        <th className="py-2 px-2 uppercase font-bold">Hora</th>
                        <th className="py-2 px-2 uppercase font-bold">Especialidad</th>
                        <th className="py-2 px-2 uppercase font-bold">Profesional</th>
                        <th className="py-2 px-2 uppercase font-bold">Box</th>
                        <th className="py-2 px-2 uppercase font-bold text-center">Tipo Cupo</th>
                        <th className="py-2 px-2 uppercase font-bold text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-300">
                      {cupos.map((c, idx) => (
                        <tr
                          key={c.id}
                          className={`hover:bg-neutral-50 transition-colors ${
                            c.es_cancelacion_reciente ? "bg-neutral-100 font-bold" : ""
                          }`}
                        >
                          <td className="py-2.5 px-2 font-bold whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {idx < 9 && (
                                <span className="text-[10px] bg-neutral-200 border border-neutral-400 px-1 text-neutral-700 font-normal">
                                  #{idx + 1}
                                </span>
                              )}
                              <span>{c.hora_inicio} hrs</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 whitespace-nowrap">
                            {c.especialidad}
                          </td>
                          <td className="py-2.5 px-2">
                            {c.profesional.nombre_completo}
                          </td>
                          <td className="py-2.5 px-2 whitespace-nowrap">
                            {c.box.numero}
                          </td>
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            {c.es_cancelacion_reciente ? (
                              <span className="px-1.5 py-0.5 border-2 border-black bg-black text-white text-[10px] font-bold inline-flex items-center gap-1">
                                <span>⚡ REASIGNACIÓN EN SALA (CANCELADO)</span>
                              </span>
                            ) : c.es_cuota_adulto_mayor ? (
                              <span className="px-1.5 py-0.5 border border-black bg-neutral-200 text-black text-[10px] font-bold">
                                ★ CUOTA 60+
                              </span>
                            ) : (
                              <span className="text-[10px] text-neutral-500">
                                General
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right whitespace-nowrap">
                            <button
                              type="button"
                              disabled={agendandoId === c.id}
                              onClick={() => handleAgendar(c.id)}
                              className="bg-black text-white hover:bg-neutral-800 border border-black px-3 py-1 text-xs font-mono uppercase font-bold tracking-wider transition-colors disabled:opacity-50"
                              title={idx < 9 ? `Atajo rápido: Alt + ${idx + 1}` : undefined}
                            >
                              {agendandoId === c.id ? (
                                "Asignando..."
                              ) : (
                                <span>
                                  Asignar Hora {idx < 9 && <span className="opacity-70 text-[10px] font-normal">[Alt+{idx + 1}]</span>} →
                                </span>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
