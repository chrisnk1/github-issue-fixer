import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fix Together - AI-Powered GitHub Issue Fixer",
  description: "Collaborative AI-powered issue resolution with E2B Sandboxes and Google AI",
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
