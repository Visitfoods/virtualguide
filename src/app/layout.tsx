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
  description: "Guia Virtual",
  icons: {
    icon: '/favicon.jpg',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Bloquear zoom no iPhone
              document.addEventListener('gesturestart', function(e) {
                e.preventDefault();
              });
              
              document.addEventListener('gesturechange', function(e) {
                e.preventDefault();
              });
              
              document.addEventListener('gestureend', function(e) {
                e.preventDefault();
              });
              
              // Bloquear pinch zoom
              let lastTouchEnd = 0;
              document.addEventListener('touchend', function(event) {
                const now = (new Date()).getTime();
                if (now - lastTouchEnd <= 300) {
                  event.preventDefault();
                }
                lastTouchEnd = now;
              }, false);
              
              // Forçar escala 1
              document.addEventListener('touchmove', function(event) {
                if (event.scale !== 1) {
                  event.preventDefault();
                }
              }, { passive: false });
            `,
          }}
        />
      </head>
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
