import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
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
  title: "GeoTeX Studio — Academic Figure Editor for LaTeX/TikZ",
  description:
    "Create, edit, and export publication-ready mathematical and physics diagrams to clean LaTeX/TikZ code. Built for papers, theses, lecture notes, and olympiad solutions.",
  keywords: ["LaTeX", "TikZ", "GeoGebra", "diagram editor", "academic figures", "mathematics", "physics"],
  openGraph: {
    title: "GeoTeX Studio",
    description: "Figures built for TeX. A web-based academic figure editor with semantic TikZ export.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
