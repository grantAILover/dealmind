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
  title: "Detalo — Rask tinkamą auto detalę su DI",
  description: "DI paremtas auto detalių ieškiklis: įvesk automobilį ir detalę — gauk realius, tinkančius pasiūlymus su kainomis, tinkamumu ir OEM numeriais.",
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
          Detalo gali gauti komisinį, kai perki per nuorodas šioje svetainėje.
          Kainos ir prieinamumas yra orientaciniai ir gali keistis.
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
