"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchSettings, updateSettings } from "@/features/admin/settings/services/settingsClient";

export function useSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch((err) => setError(err?.message))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async (data) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateSettings(data);
      setSettings((prev) => ({ ...prev, ...data }));
      setSuccess("Configurações salvas com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, loading, saving, error, success, save };
}
