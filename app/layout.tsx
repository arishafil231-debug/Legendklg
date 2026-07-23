import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Легенды Калуги — городская память",
  description: "Открытая коллекция легенд, истории, идентичности и проектов Калуги.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Легенды Калуги",
    description: "Городская память, собранная вместе",
    images: [{ url: "/cover.webp", width: 1600, height: 835 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Легенды Калуги",
    description: "Городская память, собранная вместе",
    images: ["/cover.webp"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
