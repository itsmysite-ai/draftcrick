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
  title: "DraftPlay.ai \u2014 Fantasy Gaming. Not Gambling.",
  description:
    "All Thrill. Pure Skill. The fantasy sports platform where your knowledge wins \u2014 not your wallet. No deposits. No withdrawals. Legal everywhere.",
  keywords: [
    "fantasy sports",
    "fantasy cricket",
    "fantasy gaming",
    "no gambling",
    "IPL",
    "draft",
    "auction",
    "cricket",
    "skill based gaming",
  ],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png" },
    ],
  },
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
