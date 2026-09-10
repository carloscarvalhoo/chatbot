import ChatWidget from "@/components/chat/ChatWidget";
import { getSettings } from "@/server/settings/getSettings";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const settings = await getSettings();
  return <ChatWidget settings={settings} />;
}
