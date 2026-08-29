import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "QuantFeed - AI-Powered Economic Intelligence",
  description:
    "Neural network visualization of news interconnections with AI-powered economic analysis, pathway predictions, and quantifiable outcomes for the Indian and global economy.",
  keywords: [
    "economics",
    "AI analysis",
    "news",
    "India",
    "predictions",
    "neural network",
  ],
  openGraph: {
    title: "QuantFeed - AI-Powered Economic Intelligence",
    description: "Neural network of economic news with AI-powered pathway predictions",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className={`${inter.className} antialiased min-h-screen bg-dark-900 text-foreground`}>
        <div className="gradient-mesh" />
        <div className="relative flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar />
            <main className="flex-1 overflow-y-auto px-5 pb-6 pt-4 lg:px-8 lg:pb-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
