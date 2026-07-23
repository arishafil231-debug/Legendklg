import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Легенды Калуги — городская память",
  description: "Открытая коллекция легенд, истории, идентичности и проектов Калуги.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Легенды Калуги",
    description: "Городская память, собранная вместе",
    images: [{ url: "/og.png", width: 1738, height: 907 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Легенды Калуги",
    description: "Городская память, собранная вместе",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
