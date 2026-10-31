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
import "./ventanilla.css";

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
    <div className="ventanilla-page">

      {/* Encabezado (oculto en impresión) */}
      <div className="ventanilla-header-card">
        <div>
          <div className="ventanilla-badge-row">
            <span className="ventanilla-hu-badge">
              HU-006 • Mesón SOME
            </span>
            <span className="ventanilla-hu-subtitle">
              Módulo de Recepción SOME · Atención Presencial
            </span>
          </div>
          <h1 className="ventanilla-title">
            Ventanilla de Agendamiento Presencial
          </h1>
          <p className="ventanilla-subtitle">
            Búsqueda en padrón comunal, inscripción inmediata para nuevos vecinos, asignación de horas y emisión de comprobante.
          </p>
        </div>
      </div>

      {/* Si hay comprobante emitido, mostrar vista de Comprobante Imprimible */}
      {comprobante ? (
          <div className="ventanilla-ticket-wrapper">
            {/* Botones de acción (ocultos al imprimir) */}
            <div className="ventanilla-ticket-actions">
              <button
                type="button"
                onClick={() => window.print()}
                className="ventanilla-btn-print"
              >
                <PrinterIcon className="ventanilla-icon-sm" />
                <span>Imprimir Ticket (PDF / Térmica)</span>
              </button>
              <button
                type="button"
                onClick={handleNuevaAtencion}
                className="ventanilla-btn-new"
              >
                Nueva Atención [Alt+N]
              </button>
            </div>

            {/* Ticket Comprobante Oficial CESFAM */}
            <div className="print-ticket-container ventanilla-ticket-card">
              <div className="ventanilla-ticket-header">
                <span className="ventanilla-ticket-org">
                  CESFAM MALLASALUD
                </span>
                <span className="ventanilla-ticket-doc">
                  Comprobante Oficial de Hora Médica
                </span>
                <span className="ventanilla-ticket-channel">
                  Canal: {comprobante.canal_origen}
                </span>
              </div>

              <div className="ventanilla-ticket-code-box">
                <span className="ventanilla-ticket-code-label">
                  Código Único de Reserva
                </span>
                <span className="ventanilla-ticket-code-value">
                  {comprobante.codigo_reserva}
                </span>
              </div>

              <div className="ventanilla-ticket-section">
                <div className="ventanilla-ticket-row">
                  <span className="ventanilla-ticket-label">Fecha:</span>
                  <strong>{comprobante.horario.fecha}</strong>
                </div>
                <div className="ventanilla-ticket-row">
                  <span className="ventanilla-ticket-label">Hora de Atención:</span>
                  <strong>{comprobante.horario.hora_inicio} hrs</strong>
                </div>
                <div className="ventanilla-ticket-row">
                  <span className="ventanilla-ticket-label">Especialidad:</span>
                  <strong>{comprobante.profesional.especialidad.replace("_", " ")}</strong>
                </div>
                <div className="ventanilla-ticket-row">
                  <span className="ventanilla-ticket-label">Box Asignado:</span>
                  <strong>{comprobante.box.numero}</strong>
                </div>
                <div className="ventanilla-ticket-row">
                  <span className="ventanilla-ticket-label">Profesional:</span>
                  <strong>{comprobante.profesional.nombre_completo}</strong>
                </div>
              </div>

              <div className="ventanilla-ticket-section">
                <div className="ventanilla-ticket-row">
                  <span className="ventanilla-ticket-label">Paciente:</span>
                  <strong>{comprobante.paciente.nombre_completo}</strong>
                </div>
                <div className="ventanilla-ticket-row">
                  <span className="ventanilla-ticket-label">RUT:</span>
                  <strong>{comprobante.paciente.rut_formateado}</strong>
                </div>
                <div className="ventanilla-ticket-row">
                  <span className="ventanilla-ticket-label">Teléfono SMS:</span>
                  <strong>{comprobante.paciente.telefono}</strong>
                </div>
              </div>

              <div className="ventanilla-ticket-sms-box">
                <span className="ventanilla-ticket-sms-title">
                  ✓ Notificación SMS Enviada:
                </span>
                <p className="ventanilla-ticket-sms-body">{comprobante.notificacion_sms.mensaje}</p>
              </div>

              <div className="ventanilla-ticket-footer">
                <p className="ventanilla-ticket-footer-strong">
                  Presentarse 15 minutos antes
                </p>
                <p>Con su Cédula de Identidad en la sala de espera correspondiente.</p>
                <p className="ventanilla-ticket-timestamp">
                  Emisión: {new Date().toLocaleString("es-CL")}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Flujo Regular de Ventanilla SOME */
          <div className="ventanilla-flow">

            {/* SECCIÓN 1: Búsqueda de Paciente */}
            <div className="ventanilla-section-card">
              <div>
                <h2 className="ventanilla-section-title">
                  1. Identificación del Paciente en Mesón
                </h2>
                <p className="ventanilla-section-desc">
                  Consulte el RUT en el padrón del CESFAM. Si no está inscrito, se habilitará el formulario de Alta Rápida.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  buscarPaciente();
                }}
                className="ventanilla-search-form"
              >
                <div className="ventanilla-search-input-wrap">
                  <div className="ventanilla-search-icon-wrap">
                    <IdentificationIcon className="ventanilla-search-icon" />
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
                    className="ventanilla-search-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={buscando}
                  className="ventanilla-search-btn"
                >
                  <MagnifyingGlassIcon className="ventanilla-icon-sm" />
                  <span>{buscando ? "Buscando..." : "Buscar Paciente"}</span>
                </button>
              </form>

              {/* Botones Rápidos de Prueba */}
              <div className="ventanilla-demo-wrap">
                <span className="ventanilla-demo-label">
                  Perfiles de Prueba Rápida (Mesón SOME):
                </span>
                <div className="ventanilla-demo-buttons">
                  <button
                    type="button"
                    onClick={() => seleccionarRutPrueba("5555555-5")}
                    className="ventanilla-demo-btn-senior"
                  >
                    ★ 60+: <strong className="ventanilla-demo-rut">5.555.555-5</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => seleccionarRutPrueba("21111111-1")}
                    className="ventanilla-demo-btn-normal"
                  >
                    Joven: <strong className="ventanilla-demo-rut">21.111.111-1</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => seleccionarRutPrueba("16666666-6")}
                    className="ventanilla-demo-btn-normal"
                  >
                    Con NSP: <strong className="ventanilla-demo-rut">16.666.666-6</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => seleccionarRutPrueba("21222222-2")}
                    className="ventanilla-demo-btn-alta"
                  >
                    + Alta Rápida (Joven): <strong className="ventanilla-demo-rut">21.222.222-2</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => seleccionarRutPrueba("6666666-6")}
                    className="ventanilla-demo-btn-alta"
                  >
                    + Alta Rápida (60+): <strong className="ventanilla-demo-rut">6.666.666-6</strong>
                  </button>
                </div>
              </div>

              {errorBusqueda && (
                <div className="ventanilla-error-box">
                  {errorBusqueda}
                </div>
              )}

              {/* Paciente Encontrado */}
              {paciente && (
                <div className="ventanilla-patient-card">
                  <div className="ventanilla-patient-top">
                    <div className="ventanilla-patient-badges">
                      <span className="ventanilla-badge-verified">
                        ✓ Paciente Verificado
                      </span>
                      {paciente.es_adulto_mayor && (
                        <span className="ventanilla-badge-senior">
                          ★ Adulto Mayor (&gt;= 60 Años)
                        </span>
                      )}
                      {paciente.contador_inasistencias > 0 && (
                        <span className="ventanilla-badge-nsp">
                          NSP Registradas: {paciente.contador_inasistencias}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaciente(null)}
                      className="ventanilla-patient-change-btn"
                    >
                      Cambiar Paciente
                    </button>
                  </div>

                  <div className="ventanilla-patient-name">
                    {paciente.nombres} {paciente.apellidos}
                  </div>

                  <div className="ventanilla-patient-meta">
                    <span>
                      RUT: <strong className="ventanilla-patient-meta-mono">{paciente.rut_formateado}</strong>
                    </span>
                    <span>
                      Edad: <strong className="ventanilla-patient-meta-val">{paciente.edad} años</strong>
                    </span>
                    <span>
                      F. Nac: <strong className="ventanilla-patient-meta-mono">{paciente.fecha_nacimiento}</strong>
                    </span>
                    <span>
                      Teléfono: <strong className="ventanilla-patient-meta-mono">{paciente.telefono}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Formulario de Alta Rápida (cuando no está inscrito) */}
              {mostrarAltaRapida && (
                <div className="ventanilla-alta-card">
                  <div className="ventanilla-alta-header">
                    <span className="ventanilla-alta-badge">
                      <UserPlusIcon className="ventanilla-alta-icon" />
                      <span>Alta Rápida en Padrón Local SOME</span>
                    </span>
                    <h3 className="ventanilla-alta-title">
                      Inscripción Inmediata de Paciente Nuevo
                    </h3>
                    <p className="ventanilla-alta-desc">
                      El RUT no figura en la base local. Complete los datos básicos para enrolarlo y pasar directamente a asignarle hora.
                    </p>
                  </div>

                  {errorAlta && (
                    <div className="ventanilla-error-box">
                      {errorAlta}
                    </div>
                  )}

                  <form onSubmit={handleAltaRapidaSubmit} className="ventanilla-alta-form">
                    <div className="ventanilla-form-grid">
                      <div>
                        <label className="ventanilla-field-label">RUT</label>
                        <input
                          type="text"
                          value={rutBusqueda}
                          readOnly
                          className="ventanilla-input-readonly"
                        />
                      </div>
                      <div>
                        <label className="ventanilla-field-label">
                          Teléfono Contacto (SMS)
                        </label>
                        <input
                          type="text"
                          value={altaTelefono}
                          onChange={(e) => setAltaTelefono(e.target.value)}
                          placeholder="+56912345678"
                          className="ventanilla-input-mono"
                          required
                        />
                      </div>
                    </div>

                    <div className="ventanilla-form-grid">
                      <div>
                        <label className="ventanilla-field-label">Nombres</label>
                        <input
                          type="text"
                          value={altaNombres}
                          onChange={(e) => setAltaNombres(e.target.value)}
                          placeholder="Ej: Juan Carlos"
                          className="ventanilla-input-text"
                          required
                        />
                      </div>
                      <div>
                        <label className="ventanilla-field-label">Apellidos</label>
                        <input
                          type="text"
                          value={altaApellidos}
                          onChange={(e) => setAltaApellidos(e.target.value)}
                          placeholder="Ej: Pérez González"
                          className="ventanilla-input-text"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="ventanilla-field-label">
                        Fecha de Nacimiento (Sugerida según serie del RUT)
                      </label>
                      <input
                        type="date"
                        value={altaFechaNac}
                        onChange={(e) => setAltaFechaNac(e.target.value)}
                        className="ventanilla-input-mono"
                        required
                      />
                      <span className="ventanilla-field-hint">
                        * Calculada preliminarmente según los millones del RUT para agilizar la atención en mesón.
                      </span>
                    </div>

                    <div className="ventanilla-alta-actions">
                      <button
                        type="submit"
                        disabled={guardandoAlta}
                        className="ventanilla-alta-submit-btn"
                      >
                        {guardandoAlta ? "Registrando en Padrón..." : "Inscribir Paciente y Proceder a Agendar →"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMostrarAltaRapida(false)}
                        className="ventanilla-alta-cancel-btn"
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
              <div className="ventanilla-section-card-animated">
                <div className="ventanilla-cupos-header">
                  <div>
                    <h2 className="ventanilla-section-title">
                      2. Selección y Asignación de Cupo Disponible
                    </h2>
                    <p className="ventanilla-section-desc">
                      Use los botones o presione <kbd className="ventanilla-cupos-kbd">Alt + 1..9</kbd> para asignar de inmediato.
                    </p>
                  </div>
                  <span className="ventanilla-cupos-patient-pill">
                    Paciente: {paciente.nombres} {paciente.apellidos} ({paciente.es_adulto_mayor ? "★ 60+ Preferente" : "General"})
                  </span>
                </div>

                {/* Filtros de Especialidad y Fecha */}
                <div className="ventanilla-filters-grid">
                  <div>
                    <label className="ventanilla-field-label-sm">
                      Especialidad Médica
                    </label>
                    <select
                      value={filtroEspecialidad}
                      onChange={(e) => setFiltroEspecialidad(e.target.value)}
                      className="ventanilla-select"
                    >
                      <option value="">Todas las especialidades</option>
                      <option value="MEDICINA_GENERAL">Medicina General</option>
                      <option value="DENTAL">Urgencia Dental</option>
                      <option value="MATRONERIA">Matronería</option>
                    </select>
                  </div>

                  <div>
                    <label className="ventanilla-field-label-sm">
                      Fecha de Atención
                    </label>
                    <input
                      type="date"
                      value={filtroFecha}
                      onChange={(e) => setFiltroFecha(e.target.value)}
                      className="ventanilla-date-input"
                    />
                  </div>
                </div>

                {errorAgendamiento && (
                  <div className="ventanilla-error-alert">
                    <ExclamationTriangleIcon className="ventanilla-error-icon" />
                    <span>{errorAgendamiento}</span>
                  </div>
                )}

                {/* Tabla de Cupos Disponibles */}
                {cargandoCupos ? (
                  <div className="ventanilla-loading-state">
                    <ArrowPathIcon className="ventanilla-loading-spinner" />
                    <span>Consultando disponibilidad de cupos...</span>
                  </div>
                ) : cupos.length === 0 ? (
                  <div className="ventanilla-empty-state">
                    No hay cupos disponibles para los filtros seleccionados.
                  </div>
                ) : (
                  <>
                    {/* Vista Móvil: Tarjetas de Cupos (< md) */}
                    <div className="ventanilla-mobile-cupos-list">
                      {cupos.map((c, idx) => (
                        <div
                          key={c.id}
                          className={
                            c.es_cancelacion_reciente
                              ? "ventanilla-mobile-cupo-card-recent"
                              : "ventanilla-mobile-cupo-card"
                          }
                        >
                          <div className="ventanilla-mobile-cupo-top">
                            <div className="ventanilla-hora-cell">
                              {idx < 9 && (
                                <span className="ventanilla-shortcut-badge">
                                  Alt+{idx + 1}
                                </span>
                              )}
                              <span className="ventanilla-hora-text">{c.hora_inicio} hrs</span>
                            </div>
                            <div className="ventanilla-cupo-badges">
                              {c.es_cuota_adulto_mayor ? (
                                <span className="ventanilla-cupo-badge-senior">
                                  ★ Cuota 60+
                                </span>
                              ) : (
                                <span className="ventanilla-cupo-badge-general">
                                  General
                                </span>
                              )}
                              {c.es_cancelacion_reciente && (
                                <span className="ventanilla-cupo-badge-freed">
                                  ⚡ Liberado
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="ventanilla-td-strong">
                              {c.especialidad.replace("_", " ")} · {c.box.numero}
                            </p>
                            <p className="ventanilla-td-prof">
                              {c.profesional.nombre_completo}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={agendandoId === c.id}
                            onClick={() => handleAgendar(c.id)}
                            className="ventanilla-assign-btn"
                          >
                            {agendandoId === c.id ? "Asignando..." : "Asignar Hora →"}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Vista Escritorio: Tabla de Cupos (>= md) */}
                    <div className="ventanilla-table-wrap">
                      <table className="ventanilla-table">
                        <thead>
                          <tr className="ventanilla-table-head-row">
                            <th className="ventanilla-th">Hora</th>
                            <th className="ventanilla-th">Especialidad</th>
                            <th className="ventanilla-th">Profesional</th>
                            <th className="ventanilla-th">Box</th>
                            <th className="ventanilla-th-center">Tipo Cupo</th>
                            <th className="ventanilla-th-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="ventanilla-tbody">
                          {cupos.map((c, idx) => (
                            <tr
                              key={c.id}
                              className={
                                c.es_cancelacion_reciente ? "ventanilla-tr-recent" : "ventanilla-tr"
                              }
                            >
                              <td className="ventanilla-td-hora">
                                <div className="ventanilla-hora-cell">
                                  {idx < 9 && (
                                    <span className="ventanilla-shortcut-badge">
                                      Alt+{idx + 1}
                                    </span>
                                  )}
                                  <span className="ventanilla-hora-text">{c.hora_inicio} hrs</span>
                                </div>
                              </td>
                              <td className="ventanilla-td-strong">
                                {c.especialidad.replace("_", " ")}
                              </td>
                              <td className="ventanilla-td-prof">
                                {c.profesional.nombre_completo}
                              </td>
                              <td className="ventanilla-td-strong">
                                {c.box.numero}
                              </td>
                              <td className="ventanilla-td-center">
                                <div className="ventanilla-cupo-badges">
                                  {c.es_cuota_adulto_mayor ? (
                                    <span className="ventanilla-cupo-badge-senior">
                                      ★ Cuota 60+
                                    </span>
                                  ) : (
                                    <span className="ventanilla-cupo-badge-general">
                                      General
                                    </span>
                                  )}
                                  {c.es_cancelacion_reciente && (
                                    <span className="ventanilla-cupo-badge-freed">
                                      ⚡ Liberado
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="ventanilla-td-right">
                                <button
                                  type="button"
                                  disabled={agendandoId === c.id}
                                  onClick={() => handleAgendar(c.id)}
                                  className="ventanilla-assign-btn"
                                >
                                  {agendandoId === c.id ? "Asignando..." : "Asignar Hora →"}
                                </button>
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
          </div>
        )}
    </div>
  );
}
