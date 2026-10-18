"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirige transparentemente al portal de reserva en /
export default function ReservarRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex items-center gap-3 text-[#2F5D57] font-semibold text-sm">
        <span className="w-4 h-4 border-2 border-[#5BB9A6] border-t-transparent rounded-full animate-spin" />
        <span>Cargando Portal de Agendamiento...</span>
      </div>
    </div>
  );
}
