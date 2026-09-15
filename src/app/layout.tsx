import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vestigium — Dokumentasi Operasional Forensik Digital",
  description:
    "Sistem chain-of-custody selaras ISO/IEC 27037:2012 — append-only, dual timestamp, dapat diaudit.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* SEC-03 — CSP ditegakkan hanya pada build produksi: mode dev Next memakai eval()
            dan WebSocket HMR yang akan diblokir CSP. Artefak yang di-deploy = export statis
            (NODE_ENV=production) → S7 ditegakkan browser di sana. React 19 menaikkan <meta>
            ini ke <head>. */}
        {process.env.NODE_ENV === "production" && (
          <meta
            httpEquiv="Content-Security-Policy"
            content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'"
          />
        )}
        {children}
      </body>
    </html>
  );
}
