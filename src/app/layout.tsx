import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { StagewiseToolbar } from "@stagewise/toolbar-next";
import ReactPlugin from "@stagewise-plugins/react";

const montserrat = Montserrat({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-montserrat"
});

export const metadata: Metadata = {
  title: "Portugal dos Pequenitos - VirtualGuide",
  description: "Landing page interativa com chatbot",
  icons: {
    icon: '/portugaldospequenitos/favicon.jpg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body className={montserrat.variable}>
        {children}
        <StagewiseToolbar 
          config={{
            plugins: [ReactPlugin],
          }}
        />
      </body>
    </html>
  );
}
