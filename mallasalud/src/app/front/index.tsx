"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  MagnifyingGlassIcon,
  BuildingOffice2Icon,
  ClockIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import styles from "./front.module.css";

export default function FrontIndex() {
  const [selectedComuna, setSelectedComuna] = useState("0");
  const [selectedEspecialidad, setSelectedEspecialidad] = useState("0");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Acción de búsqueda
    const element = document.getElementById("proceso");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className={styles.pageWrapper}>
      {/* 1. Header (se funde arriba y se separa al hacer scroll) */}
      <Header />

      {/* 2. Contenido principal */}
      <div className={styles.bodySection}>
        <main>
          {/* ============================================================
             SECCIÓN 1: HERO PRINCIPAL CON BOTÓN GRANDE PARA RESERVAR CITA
             ============================================================ */}
          <section className={styles.heroSection}>
            <div className={styles.heroOverlay} />
            <div className={styles.heroContent}>
              <div className={styles.heroBadge}>
                Atención Médica Presencial
              </div>
              <h1 className={styles.heroTitle}>
                Reserva tu hora médica en <span className={styles.heroHighlight}>MallaSalud</span>
              </h1>
              <p className={styles.heroSubtitle}>
                Plataforma de reserva y agendamiento de citas presenciales en centros de salud familiar (CESFAM)
              </p>

              {/* Botón principal grande para reservar cita */}
              <div>
                <a href="#reservar" className={styles.heroCtaButton}>
                  <span>Reservar Cita Médica</span>
                  <span>→</span>
                </a>
              </div>
            </div>
          </section>

          {/* ============================================================
             SECCIÓN 2: BUSCADOR DE HORAS (100% dentro del fondo blanco)
             ============================================================ */}
          <section className={styles.searchSection} id="reservar">
            <div className={styles.searchCard}>
              <div className={styles.searchHeader}>
                <h2 className={styles.searchTitle}>Consultar Horas Médicas Disponibles</h2>
                <p className={styles.searchSubtitle}>
                  Selecciona tu comuna y especialidad requerida para ver los cupos habilitados
                </p>
              </div>

              <form onSubmit={handleSearch} className={styles.searchForm}>
                {/* Selector de Comuna */}
                <select
                  value={selectedComuna}
                  onChange={(e) => setSelectedComuna(e.target.value)}
                  className={styles.searchSelect}
                  aria-label="Seleccione Comuna"
                >
                  <option value="0">Seleccione Comuna...</option>
                  <option value="santiago">Santiago</option>
                  <option value="la-florida">La Florida</option>
                  <option value="padre-hurtado">Padre Hurtado</option>
                  <option value="penalolen">Peñalolén</option>
                  <option value="la-pintana">La Pintana</option>
                  <option value="puente-alto">Puente Alto</option>
                  <option value="la-granja">La Granja</option>
                </select>

                {/* Selector de Especialidad (3 Especialidades oficiales) */}
                <select
                  value={selectedEspecialidad}
                  onChange={(e) => setSelectedEspecialidad(e.target.value)}
                  className={styles.searchSelect}
                  aria-label="Seleccione Especialidad"
                >
                  <option value="0">Seleccione Especialidad...</option>
                  <option value="MEDICINA_GENERAL">Medicina General</option>
                  <option value="URGENCIA_DENTAL">Urgencia Dental</option>
                  <option value="MATRONERIA">Matronería</option>
                </select>

                {/* Botón de búsqueda */}
                <button type="submit" className={styles.searchButton}>
                  <MagnifyingGlassIcon className="w-5 h-5" />
                  <span>BUSCAR HORA</span>
                </button>
              </form>
            </div>
          </section>

          {/* ============================================================
             SECCIÓN 3: PROCESO DE RESERVA FLUIDO (Timeline sin tarjetas)
             ============================================================ */}
          <section className={styles.processSection} id="proceso">
            <div className={styles.sectionHeader}>
              <p className={styles.sectionPretitle}>Paso a Paso</p>
              <h2 className={styles.sectionTitle}>¿Cómo reservar tu hora médica?</h2>
            </div>

            <div className={styles.timelineGrid}>
              <div className={styles.timelineItem}>
                <div className={styles.timelineStepBadge}>1</div>
                <h3 className={styles.timelineTitle}>Elige Especialidad y Comuna</h3>
                <p className={styles.timelineText}>
                  Selecciona la especialidad que necesitas y el centro de salud familiar de tu comuna.
                </p>
              </div>

              <div className={styles.timelineItem}>
                <div className={styles.timelineStepBadge}>2</div>
                <h3 className={styles.timelineTitle}>Escoge Fecha y Hora</h3>
                <p className={styles.timelineText}>
                  Revisa los cupos de atención presencial disponibles y selecciona el bloque horario que mejor te acomode.
                </p>
              </div>

              <div className={styles.timelineItem}>
                <div className={styles.timelineStepBadge}>3</div>
                <h3 className={styles.timelineTitle}>Ingresa los Datos del Paciente</h3>
                <p className={styles.timelineText}>
                  Completa los datos de identificación obligatorios:
                </p>
                <div className={styles.patientDataTags}>
                  <span>RUT • </span>
                  <span>Nombre • </span>
                  <span>Apellido • </span>
                  <span>Nacimiento • </span>
                  <span>Teléfono (+56 9) • </span>
                  <span>Correo</span>
                </div>
              </div>

              <div className={styles.timelineItem}>
                <div className={styles.timelineStepBadge}>4</div>
                <h3 className={styles.timelineTitle}>Confirmación y Box Asignado</h3>
                <p className={styles.timelineText}>
                  Obtén tu comprobante oficial de citación para presentarlo el día de tu consulta presencial.
                </p>
              </div>
            </div>
          </section>

          {/* ============================================================
             SECCIÓN 4: ÚNICAS 3 CARDS DE LA PÁGINA (Servicios Principales)
             ============================================================ */}
          <section className={styles.cardsSection} id="servicios">
            <div className={styles.sectionHeader}>
              <p className={styles.sectionPretitle}>Beneficios del Sistema</p>
              <h2 className={styles.sectionTitle}>Gestión de Citas Médicas Presenciales</h2>
            </div>

            <div className={styles.cardsGrid}>
              {/* Card 1 */}
              <div className={styles.mainCard}>
                <div className={styles.cardIconCircle}>
                  <BuildingOffice2Icon className="w-7 h-7" />
                </div>
                <h3 className={styles.cardTitle}>Atención Presencial en Box</h3>
                <p className={styles.cardDescription}>
                  Agendamiento directo para consultas en centros de salud familiar (CESFAM) con día, hora y box asignado de antemano.
                </p>
              </div>

              {/* Card 2 */}
              <div className={styles.mainCard}>
                <div className={styles.cardIconCircle}>
                  <ClockIcon className="w-7 h-7" />
                </div>
                <h3 className={styles.cardTitle}>Cupos en Tiempo Real</h3>
                <p className={styles.cardDescription}>
                  Visualiza los horarios habilitados por el centro sin necesidad de hacer filas de madrugada en ventanilla SOME.
                </p>
              </div>

              {/* Card 3 */}
              <div className={styles.mainCard}>
                <div className={styles.cardIconCircle}>
                  <TicketIcon className="w-7 h-7" />
                </div>
                <h3 className={styles.cardTitle}>Comprobante y Recordatorio</h3>
                <p className={styles.cardDescription}>
                  Recibe los datos oficiales de tu reserva con recordatorios por SMS para no olvidar tu cita en el centro médico.
                </p>
              </div>
            </div>
          </section>

          {/* ============================================================
             SECCIÓN 5: BANNER CTA FINAL
             ============================================================ */}
          <section className={styles.ctaSection} id="contacto">
            <div className={styles.ctaContent}>
              <h2 className={styles.ctaTitle}>
                Reserva tu hora de atención médica presencial
              </h2>
              <p style={{ margin: 0, opacity: 0.9, fontSize: "1.05rem" }}>
                Mesa de coordinación y consultas
              </p>
              <div className={styles.ctaPhone}>
                (56 9) 3764 4737
              </div>
              <div>
                <Link href="#reservar" className={styles.ctaButton}>
                  <span>Buscar Horas Ahora</span>
                  <span>↑</span>
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* 3. Footer institucional */}
      <Footer />
    </div>
  );
}
