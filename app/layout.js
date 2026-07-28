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

export const metadata = {
  title: "Bapkes — Find the best deals with AI",
  description: "AI-powered deal finder that compares prices across stores.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="text-center text-xs text-gray-500 p-4">
          Bapkes may earn a commission when you buy through links on this site.
          Prices and availability are indicative and may change.
        </footer>
      </body>
    </html>
  );
}
