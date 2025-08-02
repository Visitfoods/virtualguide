import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Backoffice - Guia Real',
  description: 'Painel administrativo para gerenciar conversas do Guia Real',
};

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body>
        {children}
      </body>
    </html>
  );
} 