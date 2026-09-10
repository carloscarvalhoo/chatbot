import SettingsForm from "@/components/admin/SettingsForm";
import AccountForm from "@/components/admin/AccountForm";

export const metadata = { title: "Configurações" };

export default function AdminSettingsPage() {
  return (
    <div className="space-y-10">
      <SettingsForm />
      <AccountForm />
    </div>
  );
}
