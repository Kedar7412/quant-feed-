import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

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
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[#0a0a0f]">
        <div className="gradient-mesh" />
        <div className="relative flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6 lg:p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
