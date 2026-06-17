import type { Metadata } from "next";
import { Inter, Hind_Siliguri } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/query-client";
import { ToastViewport } from "@/components/ui/ToastViewport";

/**
 * Fonts (design-system §4): Inter as the single UI family, Hind Siliguri for
 * Bangla content. Both are exposed as CSS variables and chained in
 * tailwind.config `fontFamily.sans` so one class renders both scripts.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind-siliguri",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Admin | Sports E-Commerce",
    template: "%s | Admin",
  },
  description: "Admin panel for the Sports E-Commerce platform.",
  // Admin UI must never be indexed.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${hindSiliguri.variable}`}>
      <body className="font-sans">
        <QueryProvider>
          {children}
          <ToastViewport />
        </QueryProvider>
      </body>
    </html>
  );
}
