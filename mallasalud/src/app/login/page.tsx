"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LockClosedIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import "./login.css";

export default function LoginPage() {
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setCargando(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identificador, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Credenciales incorrectas.");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const nextParam = params.get("next");
      let destination = data.redirectTo || "/some/agendas";

      if (nextParam && nextParam.startsWith("/")) {
        if (
          data.user?.rol === "SOME" &&
          (nextParam.startsWith("/some") || nextParam.startsWith("/ivr"))
        ) {
          destination = nextParam;
        } else if (data.user?.rol === "PROFESIONAL" && nextParam.startsWith("/doctor")) {
          destination = nextParam;
        }
      }

      window.location.assign(destination);
    } catch {
      setErrorMsg("Error de conexión al intentar iniciar sesión.");
    } finally {
      setCargando(false);
    }
  };

  const rellenarDemo = (id: string, pass: string) => {
    setIdentificador(id);
    setPassword(pass);
    setErrorMsg(null);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="flex items-center justify-between gap-2">
          <div className="login-brand">
            <div className="login-logo-box">
              <Image
                src="/logo-mallasalud.png"
                alt="MallaSalud Logo"
                width={36}
                height={36}
                style={{ width: "auto", height: "auto" }}
                className="object-contain max-w-full max-h-full"
              />
            </div>
            <div>
              <h1 className="login-title">
                MALLA<span className="text-teal-primary dark:text-teal-accent">SALUD</span>
              </h1>
              <p className="login-subtitle">Intranet Funcionarios CESFAM</p>
            </div>
          </div>

          <Link
            href="/"
            className="text-xs font-medium text-teal-primary dark:text-teal-accent hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Portal Paciente
          </Link>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark-bg border border-border-subtle dark:border-border-dark text-xs text-text-muted dark:text-text-dark-muted">
          Acceso restringido a personal administrativo <strong>SOME</strong> (Agendas, Ventanilla y Monitor Telefónico IVR) y <strong>Profesionales de Salud</strong> en Box Clínico.
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div>
            <label htmlFor="login-identificador" className="login-label">
              Correo Institucional o RUT
            </label>
            <input
              id="login-identificador"
              type="text"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              placeholder="Ej: some@cesfam.cl o 14258369-0"
              className="login-input"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="login-label">
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingrese su contraseña"
              className="login-input"
              required
              autoComplete="current-password"
            />
          </div>

          {errorMsg && (
            <div id="login-error-box" className="login-error" role="alert">
              {errorMsg}
            </div>
          )}

          <button
            id="btn-login-submit"
            type="submit"
            disabled={cargando}
            className="login-submit"
          >
            <LockClosedIcon className="w-4 h-4" />
            <span>{cargando ? "Verificando acceso..." : "Ingresar a Intranet"}</span>
          </button>
        </form>

        <details className="login-details">
          <summary className="login-details-summary">
            Credenciales de evaluación (Modo Demo)
          </summary>
          <div className="mt-2.5 space-y-1.5">
            <button
              type="button"
              onClick={() => rellenarDemo("some@cesfam.cl", "Some2026!")}
              className="login-demo-btn"
            >
              <span>
                <strong className="text-teal-primary dark:text-teal-accent">SOME Admin:</strong>{" "}
                some@cesfam.cl
              </span>
              <span className="font-mono text-[10px] text-text-subtle">Some2026!</span>
            </button>
            <button
              type="button"
              onClick={() => rellenarDemo("carlos.munoz@cesfam.cl", "Doctor2026!")}
              className="login-demo-btn"
            >
              <span>
                <strong className="text-teal-primary dark:text-teal-accent">Box 101 Médico:</strong>{" "}
                carlos.munoz@cesfam.cl
              </span>
              <span className="font-mono text-[10px] text-text-subtle">Doctor2026!</span>
            </button>
            <button
              type="button"
              onClick={() => rellenarDemo("valentina.silva@cesfam.cl", "Doctor2026!")}
              className="login-demo-btn"
            >
              <span>
                <strong className="text-teal-primary dark:text-teal-accent">Box 102 Médico:</strong>{" "}
                valentina.silva@cesfam.cl
              </span>
              <span className="font-mono text-[10px] text-text-subtle">Doctor2026!</span>
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
