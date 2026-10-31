"use client";

import Link from "next/link";
import Image from "next/image";
import {
  PhoneIcon,
  ClockIcon,
  MapPinIcon,
  CalendarDaysIcon,
  BuildingOffice2Icon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="site-footer">
      {/* 1. Cuerpo Principal del Footer (4 Columnas) */}
      <div className="site-footer-container">
        <div className="site-footer-grid">

          {/* Columna 1: Identidad y Misión */}
          <div className="site-footer-brand-col">
            <div className="site-footer-brand-header">
              <div className="site-footer-logo-box">
                <Image
                  src="/logo-mallasalud.png"
                  alt="MallaSalud Logo"
                  width={40}
                  height={40}
                  className="site-footer-logo-img"
                />
              </div>
              <div>
                <span className="site-footer-brand-title">
                  MALLA<span className="site-footer-brand-accent">SALUD</span>
                </span>
                <p className="site-footer-brand-subtitle">
                  Red CESFAM Pública
                </p>
              </div>
            </div>

            <p className="site-footer-description">
              Plataforma omnicanal diseñada para erradicar las filas de madrugada y asegurar el acceso equitativo y oportuno a la atención médica en la salud pública primaria.
            </p>
          </div>

          {/* Columna 2: Especialidades Clínicas */}
          <div>
            <h5 className="site-footer-heading">
              <span className="site-footer-heading-bar" />
              Especialidades
            </h5>
            <ul className="site-footer-list">
              <li>
                <Link
                  href="/#especialidades"
                  className="site-footer-link-bullet"
                >
                  <span className="site-footer-bullet">•</span> Medicina General
                </Link>
              </li>
              <li>
                <Link
                  href="/#especialidades"
                  className="site-footer-link-bullet"
                >
                  <span className="site-footer-bullet">•</span> Odontología
                </Link>
              </li>
              <li>
                <Link
                  href="/#especialidades"
                  className="site-footer-link-bullet"
                >
                  <span className="site-footer-bullet">•</span> Matronería
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 3: Canales y Enlaces Rápidos */}
          <div>
            <h5 className="site-footer-heading">
              <span className="site-footer-heading-bar" />
              Canales de Acceso
            </h5>
            <ul className="site-footer-list">
              <li>
                <Link
                  href="/"
                  className="site-footer-link-icon"
                >
                  <CalendarDaysIcon className="site-footer-icon" />
                  <span>Portal Paciente: Reservar Cita Web</span>
                </Link>
              </li>
              <li>
                <a
                  href="tel:800500123"
                  className="site-footer-link-icon"
                >
                  <PhoneIcon className="site-footer-icon" />
                  <span>Canal Telefónico Automatizado (IVR)</span>
                </a>
              </li>
              <li>
                <Link
                  href="/some/ventanilla"
                  className="site-footer-link-icon"
                >
                  <BuildingOffice2Icon className="site-footer-icon" />
                  <span>Ventanilla Presencial SOME</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/some/agendas"
                  className="site-footer-link-icon"
                >
                  <BuildingOffice2Icon className="site-footer-icon" />
                  <span>Consola SOME: Gestión de Agendas</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/#faq"
                  className="site-footer-link-icon"
                >
                  <InformationCircleIcon className="site-footer-icon" />
                  <span>Preguntas Frecuentes y Anulación</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 4: Horarios y Ubicación */}
          <div className="site-footer-info-col">
            <h5 className="site-footer-heading">
              <span className="site-footer-heading-bar" />
              Atención y Ubicación
            </h5>

            <div className="site-footer-info-item">
              <ClockIcon className="site-footer-info-icon" />
              <div>
                <p className="site-footer-info-title">Horario de Consultas CESFAM:</p>
                <p>Lunes a Viernes: 08:00 a 17:00 hrs</p>
                <p className="site-footer-info-subtext">Sábados: 09:00 a 13:00 hrs</p>
              </div>
            </div>

            <div className="site-footer-info-item">
              <ClockIcon className="site-footer-info-icon-sapu" />
              <div>
                <p className="site-footer-info-title">Servicio de Urgencia SAPU:</p>
                <p>Lunes a Domingo: 17:00 a 08:00 hrs (24 hrs fines de semana)</p>
              </div>
            </div>

            <div className="site-footer-info-item-spaced">
              <MapPinIcon className="site-footer-info-icon" />
              <div>
                <p className="site-footer-info-title">Red de Atención Primaria:</p>
                <p>Centro de Salud Familiar (CESFAM) Comunal</p>
                <p className="site-footer-info-subtext">Región Metropolitana, Chile</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 2. Subfooter Limpio */}
      <div className="site-footer-subfooter">
        <div className="site-footer-subfooter-inner">
          <span className="site-footer-subfooter-brand">MALLASALUD</span>
          <span className="site-footer-subfooter-dot">•</span>
          <span>2026</span>
          <span className="site-footer-subfooter-dot">•</span>
          <span className="site-footer-subfooter-authors">
            Pablo Carrasco &amp; Benjamín Ascencio
          </span>
        </div>
      </div>
    </footer>
  );
}
