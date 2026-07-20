import type { Metadata } from "next";
import { IBM_Plex_Mono, Sora, Newsreader } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";

const sora = Sora({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "TRAIVEL — AI Travel Planning",
  description:
    "AI-powered travel itineraries verified against real data. Every stop has a reason.",
  openGraph: {
    title: "TRAIVEL — AI Travel Planning",
    description: "Every stop verified. Every reason explained. Real data, not hallucinations.",
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
      className={`${sora.variable} ${newsreader.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Nav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
