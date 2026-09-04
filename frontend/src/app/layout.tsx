import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AmbientBackground } from "@/components/AmbientBackground";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: {
    default: "TasawwurAI — Real-time AI Visualization Studio",
    template: "%s · TasawwurAI",
  },
  description:
    "Speak naturally while teaching and watch interactive, AI-generated visualizations come to life in real time.",
};

export const viewport: Viewport = {
  themeColor: "#F2F7FC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Type system: Inter (UI) · Space Grotesk (display) · Instrument Serif (editorial accent) · JetBrains Mono (data) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=Instrument+Serif:ital,wght@0,400;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-mist-100 font-sans text-dusk-700 antialiased">
        <ToastProvider>
          <AmbientBackground />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
