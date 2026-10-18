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

export default function Footer() {
  return (
    <footer className="bg-[#183833] dark:bg-[#091412] text-[#F4FAF8] dark:text-[#E8F5F2] print:hidden font-sans border-t-4 border-[#0F766E] mt-auto transition-colors duration-200">
      {/* 1. Cuerpo Principal del Footer (4 Columnas) */}
      <div className="w-full max-w-[1780px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">

          {/* Columna 1: Identidad y Misión */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl p-1 flex items-center justify-center shadow-xs">
                <Image
                  src="/logo-mallasalud.png"
                  alt="MallaSalud Logo"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <div>
                <span className="text-xl font-extrabold tracking-tight text-white">
                  MALLA<span className="text-[#A7E3D4]">SALUD</span>
                </span>
                <p className="text-[11px] text-[#A7E3D4] uppercase font-semibold tracking-wider">
                  Red CESFAM Pública
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#D9F5EF] leading-relaxed">
              Plataforma omnicanal diseñada para erradicar las filas de madrugada y asegurar el acceso equitativo y oportuno a la atención médica en la salud pública primaria.
            </p>
          </div>

          {/* Columna 2: Especialidades Clínicas */}
          <div>
            <h5 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-[#5BB9A6] rounded-full" />
              Especialidades
            </h5>
            <ul className="space-y-2.5 text-xs sm:text-sm text-[#D9F5EF]">
              <li>
                <Link
                  href="/#especialidades"
                  className="hover:text-white hover:underline flex items-center gap-1.5 transition-colors"
                >
                  <span className="text-[#5BB9A6]">•</span> Medicina General
                </Link>
              </li>
              <li>
                <Link
                  href="/#especialidades"
                  className="hover:text-white hover:underline flex items-center gap-1.5 transition-colors"
                >
                  <span className="text-[#5BB9A6]">•</span> Odontología
                </Link>
              </li>
              <li>
                <Link
                  href="/#especialidades"
                  className="hover:text-white hover:underline flex items-center gap-1.5 transition-colors"
                >
                  <span className="text-[#5BB9A6]">•</span> Matronería
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 3: Canales y Enlaces Rápidos */}
          <div>
            <h5 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-[#5BB9A6] rounded-full" />
              Canales de Acceso
            </h5>
            <ul className="space-y-2.5 text-xs sm:text-sm text-[#D9F5EF]">
              <li>
                <Link
                  href="/"
                  className="hover:text-white hover:underline flex items-center gap-2 transition-colors"
                >
                  <CalendarDaysIcon className="w-4 h-4 text-[#A7E3D4] flex-shrink-0" />
                  <span>Portal Paciente: Reservar Cita Web</span>
                </Link>
              </li>
              <li>
                <a
                  href="tel:800500123"
                  className="hover:text-white hover:underline flex items-center gap-2 transition-colors"
                >
                  <PhoneIcon className="w-4 h-4 text-[#A7E3D4] flex-shrink-0" />
                  <span>Canal Telefónico Automatizado (IVR)</span>
                </a>
              </li>
              <li>
                <Link
                  href="/some/ventanilla"
                  className="hover:text-white hover:underline flex items-center gap-2 transition-colors"
                >
                  <BuildingOffice2Icon className="w-4 h-4 text-[#A7E3D4] flex-shrink-0" />
                  <span>Ventanilla Presencial SOME</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/some/agendas"
                  className="hover:text-white hover:underline flex items-center gap-2 transition-colors"
                >
                  <BuildingOffice2Icon className="w-4 h-4 text-[#A7E3D4] flex-shrink-0" />
                  <span>Consola SOME: Gestión de Agendas</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/#faq"
                  className="hover:text-white hover:underline flex items-center gap-2 transition-colors"
                >
                  <InformationCircleIcon className="w-4 h-4 text-[#A7E3D4] flex-shrink-0" />
                  <span>Preguntas Frecuentes y Anulación</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 4: Horarios y Ubicación */}
          <div className="space-y-3">
            <h5 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-[#5BB9A6] rounded-full" />
              Atención y Ubicación
            </h5>

            <div className="flex items-start gap-2.5 text-xs sm:text-sm text-[#D9F5EF]">
              <ClockIcon className="w-4 h-4 text-[#A7E3D4] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Horario de Consultas CESFAM:</p>
                <p>Lunes a Viernes: 08:00 a 17:00 hrs</p>
                <p className="text-xs text-[#A7E3D4] mt-0.5">Sábados: 09:00 a 13:00 hrs</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-xs sm:text-sm text-[#D9F5EF]">
              <ClockIcon className="w-4 h-4 text-emerald-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Servicio de Urgencia SAPU:</p>
                <p>Lunes a Domingo: 17:00 a 08:00 hrs (24 hrs fines de semana)</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-xs sm:text-sm text-[#D9F5EF] pt-1">
              <MapPinIcon className="w-4 h-4 text-[#A7E3D4] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Red de Atención Primaria:</p>
                <p>Centro de Salud Familiar (CESFAM) Comunal</p>
                <p className="text-xs text-[#A7E3D4]">Región Metropolitana, Chile</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 2. Subfooter Limpio */}
      <div className="bg-[#112824] dark:bg-[#050C0B] py-3.5 px-4 sm:px-8 lg:px-12 xl:px-16 border-t border-[#264E46] dark:border-[#17302B] text-xs text-[#D9F5EF]">
        <div className="w-full flex items-center justify-center gap-3 text-center flex-wrap">
          <span className="font-bold text-white tracking-wide">MALLASALUD</span>
          <span className="text-[#5BB9A6]">•</span>
          <span>2026</span>
          <span className="text-[#5BB9A6]">•</span>
          <span className="text-white font-medium">
            Pablo Carrasco &amp; Benjamín Ascencio
          </span>
        </div>
      </div>
    </footer>
  );
}
