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
  title: "Detalo — Find the right car part with AI",
  description: "AI-powered car-parts finder: enter your car and the part, get real listings that fit — with prices, fitment and OEM numbers.",
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
          Detalo may earn a commission when you buy through links on this site.
          Prices and availability are indicative and may change.
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
