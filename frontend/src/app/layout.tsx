import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { MarketSocketProvider } from "../context/MarketSocketContext";
import { Navbar } from "../components/layout/Navbar";

export const metadata: Metadata = {
  title: "PulseTrader | Real-Time Indian Market Alert & Analysis Platform",
  description: "Live Indian stock and index monitoring with percentage-based UP/DOWN trigger alerts, real-time WebSockets, and technical analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-gray-100 antialiased min-h-screen flex flex-col">
        <AuthProvider>
          <MarketSocketProvider>
            <Navbar />
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
              {children}
            </main>
          </MarketSocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
