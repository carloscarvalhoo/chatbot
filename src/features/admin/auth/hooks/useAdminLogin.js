"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginAdminWithFirebase } from "@/features/admin/auth/services/adminAuthClient";

export function useAdminLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitLogin(event) {
    event.preventDefault();

    if (loading) return;

    try {
      setLoading(true);
      setError("");

      await loginAdminWithFirebase({
        email,
        password,
      });

      router.push("/admin/files");
      router.refresh();
    } catch (err) {
      setError(err?.message || "Erro ao fazer login.");
    } finally {
      setLoading(false);
    }
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    loading,
    error,
    submitLogin,
  };
}
