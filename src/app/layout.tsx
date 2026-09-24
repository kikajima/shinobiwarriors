import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Shinobi Online — MMORPG de fã de Naruto",
  description:
    "MMORPG online de fã estilo retrô 32-bit inspirado em Naruto. Combate ARPG com jutsus em hotkeys, mundo vivo com outros shinobis, missões e boss. Jogue no PC ou no celular.",
  keywords: ["Naruto", "MMORPG", "jogo online", "pixel art", "retro", "RPG de ação", "shinobi"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f0d0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased bg-[#0f0d0a] text-[#e8d5a9]">
        {/* fontes pixel retrô (com fallback monospace) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- carregada via CDN no navegador do usuário */}
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap"
          rel="stylesheet"
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
