import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hive Inspect — Template Importer & Management",
  description:
    "Desktop inspection template importer. Faithful parsing of Spectora HTML-text exports into structured relational templates.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full flex flex-col bg-background text-foreground antialiased`}>
        <ToastProvider>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">{children}</main>
          <footer className="border-t py-6 text-center text-xs text-muted-foreground bg-muted/20">
            <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>Hive Inspect — Desktop Spectora Template Importer & Editor</span>
              <span className="font-mono">Next.js 14 • TypeScript • Tailwind • Supabase</span>
            </div>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}

