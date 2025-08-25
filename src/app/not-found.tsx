'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Página não encontrada</h1>
      <p style={{ opacity: 0.8, margin: 0 }}>A página que procurou não existe.</p>
      <Link href="/virtualguide" style={{ marginTop: 12, textDecoration: 'underline' }}>
        Ir para o VirtualGuide
      </Link>
    </main>
  );
}



