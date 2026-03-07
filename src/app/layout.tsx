import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Binance Risk Copilot",
  description: "OpenClaw-powered Futures risk review MVP for Binance-focused demo submissions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${jetbrains.variable}`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
