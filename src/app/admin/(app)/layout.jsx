import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/server/firebase/admin";
import { getSettings } from "@/server/settings/getSettings";
import AdminShell from "@/components/admin/AdminShell";

const ADMIN_COOKIE_NAME = "firebase_admin_session";

export const metadata = {
  title: {
    default: "Painel do gestor",
    template: "%s · Painel do gestor",
  },
  robots: { index: false, follow: false },
};

export default async function AdminAppLayout({ children }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!sessionCookie) redirect("/admin/login");

  try {
    await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    redirect("/admin/login");
  }

  const settings = await getSettings();

  return <AdminShell botName={settings.botName || "Assistente"}>{children}</AdminShell>;
}
