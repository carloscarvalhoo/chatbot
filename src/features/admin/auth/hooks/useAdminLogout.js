"use client";

import { useRouter } from "next/navigation";
import { logoutAdmin } from "@/features/admin/knowledge-files/services/knowledgeFilesClient";

export function useAdminLogout() {
  const router = useRouter();

  async function logout() {
    try {
      await logoutAdmin();
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  }

  return { logout };
}
