import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Detalo — Mopedų dalių turgus",
  description: "Pirk ir parduok mopedų dalis saugiai. Vinted stiliaus turgus mopedų bendruomenei — tikros kainos, aiškūs skelbimai, be Facebook grupių chaoso.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="text-center text-xs text-dim px-6 py-8 mt-auto border-t border-white/8">
          Detalo — mopedų dalių turgus. Skelbimus kuria patys vartotojai.
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
