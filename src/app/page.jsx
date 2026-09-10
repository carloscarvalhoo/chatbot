import LandingPage from "@/components/site/LandingPage";
import { getSettings } from "@/server/settings/getSettings";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const settings = await getSettings();
  const name = settings.botName || "ELO";
  return {
    title: `${name} · Assistente Virtual Institucional`,
    description: `${name} é um assistente virtual inteligente que responde dúvidas institucionais de forma clara, rápida e segura.`,
  };
}

export default async function HomePage() {
  const settings = await getSettings();
  return <LandingPage settings={settings} />;
}
