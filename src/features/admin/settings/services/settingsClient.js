export async function fetchSettings() {
  const response = await fetch("/api/admin/settings", { credentials: "include" });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Erro ao buscar configurações.");
  return data;
}

export async function updateSettings(payload) {
  const response = await fetch("/api/admin/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Erro ao salvar configurações.");
  return data;
}
