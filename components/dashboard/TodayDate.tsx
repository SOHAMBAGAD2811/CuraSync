"use client";

import { useEffect, useState } from "react";

export function TodayDate() {
  const [dateStr, setDateStr] = useState<string | null>(null);

  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    );
  }, []);

  if (!dateStr) return null;

  return <p className="text-sm text-slate-500 mt-0.5">{dateStr}</p>;
}
