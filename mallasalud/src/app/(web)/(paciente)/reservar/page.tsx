"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import "./reservar.css";

// Redirige transparentemente al portal de reserva en /
export default function ReservarRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="reservar-redirect-wrapper">
      <div className="reservar-redirect-status">
        <span className="reservar-redirect-spinner" />
        <span>Cargando Portal de Agendamiento...</span>
      </div>
    </div>
  );
}
