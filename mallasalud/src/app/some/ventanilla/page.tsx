"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatearRut, limpiarRut } from "@/lib/utils/rut";
import { estimarFechaNacimientoPorRut } from "@/lib/utils/edad";
import {
  MagnifyingGlassIcon,
  UserPlusIcon,
  PrinterIcon,
  ExclamationTriangleIcon,
  IdentificationIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

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
        setPaciente(null);
        setMostrarAltaRapida(true);
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
  const handleAgendar = useCallback(
    async (bloqueId: string) => {
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
    },
    [paciente]
  );

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
      if (e.key === "F2") {
        e.preventDefault();
        rutInputRef.current?.focus();
        rutInputRef.current?.select();
        return;
      }

      if (e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        handleNuevaAtencion();
        return;
      }

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
    <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 font-sans space-y-6">
      
      {/* Encabezado (oculto en impresión) */}
      <div className="print:hidden bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#21403A] rounded-3xl p-6 shadow-md space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#A7E3D4] border border-[#A7E3D4] dark:border-[#2A534B]">
              HU-006 • Mesón SOME
            </span>
            <span className="text-xs font-medium text-[#355C56] dark:text-[#9CC2BC]">
              Atención Presencial Ágil (&lt; 45s por paciente)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#132A26] dark:text-[#E8F5F2]">
            Ventanilla de Agendamiento Presencial
          </h1>
          <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] mt-1">
            Búsqueda en padrón comunal, alta rápida inmediata para nuevos vecinos, asignación de horas y emisión de ticket térmico.
          </p>
        </div>

        {/* Barra de Atajos de Teclado Ventanilla */}
        <div className="bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#264E46] rounded-2xl px-4 py-2.5 text-xs text-[#355C56] dark:text-[#9CC2BC] flex flex-wrap items-center justify-between gap-2">
          <span className="font-extrabold uppercase text-[#0F766E] dark:text-[#A7E3D4]">
            Atajos Rápidos de Teclado:
          </span>
          <div className="flex flex-wrap gap-3">
            <span>
              <kbd className="px-2 py-0.5 rounded-md bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#2A534B] font-mono font-bold text-[#132A26] dark:text-white">
                F2
              </kbd>{" "}
              Buscar RUT
            </span>
            <span>
              <kbd className="px-2 py-0.5 rounded-md bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#2A534B] font-mono font-bold text-[#132A26] dark:text-white">
                Alt + 1..9
              </kbd>{" "}
              Asignar Cupo
            </span>
            <span>
              <kbd className="px-2 py-0.5 rounded-md bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#2A534B] font-mono font-bold text-[#132A26] dark:text-white">
                Alt + N
              </kbd>{" "}
              Nueva Atención
            </span>
            <span>
              <kbd className="px-2 py-0.5 rounded-md bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#2A534B] font-mono font-bold text-[#132A26] dark:text-white">
                Ctrl + P
              </kbd>{" "}
              Imprimir Ticket
            </span>
          </div>
        </div>
      </div>

      {/* Si hay comprobante emitido, mostrar vista de Comprobante Imprimible */}
      {comprobante ? (
        <div className="max-w-md mx-auto my-4 animate-fadeIn">
          {/* Botones de acción (ocultos al imprimir) */}
          <div className="flex items-center justify-between gap-3 mb-6 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 bg-[#0F766E] hover:bg-[#115E59] text-white py-3 px-4 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <PrinterIcon className="w-4 h-4" />
              <span>Imprimir Ticket (PDF / Térmica)</span>
            </button>
            <button
              type="button"
              onClick={handleNuevaAtencion}
              className="border border-[#CDECE5] dark:border-[#264E46] bg-white dark:bg-[#122420] text-[#132A26] dark:text-[#D9F5EF] px-4 py-3 rounded-xl text-xs sm:text-sm font-bold hover:bg-[#F4FAF8] transition-colors cursor-pointer"
            >
              Nueva Atención [Alt+N]
            </button>
          </div>

          {/* Ticket Comprobante Oficial CESFAM */}
          <div className="print-ticket-container border-2 border-dashed border-[#0F766E] dark:border-[#5BB9A6] rounded-3xl p-6 bg-white dark:bg-[#122420] font-mono text-xs text-[#132A26] dark:text-[#E8F5F2] space-y-4 shadow-lg">
            <div className="text-center border-b border-[#CDECE5] dark:border-[#21403A] pb-3">
              <span className="font-extrabold text-sm uppercase block tracking-wider text-[#0F766E] dark:text-[#A7E3D4]">
                CESFAM MALLASALUD
              </span>
              <span className="text-[10px] text-[#355C56] dark:text-[#9CC2BC] uppercase block">
                Comprobante Oficial de Hora Médica
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">
                Canal: {comprobante.canal_origen}
              </span>
            </div>

            <div className="rounded-2xl border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] p-3.5 text-center">
              <span className="text-[10px] uppercase text-[#355C56] dark:text-[#9CC2BC] block">
                Código Único de Reserva
              </span>
              <span className="text-2xl font-black tracking-widest text-[#0F766E] dark:text-[#A7E3D4]">
                {comprobante.codigo_reserva}
              </span>
            </div>

            <div className="space-y-1.5 border-b border-[#CDECE5] dark:border-[#21403A] pb-3 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#355C56] dark:text-[#9CC2BC]">Fecha:</span>
                <strong>{comprobante.horario.fecha}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#355C56] dark:text-[#9CC2BC]">Hora de Atención:</span>
                <strong>{comprobante.horario.hora_inicio} hrs</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#355C56] dark:text-[#9CC2BC]">Especialidad:</span>
                <strong>{comprobante.profesional.especialidad.replace("_", " ")}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#355C56] dark:text-[#9CC2BC]">Box Asignado:</span>
                <strong>{comprobante.box.numero}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#355C56] dark:text-[#9CC2BC]">Profesional:</span>
                <strong>{comprobante.profesional.nombre_completo}</strong>
              </div>
            </div>

            <div className="space-y-1.5 border-b border-[#CDECE5] dark:border-[#21403A] pb-3 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#355C56] dark:text-[#9CC2BC]">Paciente:</span>
                <strong>{comprobante.paciente.nombre_completo}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#355C56] dark:text-[#9CC2BC]">RUT:</span>
                <strong>{comprobante.paciente.rut_formateado}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#355C56] dark:text-[#9CC2BC]">Teléfono SMS:</span>
                <strong>{comprobante.paciente.telefono}</strong>
              </div>
            </div>

            <div className="text-[10px] text-[#355C56] dark:text-[#9CC2BC] rounded-xl border border-[#CDECE5] dark:border-[#264E46] p-2.5">
              <span className="font-bold block uppercase mb-0.5 text-[#0F766E] dark:text-[#A7E3D4]">
                ✓ Notificación SMS Enviada:
              </span>
              <p className="italic leading-tight">{comprobante.notificacion_sms.mensaje}</p>
            </div>

            <div className="text-[10px] text-[#355C56] dark:text-[#9CC2BC] text-center pt-1 space-y-1">
              <p className="font-bold uppercase text-[#132A26] dark:text-white">
                Presentarse 15 minutos antes
              </p>
              <p>Con su Cédula de Identidad en la sala de espera correspondiente.</p>
              <p className="text-[9px] text-slate-400">
                Emisión: {new Date().toLocaleString("es-CL")}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Flujo Regular de Ventanilla SOME */
        <div className="space-y-6">
          
          {/* SECCIÓN 1: Búsqueda de Paciente */}
          <div className="bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#21403A] rounded-3xl p-6 shadow-md space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#132A26] dark:text-[#E8F5F2]">
                1. Identificación del Paciente en Mesón
              </h2>
              <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC]">
                Consulte el RUT en el padrón del CESFAM. Si no está inscrito, se habilitará el formulario de Alta Rápida.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                buscarPaciente();
              }}
              className="flex flex-wrap gap-3 max-w-xl"
            >
              <div className="relative flex-1 min-w-[220px]">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <IdentificationIcon className="w-5 h-5 text-[#0F766E] dark:text-[#5BB9A6]" />
                </div>
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
                  placeholder="RUT: 5.555.555-5 o 21.111.111-1 [F2]"
                  className="w-full pl-11 pr-4 py-3 bg-[#F4FAF8] dark:bg-[#0B1715] border-2 border-[#CDECE5] dark:border-[#264E46] rounded-xl text-sm font-mono font-bold text-[#132A26] dark:text-white tracking-wider focus:outline-none focus:border-[#0F766E]"
                />
              </div>
              <button
                type="submit"
                disabled={buscando}
                className="bg-[#0F766E] hover:bg-[#115E59] text-white px-5 py-3 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                <MagnifyingGlassIcon className="w-4 h-4" />
                <span>{buscando ? "Buscando..." : "Buscar Paciente"}</span>
              </button>
            </form>

            {/* Botones Rápidos de Prueba */}
            <div className="pt-3 border-t border-[#CDECE5] dark:border-[#21403A]">
              <span className="block text-[11px] text-[#355C56] dark:text-[#9CC2BC] uppercase font-extrabold mb-2">
                Perfiles de Prueba Rápida (Mesón SOME):
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => seleccionarRutPrueba("5555555-5")}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  ★ 60+: <strong className="font-mono">5.555.555-5</strong>
                </button>
                <button
                  type="button"
                  onClick={() => seleccionarRutPrueba("21111111-1")}
                  className="px-3 py-1.5 rounded-xl bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#264E46] text-[#132A26] dark:text-[#D9F5EF] hover:border-[#0F766E] transition-colors cursor-pointer"
                >
                  Joven: <strong className="font-mono">21.111.111-1</strong>
                </button>
                <button
                  type="button"
                  onClick={() => seleccionarRutPrueba("16666666-6")}
                  className="px-3 py-1.5 rounded-xl bg-[#F4FAF8] dark:bg-[#0B1715] border border-[#CDECE5] dark:border-[#264E46] text-[#132A26] dark:text-[#D9F5EF] hover:border-[#0F766E] transition-colors cursor-pointer"
                >
                  Con NSP: <strong className="font-mono">16.666.666-6</strong>
                </button>
                <button
                  type="button"
                  onClick={() => seleccionarRutPrueba("21222222-2")}
                  className="px-3 py-1.5 rounded-xl bg-[#D9F5EF]/50 dark:bg-[#1E3F3B]/60 border border-[#5BB9A6] text-[#0F766E] dark:text-[#A7E3D4] hover:bg-[#D9F5EF] transition-colors cursor-pointer"
                >
                  + Alta Rápida (Joven): <strong className="font-mono">21.222.222-2</strong>
                </button>
                <button
                  type="button"
                  onClick={() => seleccionarRutPrueba("6666666-6")}
                  className="px-3 py-1.5 rounded-xl bg-[#D9F5EF]/50 dark:bg-[#1E3F3B]/60 border border-[#5BB9A6] text-[#0F766E] dark:text-[#A7E3D4] hover:bg-[#D9F5EF] transition-colors cursor-pointer"
                >
                  + Alta Rápida (60+): <strong className="font-mono">6.666.666-6</strong>
                </button>
              </div>
            </div>

            {errorBusqueda && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 p-3.5 rounded-2xl text-xs text-red-800 dark:text-red-200 font-semibold">
                {errorBusqueda}
              </div>
            )}

            {/* Paciente Encontrado */}
            {paciente && (
              <div className="mt-4 border-2 border-[#5BB9A6] dark:border-[#2A534B] rounded-2xl p-5 bg-[#F4FAF8] dark:bg-[#0B1715] space-y-2 animate-fadeIn">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#0F766E] text-white">
                      ✓ Paciente Verificado
                    </span>
                    {paciente.es_adulto_mayor && (
                      <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-amber-400 bg-amber-100 text-amber-900">
                        ★ Adulto Mayor (&gt;= 60 Años)
                      </span>
                    )}
                    {paciente.contador_inasistencias > 0 && (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                        NSP Registradas: {paciente.contador_inasistencias}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPaciente(null)}
                    className="text-xs font-bold text-[#355C56] dark:text-[#9CC2BC] hover:text-red-600 underline cursor-pointer"
                  >
                    Cambiar Paciente
                  </button>
                </div>

                <div className="text-xl font-black text-[#132A26] dark:text-white">
                  {paciente.nombres} {paciente.apellidos}
                </div>

                <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC]">
                  <span>
                    RUT: <strong className="font-mono text-[#132A26] dark:text-white">{paciente.rut_formateado}</strong>
                  </span>
                  <span>
                    Edad: <strong className="text-[#132A26] dark:text-white">{paciente.edad} años</strong>
                  </span>
                  <span>
                    F. Nac: <strong className="font-mono text-[#132A26] dark:text-white">{paciente.fecha_nacimiento}</strong>
                  </span>
                  <span>
                    Teléfono: <strong className="font-mono text-[#132A26] dark:text-white">{paciente.telefono}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Formulario de Alta Rápida (cuando no está inscrito) */}
            {mostrarAltaRapida && (
              <div className="mt-4 border-2 border-amber-400 dark:border-amber-600 rounded-2xl p-5 sm:p-6 bg-amber-50/40 dark:bg-[#0B1715] space-y-4 animate-fadeIn">
                <div className="border-b border-[#CDECE5] dark:border-[#21403A] pb-3">
                  <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-white inline-flex items-center gap-1 mb-1">
                    <UserPlusIcon className="w-3.5 h-3.5" />
                    <span>Alta Rápida en Padrón Local SOME</span>
                  </span>
                  <h3 className="text-base font-extrabold text-[#132A26] dark:text-white">
                    Inscripción Inmediata de Paciente Nuevo
                  </h3>
                  <p className="text-xs text-[#355C56] dark:text-[#9CC2BC]">
                    El RUT no figura en la base local. Complete los datos básicos para enrolarlo y pasar directamente a asignarle hora.
                  </p>
                </div>

                {errorAlta && (
                  <div className="bg-red-50 border border-red-300 p-3 rounded-xl text-xs text-red-800 font-semibold">
                    {errorAlta}
                  </div>
                )}

                <form onSubmit={handleAltaRapidaSubmit} className="space-y-3.5 text-xs sm:text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">RUT</label>
                      <input
                        type="text"
                        value={rutBusqueda}
                        readOnly
                        className="w-full border border-[#CDECE5] dark:border-[#264E46] rounded-xl px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">
                        Teléfono Contacto (SMS)
                      </label>
                      <input
                        type="text"
                        value={altaTelefono}
                        onChange={(e) => setAltaTelefono(e.target.value)}
                        placeholder="+56912345678"
                        className="w-full border border-[#CDECE5] dark:border-[#264E46] bg-white dark:bg-[#122420] rounded-xl px-3.5 py-2.5 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">Nombres</label>
                      <input
                        type="text"
                        value={altaNombres}
                        onChange={(e) => setAltaNombres(e.target.value)}
                        placeholder="Ej: Juan Carlos"
                        className="w-full border border-[#CDECE5] dark:border-[#264E46] bg-white dark:bg-[#122420] rounded-xl px-3.5 py-2.5"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">Apellidos</label>
                      <input
                        type="text"
                        value={altaApellidos}
                        onChange={(e) => setAltaApellidos(e.target.value)}
                        placeholder="Ej: Pérez González"
                        className="w-full border border-[#CDECE5] dark:border-[#264E46] bg-white dark:bg-[#122420] rounded-xl px-3.5 py-2.5"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">
                      Fecha de Nacimiento (Sugerida según serie del RUT)
                    </label>
                    <input
                      type="date"
                      value={altaFechaNac}
                      onChange={(e) => setAltaFechaNac(e.target.value)}
                      className="w-full border border-[#CDECE5] dark:border-[#264E46] bg-white dark:bg-[#122420] rounded-xl px-3.5 py-2.5 font-mono"
                      required
                    />
                    <span className="text-[11px] text-[#355C56] dark:text-[#9CC2BC] italic block mt-1">
                      * Calculada preliminarmente según los millones del RUT para agilizar la atención en mesón.
                    </span>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="submit"
                      disabled={guardandoAlta}
                      className="flex-1 bg-[#0F766E] hover:bg-[#115E59] text-white py-3 rounded-xl font-bold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {guardandoAlta ? "Registrando en Padrón..." : "Inscribir Paciente y Proceder a Agendar →"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMostrarAltaRapida(false)}
                      className="px-4 py-3 rounded-xl border border-[#CDECE5] dark:border-[#264E46] font-bold hover:bg-slate-100 dark:hover:bg-[#17302B] cursor-pointer"
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
            <div className="bg-white dark:bg-[#122420] border border-[#CDECE5] dark:border-[#21403A] rounded-3xl p-6 shadow-md space-y-5 animate-fadeIn">
              <div className="border-b border-[#CDECE5] dark:border-[#21403A] pb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-extrabold text-[#132A26] dark:text-[#E8F5F2]">
                    2. Selección y Asignación de Cupo Disponible
                  </h2>
                  <p className="text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC]">
                    Use los botones o presione <kbd className="font-mono font-bold">Alt + 1..9</kbd> para asignar de inmediato.
                  </p>
                </div>
                <span className="text-xs font-bold bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#A7E3D4] px-3 py-1.5 rounded-xl">
                  Paciente: {paciente.nombres} {paciente.apellidos} ({paciente.es_adulto_mayor ? "★ 60+ Preferente" : "General"})
                </span>
              </div>

              {/* Filtros de Especialidad y Fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">
                    Especialidad Médica
                  </label>
                  <select
                    value={filtroEspecialidad}
                    onChange={(e) => setFiltroEspecialidad(e.target.value)}
                    className="w-full border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#0F766E]"
                  >
                    <option value="">Todas las especialidades</option>
                    <option value="MEDICINA_GENERAL">Medicina General</option>
                    <option value="DENTAL">Urgencia Dental</option>
                    <option value="MATRONERIA">Matronería</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E4640] dark:text-[#A7E3D4] mb-1">
                    Fecha de Atención
                  </label>
                  <input
                    type="date"
                    value={filtroFecha}
                    onChange={(e) => setFiltroFecha(e.target.value)}
                    className="w-full border border-[#CDECE5] dark:border-[#264E46] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#132A26] dark:text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold focus:outline-none focus:border-[#0F766E]"
                  />
                </div>
              </div>

              {errorAgendamiento && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 p-4 rounded-2xl text-xs sm:text-sm text-red-800 dark:text-red-200 font-semibold">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <span>{errorAgendamiento}</span>
                </div>
              )}

              {/* Tabla de Cupos Disponibles */}
              {cargandoCupos ? (
                <div className="py-12 text-center text-sm text-[#355C56] dark:text-[#9CC2BC] flex flex-col items-center gap-2">
                  <ArrowPathIcon className="w-7 h-7 animate-spin text-[#0F766E]" />
                  <span>Consultando disponibilidad de cupos...</span>
                </div>
              ) : cupos.length === 0 ? (
                <div className="py-12 text-center text-xs sm:text-sm text-[#355C56] dark:text-[#9CC2BC] border border-dashed border-[#CDECE5] dark:border-[#264E46] rounded-2xl">
                  No hay cupos disponibles para los filtros seleccionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[#CDECE5] dark:border-[#21403A] bg-[#F4FAF8] dark:bg-[#0B1715] text-[#1E4640] dark:text-[#A7E3D4]">
                        <th className="py-3 px-3 font-bold">Hora</th>
                        <th className="py-3 px-3 font-bold">Especialidad</th>
                        <th className="py-3 px-3 font-bold">Profesional</th>
                        <th className="py-3 px-3 font-bold">Box</th>
                        <th className="py-3 px-3 font-bold text-center">Tipo Cupo</th>
                        <th className="py-3 px-3 font-bold text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#CDECE5]/60 dark:divide-[#21403A]">
                      {cupos.map((c, idx) => (
                        <tr
                          key={c.id}
                          className={`hover:bg-[#F4FAF8]/80 dark:hover:bg-[#152B26]/60 transition-colors ${
                            c.es_cancelacion_reciente ? "bg-amber-50/40 dark:bg-amber-950/20" : ""
                          }`}
                        >
                          <td className="py-3 px-3 font-mono font-bold whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {idx < 9 && (
                                <span className="text-[10px] bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#A7E3D4] px-1.5 py-0.5 rounded font-mono font-bold">
                                  Alt+{idx + 1}
                                </span>
                              )}
                              <span className="text-[#132A26] dark:text-white">{c.hora_inicio} hrs</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap font-semibold">
                            {c.especialidad.replace("_", " ")}
                          </td>
                          <td className="py-3 px-3 text-[#132A26] dark:text-[#E8F5F2]">
                            {c.profesional.nombre_completo}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap font-semibold">
                            {c.box.numero}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              {c.es_cuota_adulto_mayor ? (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-400 text-[11px] font-extrabold">
                                  ★ Cuota 60+
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                                  General
                                </span>
                              )}
                              {c.es_cancelacion_reciente && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  ⚡ Liberado
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              disabled={agendandoId === c.id}
                              onClick={() => handleAgendar(c.id)}
                              className="bg-[#0F766E] hover:bg-[#115E59] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {agendandoId === c.id ? "Asignando..." : "Asignar Hora →"}
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
    </div>
  );
}
