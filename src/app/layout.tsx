import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { getWebsiteSettings } from "@/lib/platform-website";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await getWebsiteSettings();
  return {
    title: `${site.brandName} — CRM & Sales`,
    description: "Omnichannel CRM for complaints, sales, and customer success",
    icons: site.faviconUrl
      ? {
          icon: [
            { url: site.faviconUrl, type: "image/png" },
            { url: site.faviconUrl },
          ],
          shortcut: site.faviconUrl,
          apple: site.faviconUrl,
        }
      : undefined,
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
