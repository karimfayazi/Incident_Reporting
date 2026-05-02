import type { Metadata } from "next";
import { ToasterProvider } from "@/components/ToasterProvider";
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
      <body>
        {children}
        <ToasterProvider />
      </body>
    </html>
  );
}
