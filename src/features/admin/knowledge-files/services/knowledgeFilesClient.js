export async function getKnowledgeFiles() {
  const response = await fetch("/api/admin/files", {
    method: "GET",
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Erro ao listar arquivos.");
  }

  return data.files || [];
}

export async function uploadKnowledgeFile(file, onProgress) {
  if (!file) {
    throw new Error("Nenhum arquivo selecionado.");
  }

  const fileName = file.name || "";

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new Error("Formato inválido. Envie apenas arquivos PDF.");
  }

  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", "/api/admin/files");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");

        if (xhr.status >= 200 && xhr.status < 300) {
          if (typeof onProgress === "function") {
            onProgress(100);
          }

          resolve(data);
          return;
        }

        reject(new Error(data?.error || "Erro ao enviar PDF."));
      } catch {
        reject(new Error("Erro ao processar resposta do servidor."));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Erro de conexão ao enviar PDF."));
    };

    xhr.send(formData);
  });
}

export async function deleteKnowledgeFile(fileDoc) {
  if (!fileDoc?.id) {
    throw new Error("Documento inválido.");
  }

  const response = await fetch("/api/admin/files", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: fileDoc.id,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Erro ao remover arquivo.");
  }

  return data;
}

export async function patchKnowledgeFile(id, payload) {
  const response = await fetch("/api/admin/files", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...payload }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "Erro ao atualizar documento.");
  }

  return data;
}

export async function reindexAllFiles() {
  const response = await fetch("/api/admin/reindex", { method: "POST" });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "Erro ao reindexar.");
  }

  return data;
}

export async function refreshUrls() {
  const response = await fetch("/api/admin/refresh-urls", { method: "POST" });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "Erro ao verificar atualizações.");
  }

  return data;
}

export async function logoutAdmin() {
  const response = await fetch("/api/admin/logout", {
    method: "POST",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Erro ao sair.");
  }

  return data;
}

/* ==========================================================================
   NOVA FUNÇÃO: INDEXAR URL / LINKS
   ========================================================================== */
// Dentro do seu arquivo de serviços (knowledgeFilesClient.js)
export async function indexKnowledgeUrl(urlsSelecionadas) {
  const response = await fetch("/api/admin/urls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // O backend agora espera a chave 'urlsSelecionadas'
    body: JSON.stringify({ urlsSelecionadas }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Erro ao processar URLs");
  }

  return data;
}
