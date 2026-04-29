import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Incident Reporting (Safety and Security)",
  description: "Safety and security incident reporting dashboard"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
