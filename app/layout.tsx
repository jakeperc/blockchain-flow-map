import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blockchain Flow Map | Global settlement intelligence",
  description: "Explore attributed cross-border stablecoin settlement with inspectable evidence and transparent coverage.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
