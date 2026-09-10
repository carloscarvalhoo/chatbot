"use client";

import ConfirmProvider from "@/components/ui/ConfirmProvider";

export default function AdminLayout({ children }) {
  return <ConfirmProvider>{children}</ConfirmProvider>;
}
