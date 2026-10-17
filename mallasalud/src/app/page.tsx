"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { formatearRut, limpiarRut } from "@/lib/utils/rut";

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
  cuposDisponibles: number;
  cuposProtegidos60: number;
}

export default function PortalPacientePage() {
  const [rutInput, setRutInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noInscrito, setNoInscrito] = useState(false);
  const [mostrarModalNsp, setMostrarModalNsp] = useState(false);

  // Sesión activa del paciente autenticado
  const [pacienteActivo, setPacienteActivo] = useState<PacienteData | null>(null);
  const [especialidades, setEspecialidades] = useState<EspecialidadResumen[]>([]);
  const [cargandoCupos, setCargandoCupos] = useState(false);

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

  const consultarCuposEspecialidades = useCallback(async (esMayor: boolean) => {
    setCargandoCupos(true);
    try {
      const res = await fetch(`/api/v1/some/cupos-disponibles?es_adulto_mayor=${esMayor}`);
      if (!res.ok) throw new Error("No fue posible cargar cupos");
      const data = await res.json();
      interface CupoItem {
        especialidad: string;
        es_cuota_adulto_mayor: boolean;
      }
      const cupos: CupoItem[] = data.cupos || [];

      const lista: EspecialidadResumen[] = [
        {
          nombre: "Medicina General",
          codigo: "MEDICINA_GENERAL",
          cuposDisponibles: cupos.filter((c) => c.especialidad === "MEDICINA_GENERAL").length,
          cuposProtegidos60: cupos.filter(
            (c) => c.especialidad === "MEDICINA_GENERAL" && c.es_cuota_adulto_mayor
          ).length,
        },
        {
          nombre: "Urgencia Dental",
          codigo: "DENTAL",
          cuposDisponibles: cupos.filter((c) => c.especialidad === "DENTAL").length,
          cuposProtegidos60: cupos.filter(
            (c) => c.especialidad === "DENTAL" && c.es_cuota_adulto_mayor
          ).length,
        },
        {
          nombre: "Matronería",
          codigo: "MATRONERIA",
          cuposDisponibles: cupos.filter((c) => c.especialidad === "MATRONERIA").length,
          cuposProtegidos60: cupos.filter(
            (c) => c.especialidad === "MATRONERIA" && c.es_cuota_adulto_mayor
          ).length,
        },
      ];
      setEspecialidades(lista);
    } catch {
      // Fallback visual
      setEspecialidades([]);
    } finally {
      setCargandoCupos(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNoInscrito(false);

    if (!rutInput.trim()) {
      setErrorMsg("Por favor ingrese su RUT.");
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

      // Si tiene inasistencias previas, mostrar modal educativo de concientización
      if (paciente.tiene_inasistencias) {
        setMostrarModalNsp(true);
      }

      setPacienteActivo(paciente);
      consultarCuposEspecialidades(paciente.es_adulto_mayor);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error de conexión con el servidor.";
      setErrorMsg(msg);
    } finally {
      setCargando(false);
    }
  };

  const handleCerrarSesion = () => {
    setPacienteActivo(null);
    setRutInput("");
    setNoInscrito(false);
    setErrorMsg(null);
    setMostrarModalNsp(false);
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Encabezado */}
      <div className="border-b-2 border-black pb-4 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs uppercase px-2 py-0.5 bg-neutral-200 text-black border border-black">
            HU-001
          </span>
          <span className="text-xs font-mono text-neutral-600">
            Sprint 1 • Entregable Validación de Identidad
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-black uppercase">
          Portal de Agendamiento Web CESFAM
        </h1>
        <p className="text-sm text-neutral-600 mt-1">
          Identificación de usuarios inscritos en el padrón local con priorización de Adulto Mayor.
        </p>
      </div>

      {!pacienteActivo ? (
        /* Formulario de Identificación */
        <div className="max-w-lg mx-auto">
          <div className="border-2 border-black p-6 bg-white shadow-sm">
            <h2 className="text-lg font-bold uppercase tracking-tight text-black mb-1">
              Ingrese su RUT
            </h2>
            <p className="text-xs text-neutral-600 mb-6 font-mono">
              Para verificar su inscripción y consultar disponibilidad de horas.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="rutInput"
                  className="block text-xs font-mono font-bold uppercase mb-1"
                >
                  RUT del Paciente (con o sin puntos/guion)
                </label>
                <input
                  id="rutInput"
                  type="text"
                  inputMode="numeric"
                  value={rutInput}
                  onChange={handleRutChange}
                  placeholder="Ej: 21.111.111-1 o 5.555.555-5"
                  className="w-full border-2 border-black px-4 py-2.5 text-lg font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-black"
                  autoFocus
                />
              </div>

              {/* Mensaje de RUT Inválido (400) */}
              {errorMsg && (
                <div className="border border-black bg-neutral-100 p-3 text-xs font-mono">
                  <span className="font-bold uppercase">[!] ERROR DE FORMATO:</span> {errorMsg}
                </div>
              )}

              {/* Mensaje de Paciente No Inscrito (404) */}
              {noInscrito && (
                <div className="border-2 border-black bg-white p-4 space-y-2">
                  <div className="font-bold text-xs uppercase font-mono text-black">
                    [!] PACIENTE NO REGISTRADO EN PADRÓN
                  </div>
                  <p className="text-xs text-neutral-700">
                    El RUT <strong>{rutInput}</strong> no figura inscrito en este establecimiento de salud (CESFAM).
                  </p>
                  <p className="text-xs text-neutral-600">
                    Debe acudir presencialmente a la <strong>Ventanilla del SOME</strong> para realizar su inscripción inicial y validar su previsión Fonasa.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/some/ventanilla"
                      className="inline-block text-xs font-mono uppercase px-3 py-1.5 border border-black bg-neutral-100 hover:bg-black hover:text-white transition-colors"
                    >
                      Ir a Ventanilla SOME para Regularizar →
                    </Link>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={cargando}
                className="w-full bg-black text-white hover:bg-neutral-800 border-2 border-black py-3 text-xs font-mono uppercase font-bold tracking-wider transition-colors disabled:opacity-50"
              >
                {cargando ? "Verificando en Padrón..." : "Verificar RUT y Continuar →"}
              </button>
            </form>

            {/* Panel de Ayuda Rápida para Testing */}
            <div className="mt-8 pt-6 border-t border-neutral-300">
              <span className="block text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-500 mb-2.5">
                Accesos Directos de Prueba (Casos Sprint 1):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => seleccionarRutPrueba("21111111-1")}
                  className="border border-black px-2.5 py-1.5 text-left hover:bg-neutral-100 transition-colors"
                >
                  <span className="font-bold">21.111.111-1</span>
                  <span className="block text-[10px] text-neutral-500">Joven (24a, 0 NSP)</span>
                </button>

                <button
                  type="button"
                  onClick={() => seleccionarRutPrueba("5555555-5")}
                  className="border border-black px-2.5 py-1.5 text-left hover:bg-neutral-100 transition-colors"
                >
                  <span className="font-bold">5.555.555-5</span>
                  <span className="block text-[10px] text-neutral-500">Adulto Mayor (75a, 60+)</span>
                </button>

                <button
                  type="button"
                  onClick={() => seleccionarRutPrueba("16666666-6")}
                  className="border border-black px-2.5 py-1.5 text-left hover:bg-neutral-100 transition-colors"
                >
                  <span className="font-bold">16.666.666-6</span>
                  <span className="block text-[10px] text-neutral-500">Con NSP (2 Inasistencias)</span>
                </button>

                <button
                  type="button"
                  onClick={() => seleccionarRutPrueba("21222222-2")}
                  className="border border-black px-2.5 py-1.5 text-left hover:bg-neutral-100 transition-colors"
                >
                  <span className="font-bold">21.222.222-2</span>
                  <span className="block text-[10px] text-neutral-500">No Inscrito (404)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Vista de Sesión Activa del Paciente (Entregable Sprint 1) */
        <div className="space-y-6">
          {/* Tarjeta de Identificación del Paciente */}
          <div className="border-2 border-black p-6 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-xs font-mono uppercase px-2 py-0.5 bg-black text-white font-bold">
                  Paciente Inscrito
                </span>
                {pacienteActivo.es_adulto_mayor && (
                  <span className="text-xs font-mono uppercase px-2 py-0.5 bg-neutral-200 text-black border border-black font-bold">
                    ★ PRIORIDAD ADULTO MAYOR (&gt;= 60 AÑOS)
                  </span>
                )}
                {pacienteActivo.tiene_inasistencias && (
                  <span className="text-xs font-mono uppercase px-2 py-0.5 border border-black text-black">
                    NSP Registradas: {pacienteActivo.contador_inasistencias}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold uppercase tracking-tight text-black">
                {pacienteActivo.nombre_completo}
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-neutral-600 mt-2">
                <span>RUT: <strong>{pacienteActivo.rut_formateado}</strong></span>
                <span>Edad: <strong>{pacienteActivo.edad} años</strong></span>
                <span>F. Nacimiento: <strong>{pacienteActivo.fecha_nacimiento}</strong></span>
                <span>Tel: <strong>{pacienteActivo.telefono}</strong></span>
              </div>
            </div>

            <div className="self-start md:self-auto">
              <button
                onClick={handleCerrarSesion}
                className="text-xs font-mono uppercase px-3 py-2 border border-black hover:bg-black hover:text-white transition-colors"
              >
                Cerrar Sesión / Cambiar RUT
              </button>
            </div>
          </div>

          {/* Banner de Prioridad Etaria */}
          {pacienteActivo.es_adulto_mayor ? (
            <div className="border border-black bg-neutral-50 p-4 text-xs font-mono">
              <strong>[INFORMACIÓN PREFERENTE]:</strong> Al ser beneficiario de cuota preferente de Adulto Mayor,
              usted tiene acceso reservado al 30% de cupos protegidos por ley en Medicina General.
            </div>
          ) : (
            <div className="border border-neutral-300 bg-white p-3 text-xs font-mono text-neutral-600">
              Usted visualiza los cupos generales disponibles de la jornada médica.
            </div>
          )}

          {/* Consulta de Especialidades y Cupos (Puente a HU-002) */}
          <div className="border-2 border-black p-6 bg-white">
            <div className="flex items-center justify-between border-b border-black pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
                  Especialidades Disponibles en CESFAM
                </h3>
                <p className="text-xs text-neutral-600">
                  Seleccione una especialidad para visualizar los cupos habilitados por SOME.
                </p>
              </div>
              <span className="text-xs font-mono text-neutral-500">
                {cargandoCupos ? "Consultando disponibilidad..." : "Estado en vivo"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {especialidades.map((esp) => (
                <div
                  key={esp.codigo}
                  className="border border-black p-4 flex flex-col justify-between hover:border-neutral-600 transition-colors"
                >
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block mb-1">
                      {esp.codigo}
                    </span>
                    <h4 className="text-base font-bold uppercase tracking-tight text-black mb-2">
                      {esp.nombre}
                    </h4>

                    <div className="space-y-1 font-mono text-xs text-neutral-700 pt-2 border-t border-neutral-200">
                      <div className="flex justify-between">
                        <span>Cupos Habilitados:</span>
                        <strong>{esp.cuposDisponibles}</strong>
                      </div>
                      {pacienteActivo.es_adulto_mayor && (
                        <div className="flex justify-between text-[11px] text-neutral-600">
                          <span>Cuota protegida (60+):</span>
                          <strong>{esp.cuposProtegidos60}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3">
                    <button
                      type="button"
                      disabled={esp.cuposDisponibles === 0}
                      onClick={() =>
                        alert(
                          `Especialidad ${esp.nombre} seleccionada. La selección de horario específico y confirmación con código de reserva corresponde a la Historia HU-002 (Próximo Sprint).`
                        )
                      }
                      className="w-full text-xs font-mono uppercase py-2 border border-black bg-white hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-black font-semibold"
                    >
                      {esp.cuposDisponibles > 0 ? "Ver Horarios Disponibles →" : "Sin cupos en la jornada"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Educativo de Inasistencias (NSP) - HU-001 */}
      {mostrarModalNsp && pacienteActivo && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-black pb-2">
              <span className="text-xs font-mono uppercase px-2 py-0.5 bg-black text-white font-bold">
                [!] AVISO INFORMATIVO
              </span>
              <span className="text-xs font-mono text-neutral-600">
                Compromiso Asistencial CESFAM
              </span>
            </div>

            <h3 className="text-lg font-bold uppercase tracking-tight text-black">
              Registro de Inasistencias Previas
            </h3>

            <p className="text-xs text-neutral-700 leading-relaxed">
              Estimado/a <strong>{pacienteActivo.nombre_completo}</strong>, nuestro sistema registra que usted cuenta con{" "}
              <strong>{pacienteActivo.contador_inasistencias} inasistencia(s) previa(s)</strong> no justificadas en citas anteriores.
            </p>

            <div className="border border-black bg-neutral-50 p-3 text-xs font-mono space-y-1 text-neutral-800">
              <p className="font-bold">IMPORTANTE:</p>
              <p>
                Los cupos de atención en salud pública son limitados. Si no puede asistir a su consulta médica, recuerde cancelar con al menos{" "}
                <strong>30 minutos de anticipación</strong> a través de nuestra web o teléfono para que otro vecino pueda atenderse.
              </p>
            </div>

            <p className="text-[11px] text-neutral-500 font-mono italic">
              * Este aviso es de carácter educativo y no limita su derecho a solicitar atención médica.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setMostrarModalNsp(false)}
                className="w-full bg-black text-white hover:bg-neutral-800 border border-black py-2.5 text-xs font-mono uppercase font-bold tracking-wider transition-colors"
              >
                Entendido, continuar a la reserva →
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
