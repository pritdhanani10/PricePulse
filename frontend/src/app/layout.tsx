import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { MarketSocketProvider } from "../context/MarketSocketContext";
import { Navbar } from "../components/layout/Navbar";
import { MobileBottomNav } from "../components/layout/MobileBottomNav";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#080A0F",
};

export const metadata: Metadata = {
  title: "PulseTrader | Real-Time Indian Market Alert & Analysis Platform",
  description: "Live Indian stock and index monitoring with percentage-based UP/DOWN trigger alerts, real-time WebSockets, and technical analysis.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-gray-100 antialiased min-h-screen flex flex-col selection:bg-cyan-500 selection:text-black">
        <AuthProvider>
          <MarketSocketProvider>
            <Navbar />
            <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-8">
              {children}
            </main>
            <MobileBottomNav />
          </MarketSocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
