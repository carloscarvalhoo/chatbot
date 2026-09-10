import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/services/firebase/client";

function getFriendlyFirebaseError(error) {
  const code = error?.code || "";

  if (
    code === "auth/invalid-credential" ||
    code === "auth/user-not-found" ||
    code === "auth/wrong-password" ||
    code === "auth/invalid-email"
  ) {
    return "E-mail ou senha inválidos.";
  }

  if (code === "auth/too-many-requests") {
    return "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.";
  }

  if (code === "auth/network-request-failed") {
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  }

  if (code === "auth/api-key-not-valid") {
    return "A configuração do Firebase está inválida.";
  }

  return "Não foi possível realizar o login.";
}

export async function loginAdminWithFirebase({ email, password }) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);

    const idToken = await credential.user.getIdToken();

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "Erro ao criar sessão administrativa.");
    }

    return data;
  } catch (error) {
    console.error("Erro no login admin:", error);

    if (error?.message && !error?.code) {
      throw new Error(error.message);
    }

    throw new Error(getFriendlyFirebaseError(error));
  }
}
