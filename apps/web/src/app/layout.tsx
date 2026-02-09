import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Providers } from "@/lib/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "DraftCrick — The Next-Gen Fantasy Cricket Platform",
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
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
