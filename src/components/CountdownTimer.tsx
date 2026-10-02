"use client";

import { useEffect, useState } from "react";

function timeLeft(targetIso: string) {
  const diff = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, done: diff <= 0 };
}

export default function CountdownTimer({ targetIso }: { targetIso: string }) {
  const [left, setLeft] = useState(() => timeLeft(targetIso));

  useEffect(() => {
    const id = setInterval(() => {
      const next = timeLeft(targetIso);
      setLeft(next);
      // Cuando llega la hora, recarga para que el proxy ya no reescriba a
      // esta página — no hace falta desplegar nada, se abre sola.
      if (next.done) window.location.reload();
    }, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  const units: { label: string; value: number }[] = [
    { label: "días", value: left.days },
    { label: "horas", value: left.hours },
    { label: "min", value: left.minutes },
    { label: "seg", value: left.seconds },
  ];

  return (
    <div className="flex gap-4 sm:gap-6">
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center">
          <span className="font-display text-4xl font-bold text-brand sm:text-5xl">
            {String(u.value).padStart(2, "0")}
          </span>
          <span className="mt-1 text-xs uppercase tracking-wide text-white/60">{u.label}</span>
        </div>
      ))}
    </div>
  );
}
