export async function fetchAccount() {
  const response = await fetch("/api/admin/account", { credentials: "include" });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Erro ao carregar a conta.");
  return data;
}

export async function updateAccount(payload) {
  const response = await fetch("/api/admin/account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Erro ao atualizar a conta.");
  return data;
}
