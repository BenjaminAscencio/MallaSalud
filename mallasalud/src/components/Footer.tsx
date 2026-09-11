"use client";

import { PhoneIcon } from "@heroicons/react/24/outline";
import styles from "./Footer.module.css";

export default function Footer() {
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
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
    <footer className={styles.footer}>
      <div className={styles.container}>
        {/* Columna 1: Copyright */}
        <div className={styles.column}>
          <p className={styles.copyrightYear}>© 2026</p>
          <p className={styles.projectName}>MallaSalud - Citas Médicas</p>
        </div>

        {/* Columna 2: Enlaces rápidos con scroll suave */}
        <div className={`${styles.column} ${styles.columnBorder}`}>
          <h3 className={styles.columnTitle}>Acceso Rápido</h3>
          <ul className={styles.linkList}>
            <li>
              <a
                href="#"
                onClick={(e) => scrollToSection(e, "top")}
                className={styles.footerLink}
              >
                Inicio
              </a>
            </li>
            <li>
              <a
                href="#proceso"
                onClick={(e) => scrollToSection(e, "proceso")}
                className={styles.footerLink}
              >
                ¿Cómo Reservar?
              </a>
            </li>
            <li>
              <a
                href="#servicios"
                onClick={(e) => scrollToSection(e, "servicios")}
                className={styles.footerLink}
              >
                Servicios
              </a>
            </li>
            <li>
              <a
                href="#contacto"
                onClick={(e) => scrollToSection(e, "contacto")}
                className={styles.footerLink}
              >
                Centros de Salud
              </a>
            </li>
          </ul>
        </div>

        {/* Columna 3: Soporte / Urgencias */}
        <div className={`${styles.column} ${styles.columnBorder}`}>
          <h3 className={styles.columnTitle}>Soporte / Urgencias</h3>
          <div className={styles.emergencyBox}>
            <div className={styles.phoneIconWrapper}>
              <PhoneIcon className={styles.phoneIcon} />
            </div>
            <div>
              <p className={styles.emergencyLabel}>Mesa de ayuda</p>
              <a href="tel:56937644737" className={styles.emergencyPhone}>
                (56 9) 3764 4737
              </a>
            </div>
          </div>
        </div>

        {/* Columna 4: Legal & Seguridad */}
        <div className={`${styles.column} ${styles.columnBorder}`}>
          <h3 className={styles.columnTitle}>Legal & Seguridad</h3>
          <ul className={styles.linkList}>
            <li>
              <span className={styles.footerLink} style={{ cursor: "default" }}>
                Términos de Servicio
              </span>
            </li>
            <li>
              <span className={styles.footerLink} style={{ cursor: "default" }}>
                Privacidad de Datos
              </span>
            </li>
            <li>
              <span className={styles.footerLink} style={{ cursor: "default" }}>
                Atención CESFAM
              </span>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
