"use client";

import { useEffect, useState } from "react";
import Select from "@/components/ui/Select";

function shortLabel(model) {
  const name = model
    .split("/")
    .pop()
    .replace(/:free$/, "");
  return name.length > 24 ? `${name.slice(0, 23)}…` : name;
}

export default function ModelPicker({ value, onChange }) {
  const [models, setModels] = useState([]);

  useEffect(() => {
    fetch("/api/chat/models")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => Array.isArray(d?.models) && setModels(d.models))
      .catch(() => {});
  }, []);

  if (models.length <= 1) return null;

  const options = [
    { value: "auto", label: "Automático", hint: "escolhe o mais rápido disponível" },
    ...models.map((m) => ({ value: m.spec, label: shortLabel(m.model), hint: m.provider })),
  ];

  return (
    <label className="flex items-center gap-2 text-sm text-zinc-500">
      <span className="hidden sm:inline">Modelo</span>
      <Select
        value={value}
        onChange={onChange}
        options={options}
        align="right"
        ariaLabel="Preferência de modelo de IA"
        className="w-[168px] sm:w-[210px]"
      />
    </label>
  );
}
