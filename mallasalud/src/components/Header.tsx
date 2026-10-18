"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  CalendarDaysIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronDownIcon,
  BuildingOffice2Icon,
  EyeIcon,
  SunIcon,
  MoonIcon,
} from "@heroicons/react/24/outline";

export default function Header() {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [someDropdownAbierto, setSomeDropdownAbierto] = useState(false);

  // 1. Accesibilidad: Solo 2 niveles (Normal y Grande moderado para no romper la pantalla)
  const [fontGrande, setFontGrande] = useState(false);

  // 2. Modo Oscuro
  const [modoOscuro, setModoOscuro] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Inicializar tema y tamaño guardados
  useEffect(() => {
    const savedTheme = localStorage.getItem("mallasalud_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setModoOscuro(true);
      document.documentElement.classList.add("dark");
    } else {
      setModoOscuro(false);
      document.documentElement.classList.remove("dark");
    }

    const savedFont = localStorage.getItem("mallasalud_font");
    if (savedFont === "grande") {
      setFontGrande(true);
      document.documentElement.style.fontSize = "112%";
    } else {
      setFontGrande(false);
      document.documentElement.style.fontSize = "100%";
    }
  }, []);

  // Alternar tamaño de texto entre Normal (100%) y Grande moderado (112%)
  const toggleTamanoTexto = (esGrande: boolean) => {
    setFontGrande(esGrande);
    if (esGrande) {
      document.documentElement.style.fontSize = "112%";
      localStorage.setItem("mallasalud_font", "grande");
    } else {
      document.documentElement.style.fontSize = "100%";
      localStorage.setItem("mallasalud_font", "normal");
    }
  };

  // Alternar modo oscuro / claro
  const toggleModoOscuro = () => {
    const nuevoModo = !modoOscuro;
    setModoOscuro(nuevoModo);
    if (nuevoModo) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("mallasalud_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("mallasalud_theme", "light");
    }
  };

  // Cerrar menú y dropdowns al cambiar de ruta
  useEffect(() => {
    setMenuAbierto(false);
    setSomeDropdownAbierto(false);
  }, [pathname]);

  // Cerrar dropdown si se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSomeDropdownAbierto(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navLinks = [
    { label: "Inicio", href: "/" },
    { label: "Especialidades", href: "/#especialidades" },
    { label: "Cómo Funciona", href: "/#como-funciona" },
    { label: "Preguntas Frecuentes", href: "/#faq" },
  ];

  const enVistaSome = pathname.startsWith("/some");

  return (
    <header className="print:hidden sticky top-0 z-50 w-full bg-white/95 dark:bg-[#11221F]/95 backdrop-blur-md border-b border-[#CDECE5] dark:border-[#1E3F3B] shadow-xs font-sans transition-colors duration-200">
      <div className="w-full max-w-[1780px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center justify-between h-20 gap-3 sm:gap-6">
          
          {/* 1. Logo y Nombre Institucional */}
          <Link
            href="/"
            className="flex items-center gap-2.5 sm:gap-3 group focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:ring-offset-2 rounded-xl p-1 flex-shrink-0"
          >
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 bg-[#F4FAF8] dark:bg-[#152B26] rounded-xl border border-[#CDECE5] dark:border-[#2A534B] p-1 flex items-center justify-center group-hover:border-[#0F766E] transition-all shadow-2xs">
              <Image
                src="/logo-mallasalud.png"
                alt="Logo MallaSalud"
                width={44}
                height={44}
                priority
                className="object-contain"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-[#1E4640] dark:text-[#E8F5F2]">
                  MALLA<span className="text-[#0F766E] dark:text-[#5BB9A6]">SALUD</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#D9F5EF] dark:bg-[#1E3F3B] text-[#0F766E] dark:text-[#A7E3D4] px-2 py-0.5 rounded-full border border-[#A7E3D4] dark:border-[#2A534B]">
                  CESFAM
                </span>
              </div>
              <span className="text-xs text-[#355C56] dark:text-[#9CC2BC] font-medium tracking-tight hidden sm:block">
                Red de Salud Pública Primaria
              </span>
            </div>
          </Link>

          {/* 2. Enlaces de Navegación */}
          <nav className="hidden xl:flex items-center gap-1 xl:gap-1.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`px-3 py-2 rounded-xl text-xs xl:text-sm font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? "text-[#0F766E] dark:text-[#E8F5F2] bg-[#D9F5EF]/80 dark:bg-[#1E3F3B] font-bold"
                      : "text-[#355C56] dark:text-[#9CC2BC] hover:text-[#1E4640] dark:hover:text-white hover:bg-[#F4FAF8] dark:hover:bg-[#17302B]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* 3. Acciones Integradas: Accesibilidad + Modo Oscuro + Área Funcionarios + Reservar */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            
            {/* Control de Accesibilidad (Normal / Grande A+) */}
            <div
              className="flex items-center gap-1 bg-[#F4FAF8] dark:bg-[#152B26] border border-[#CDECE5] dark:border-[#2A534B] rounded-xl px-2 py-1 shadow-2xs"
              title="Ajustar tamaño de letra para mejor lectura"
            >
              <span className="text-[11px] font-bold text-[#355C56] dark:text-[#9CC2BC] px-0.5 select-none hidden sm:inline">
                Texto:
              </span>
              <button
                type="button"
                onClick={() => toggleTamanoTexto(false)}
                className={`px-2 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  !fontGrande
                    ? "bg-[#0F766E] text-white shadow-2xs"
                    : "text-[#1E4640] dark:text-[#9CC2BC] hover:bg-[#D9F5EF] dark:hover:bg-[#1E3F3B]"
                }`}
                aria-label="Tamaño normal"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => toggleTamanoTexto(true)}
                className={`px-2 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  fontGrande
                    ? "bg-[#0F766E] text-white shadow-2xs"
                    : "text-[#1E4640] dark:text-[#9CC2BC] hover:bg-[#D9F5EF] dark:hover:bg-[#1E3F3B]"
                }`}
                aria-label="Tamaño grande"
              >
                A+
              </button>
            </div>

            {/* Botón Modo Oscuro / Modo Claro */}
            <button
              type="button"
              onClick={toggleModoOscuro}
              className="p-2.5 rounded-xl bg-[#F4FAF8] dark:bg-[#152B26] border border-[#CDECE5] dark:border-[#2A534B] text-[#1E4640] dark:text-[#A7E3D4] hover:bg-[#D9F5EF] dark:hover:bg-[#1E3F3B] transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#0F766E] cursor-pointer"
              title={modoOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              aria-label="Alternar modo oscuro"
            >
              {modoOscuro ? (
                <SunIcon className="w-4 h-4 text-amber-300" />
              ) : (
                <MoonIcon className="w-4 h-4 text-[#1E4640]" />
              )}
            </button>

            {/* Selector / Dropdown de Área Funcionarios */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setSomeDropdownAbierto(!someDropdownAbierto)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all border cursor-pointer ${
                  someDropdownAbierto || enVistaSome
                    ? "bg-[#1E4640] dark:bg-[#1E3F3B] text-white border-[#1E4640] dark:border-[#5BB9A6]"
                    : "bg-[#F4FAF8] dark:bg-[#152B26] text-[#1E4640] dark:text-[#A7E3D4] border-[#CDECE5] dark:border-[#2A534B] hover:bg-[#D9F5EF]/60 dark:hover:bg-[#1E3F3B]"
                }`}
                aria-expanded={someDropdownAbierto}
              >
                <BuildingOffice2Icon className={`w-4 h-4 ${someDropdownAbierto || enVistaSome ? "text-[#A7E3D4]" : "text-[#0F766E] dark:text-[#5BB9A6]"}`} />
                <span className="hidden md:inline">Área Funcionarios</span>
                <span className="md:hidden">SOME</span>
                <ChevronDownIcon
                  className={`w-3.5 h-3.5 transition-transform ${
                    someDropdownAbierto ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Menú Desplegable con accesos a vistas */}
              {someDropdownAbierto && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#122420] text-[#132A26] dark:text-[#E8F5F2] rounded-2xl shadow-xl border border-[#CDECE5] dark:border-[#2A534B] p-2.5 z-50 animate-fadeIn">
                  <div className="px-3 py-2 border-b border-[#CDECE5] dark:border-[#2A534B]">
                    <p className="text-[11px] font-bold text-[#0F766E] dark:text-[#A7E3D4] uppercase tracking-wider flex items-center gap-1.5">
                      <EyeIcon className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#5BB9A6]" />
                      Módulos Operativos CESFAM
                    </p>
                    <p className="text-[11px] text-[#355C56] dark:text-[#9CC2BC] mt-0.5">
                      Acceso para gestión SOME y pruebas
                    </p>
                  </div>

                  <div className="mt-1.5 space-y-1">
                    <Link
                      href="/some/agendas"
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-colors group ${
                        pathname === "/some/agendas"
                          ? "bg-[#D9F5EF] dark:bg-[#1E3F3B]"
                          : "hover:bg-[#F4FAF8] dark:hover:bg-[#17302B]"
                      }`}
                      onClick={() => setSomeDropdownAbierto(false)}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0F766E] dark:bg-[#5BB9A6] mt-1.5 flex-shrink-0 group-hover:scale-125 transition-transform" />
                      <div>
                        <p className="text-xs font-bold text-[#132A26] dark:text-[#E8F5F2]">
                          Consola SOME: Agendas
                        </p>
                        <p className="text-[11px] text-[#355C56] dark:text-[#9CC2BC]">
                          HU-005 • Apertura, Matriz de Boxes y Cuota 60+
                        </p>
                      </div>
                    </Link>

                    <Link
                      href="/some/ventanilla"
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-colors group ${
                        pathname === "/some/ventanilla"
                          ? "bg-[#D9F5EF] dark:bg-[#1E3F3B]"
                          : "hover:bg-[#F4FAF8] dark:hover:bg-[#17302B]"
                      }`}
                      onClick={() => setSomeDropdownAbierto(false)}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0 group-hover:scale-125 transition-transform" />
                      <div>
                        <p className="text-xs font-bold text-[#132A26] dark:text-[#E8F5F2]">
                          Ventanilla Presencial SOME
                        </p>
                        <p className="text-[11px] text-[#355C56] dark:text-[#9CC2BC]">
                          HU-006 • Alta Rápida, Mesón y Ticket Térmico
                        </p>
                      </div>
                    </Link>

                    <Link
                      href="/"
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-colors group ${
                        pathname === "/"
                          ? "bg-[#D9F5EF] dark:bg-[#1E3F3B]"
                          : "hover:bg-[#F4FAF8] dark:hover:bg-[#17302B]"
                      }`}
                      onClick={() => setSomeDropdownAbierto(false)}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-[#5BB9A6] mt-1.5 flex-shrink-0 group-hover:scale-125 transition-transform" />
                      <div>
                        <p className="text-xs font-bold text-[#132A26] dark:text-[#E8F5F2]">
                          Portal Pacientes (Reserva Web)
                        </p>
                        <p className="text-[11px] text-[#355C56] dark:text-[#9CC2BC]">
                          HU-001/002 • Autoatención y Anulación
                        </p>
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Botón Destacado 'Reservar Hora' con contraste WCAG AA */}
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[#0F766E] hover:bg-[#115E59] active:bg-[#134E4A] text-white px-4 sm:px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-[#A7E3D4] whitespace-nowrap flex-shrink-0"
            >
              <CalendarDaysIcon className="w-5 h-5 text-white" />
              <span>Reservar Hora</span>
            </Link>

            {/* Botón Menú Móvil */}
            <button
              type="button"
              onClick={() => setMenuAbierto(!menuAbierto)}
              className="lg:hidden p-2 rounded-xl text-[#1E4640] dark:text-[#A7E3D4] hover:bg-[#D9F5EF] dark:hover:bg-[#1E3F3B] focus:outline-none focus:ring-2 focus:ring-[#0F766E]"
              aria-label="Abrir menú de navegación"
              aria-expanded={menuAbierto}
            >
              {menuAbierto ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Menú Móvil Desplegable */}
      {menuAbierto && (
        <div className="lg:hidden border-t border-[#CDECE5] dark:border-[#2A534B] bg-white dark:bg-[#11221F] shadow-xl animate-fadeIn">
          <div className="px-4 pt-3 pb-6 space-y-3">
            
            {/* Controles en Móvil: Accesibilidad + Modo Oscuro */}
            <div className="flex items-center justify-between bg-[#F4FAF8] dark:bg-[#152B26] border border-[#CDECE5] dark:border-[#2A534B] p-2.5 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#1E4640] dark:text-[#A7E3D4]">
                  Texto:
                </span>
                <button
                  type="button"
                  onClick={() => toggleTamanoTexto(false)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    !fontGrande
                      ? "bg-[#0F766E] text-white"
                      : "bg-white dark:bg-[#1E3F3B] text-[#1E4640] dark:text-[#9CC2BC] border border-[#CDECE5] dark:border-[#2A534B]"
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => toggleTamanoTexto(true)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    fontGrande
                      ? "bg-[#0F766E] text-white"
                      : "bg-white dark:bg-[#1E3F3B] text-[#1E4640] dark:text-[#9CC2BC] border border-[#CDECE5] dark:border-[#2A534B]"
                  }`}
                >
                  Grande (A+)
                </button>
              </div>

              <button
                type="button"
                onClick={toggleModoOscuro}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#1E3F3B] border border-[#CDECE5] dark:border-[#2A534B] text-[#1E4640] dark:text-[#A7E3D4]"
              >
                {modoOscuro ? (
                  <>
                    <SunIcon className="w-4 h-4 text-amber-300" />
                    <span>Claro</span>
                  </>
                ) : (
                  <>
                    <MoonIcon className="w-4 h-4 text-[#1E4640]" />
                    <span>Oscuro</span>
                  </>
                )}
              </button>
            </div>

            {/* Enlaces de navegación */}
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMenuAbierto(false)}
                className="flex items-center justify-between px-3.5 py-3 rounded-xl text-base font-semibold text-[#132A26] dark:text-[#E8F5F2] hover:text-[#0F766E] hover:bg-[#D9F5EF] dark:hover:bg-[#1E3F3B] transition-colors"
              >
                <span>{link.label}</span>
                <span className="text-[#0F766E] dark:text-[#5BB9A6]">→</span>
              </Link>
            ))}

            {/* Botón Reservar en Móvil */}
            <div className="pt-2 border-t border-[#CDECE5] dark:border-[#2A534B]">
              <Link
                href="/"
                onClick={() => setMenuAbierto(false)}
                className="w-full flex items-center justify-center gap-2 bg-[#0F766E] hover:bg-[#115E59] text-white py-3.5 rounded-xl font-bold text-base shadow-sm mt-1"
              >
                <CalendarDaysIcon className="w-5 h-5" />
                <span>Reservar Hora Médica</span>
              </Link>
            </div>

            {/* Accesos de Funcionarios en Móvil */}
            <div className="pt-3 border-t border-[#CDECE5] dark:border-[#2A534B] space-y-1.5">
              <p className="text-[11px] font-bold text-[#355C56] dark:text-[#9CC2BC] uppercase tracking-wider px-1">
                Área Funcionarios / Vistas SOME:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Link
                  href="/some/agendas"
                  onClick={() => setMenuAbierto(false)}
                  className="p-2.5 rounded-xl bg-[#F4FAF8] dark:bg-[#152B26] border border-[#CDECE5] dark:border-[#2A534B] text-[#1E4640] dark:text-[#A7E3D4] font-semibold text-center hover:bg-[#D9F5EF] dark:hover:bg-[#1E3F3B]"
                >
                  Consola SOME
                </Link>
                <Link
                  href="/some/ventanilla"
                  onClick={() => setMenuAbierto(false)}
                  className="p-2.5 rounded-xl bg-[#F4FAF8] dark:bg-[#152B26] border border-[#CDECE5] dark:border-[#2A534B] text-[#1E4640] dark:text-[#A7E3D4] font-semibold text-center hover:bg-[#D9F5EF] dark:hover:bg-[#1E3F3B]"
                >
                  Ventanilla SOME
                </Link>
              </div>
            </div>

          </div>
        </div>
      )}
    </header>
  );
}
