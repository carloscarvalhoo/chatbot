import AdminLoginForm from "@/components/admin/AdminLoginForm";

export const metadata = {
  title: "Painel do gestor · Acesso",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return <AdminLoginForm />;
}
