import type { Metadata, Viewport } from "next";
import { DM_Sans, Exo_2 } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { DunningBanner } from "@/components/billing/dunning-banner";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const exo2 = Exo_2({
  variable: "--font-exo2",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Chalk",
  description: "Shy Lounge Management",
};

export const viewport: Viewport = {
  themeColor: "#030712",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${exo2.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-exo2)]">
          {children}
          <DunningBanner />
          <Toaster />
        </body>
    </html>
  );
}
