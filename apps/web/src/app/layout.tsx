import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Weighing Logs",
  description: "Factory vehicle weighing logs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
