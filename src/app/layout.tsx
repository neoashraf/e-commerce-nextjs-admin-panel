import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/query-client";

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
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
