import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "VoiceRAG Studio | Ultra-Low Latency Indic Voice RAG by AlphaCODERS",
  description: "End-to-end voice transcription, sub-200ms document retrieval, and native speech synthesis across 11 Indic languages powered by Sarvam AI & Groq.",
  keywords: [
    "VoiceRAG",
    "Indic Voice RAG",
    "AlphaCODERS",
    "Sarvam AI",
    "Hacker House Goa",
    "Hindi RAG",
    "Gujarati RAG",
    "Tamil RAG",
    "Telugu RAG",
    "Marathi RAG",
    "Real-time Voice Search",
    "Sub-200ms Retrieval"
  ],
  authors: [{ name: "AlphaCODERS" }],
  creator: "AlphaCODERS",
  publisher: "AlphaCODERS",
  robots: "index, follow",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" }
    ],
    apple: [
      { url: "/icon.svg", type: "image/svg+xml" }
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://voicestudio.iomd.site",
    title: "VoiceRAG Studio | Ultra-Low Latency Indic Voice RAG",
    description: "Real-time multilingual voice retrieval and synthesis across 11 Indic languages.",
    siteName: "VoiceRAG Studio by AlphaCODERS",
  },
  twitter: {
    card: "summary_large_image",
    title: "VoiceRAG Studio | Ultra-Low Latency Indic Voice RAG",
    description: "Real-time voice retrieval across 11 Indic languages by AlphaCODERS (HH Goa 2026).",
    creator: "@Harshitechs",
  },
  themeColor: "#060810",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased bg-void text-text-primary min-h-screen`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
