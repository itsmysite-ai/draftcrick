import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import { Providers } from "@/lib/providers";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: "tami\u00B7draft \u2014 Cricket Fantasy Drafting",
  description:
    "Powerful for experts, effortless for everyone. AI-powered fantasy cricket with Comfort Mode accessibility.",
  keywords: [
    "fantasy cricket",
    "IPL",
    "draft",
    "auction",
    "cricket",
    "fantasy sports",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
