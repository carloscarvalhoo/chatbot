import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

// Título dinâmico é definido por cada page.jsx que conhece o botName
export const metadata = {
  title: "Assistente Virtual",
  description:
    "Assistente virtual inteligente para orientação sobre serviços e informações institucionais.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={`${spaceGrotesk.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
