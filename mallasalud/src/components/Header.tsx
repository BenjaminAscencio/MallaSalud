"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MoonIcon,
  SunIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import styles from "./Header.module.css";

export default function Header() {
  const [isDark, setIsDark] = useState(false);
  const [isExtraLarge, setIsExtraLarge] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Escuchar scroll para el efecto de fundido arriba y separación al bajar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Cargar preferencias guardadas al montar el componente
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    }

    // Tamaño de fuente: 118% es el nuevo default, 140% es el extra grande
    const savedExtraLarge = localStorage.getItem("extra-large-text");
    if (savedExtraLarge === "true") {
      setIsExtraLarge(true);
      document.documentElement.style.fontSize = "140%";
    } else {
      setIsExtraLarge(false);
      document.documentElement.style.fontSize = "118%";
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  const toggleTextSize = () => {
    if (isExtraLarge) {
      document.documentElement.style.fontSize = "118%";
      localStorage.setItem("extra-large-text", "false");
      setIsExtraLarge(false);
    } else {
      document.documentElement.style.fontSize = "140%";
      localStorage.setItem("extra-large-text", "true");
      setIsExtraLarge(true);
    }
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setIsMenuOpen(false); // Cierra el menú al navegar
    if (id === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <header className={`${styles.header} ${isScrolled ? styles.headerScrolled : ""}`}>
      <div className={styles.container}>
        {/* 1. Logo Institucional */}
        <a href="#" onClick={(e) => scrollToSection(e, "top")} className={styles.logoLink}>
          <div className={styles.logoIconWrapper}>
            <svg
              className={styles.logoIcon}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4V3z" opacity="0.3" />
              <path
                d="M3 12h3l1.5-3 3 6 2.5-4 1.5 2 2-1h4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className={styles.logoText}>
            MallaSalud <span className={styles.logoSubtext}>- Citas Médicas</span>
          </span>
        </a>

        {/* 2. Navegación Desktop (Oculta en pantallas pequeñas) */}
        <nav className={styles.nav}>
          <a
            href="#"
            onClick={(e) => scrollToSection(e, "top")}
            className={styles.navLink}
          >
            Inicio
          </a>
          <a
            href="#proceso"
            onClick={(e) => scrollToSection(e, "proceso")}
            className={styles.navLink}
          >
            ¿Cómo Reservar?
          </a>
          <a
            href="#servicios"
            onClick={(e) => scrollToSection(e, "servicios")}
            className={styles.navLink}
          >
            Servicios
          </a>
          <a
            href="#contacto"
            onClick={(e) => scrollToSection(e, "contacto")}
            className={styles.navLink}
          >
            Centros de Salud
          </a>
        </nav>

        {/* 3. Acciones (Accesibilidad + Menú Hamburguesa en móvil) */}
        <div className={styles.actions}>
          {/* Botón Letra Extra Grande */}
          <button
            type="button"
            onClick={toggleTextSize}
            title={isExtraLarge ? "Restablecer a tamaño estándar" : "Aumentar a letra extra grande (Baja visión)"}
            aria-label="Ajustar tamaño de texto"
            className={`${styles.textButton} ${isExtraLarge ? styles.textButtonActive : ""}`}
          >
            <span>a</span>
            <span style={{ fontSize: "1.1em", fontWeight: 800 }}>A</span>
            <span style={{ opacity: 0.8, marginLeft: "2px" }}>{isExtraLarge ? "✓" : "+"}</span>
          </button>

          {/* Botón Modo Oscuro */}
          <button
            type="button"
            onClick={toggleDarkMode}
            title={isDark ? "Cambiar a modo claro" : "Cambiar a colores oscuros"}
            aria-label="Alternar colores oscuros"
            className={styles.themeButton}
          >
            {isDark ? (
              <SunIcon className={styles.themeIcon} style={{ color: "#fde047" }} />
            ) : (
              <MoonIcon className={styles.themeIcon} style={{ color: "#5eead4" }} />
            )}
          </button>

          {/* Botón CTA Reservar Cita (visible en Desktop) */}
          <a
            href="#reservar"
            onClick={(e) => scrollToSection(e, "reservar")}
            className={styles.ctaButton}
          >
            Reservar Cita
          </a>

          {/* Botón de las 3 líneas (Menú hamburguesa en móviles) */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            title="Abrir menú de navegación"
            aria-label="Menú principal"
            className={styles.hamburgerButton}
          >
            {isMenuOpen ? (
              <XMarkIcon className={styles.hamburgerIcon} />
            ) : (
              <Bars3Icon className={styles.hamburgerIcon} />
            )}
          </button>
        </div>
      </div>

      {/* 4. Menú Desplegable Móvil (Lista vertical al presionar las 3 líneas) */}
      <div className={`${styles.mobileMenu} ${isMenuOpen ? styles.mobileMenuOpen : ""}`}>
        <ul className={styles.mobileNavList}>
          <li>
            <a
              href="#"
              onClick={(e) => scrollToSection(e, "top")}
              className={styles.mobileNavLink}
            >
              Inicio
            </a>
          </li>
          <li>
            <a
              href="#proceso"
              onClick={(e) => scrollToSection(e, "proceso")}
              className={styles.mobileNavLink}
            >
              ¿Cómo Reservar?
            </a>
          </li>
          <li>
            <a
              href="#servicios"
              onClick={(e) => scrollToSection(e, "servicios")}
              className={styles.mobileNavLink}
            >
              Servicios
            </a>
          </li>
          <li>
            <a
              href="#contacto"
              onClick={(e) => scrollToSection(e, "contacto")}
              className={styles.mobileNavLink}
            >
              Centros de Salud
            </a>
          </li>
        </ul>

        {/* Botón de acción dentro del menú móvil */}
        <a
          href="#reservar"
          onClick={(e) => scrollToSection(e, "reservar")}
          className={styles.mobileCtaButton}
        >
          Reservar Cita Médica
        </a>
      </div>
    </header>
  );
}
