import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TasawwurAI",
  description: "AI-powered real-time educational visualization platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
