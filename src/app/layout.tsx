import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Serller | Social, owned by you",
  description: "A social network built around user owned identity on Stellar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
