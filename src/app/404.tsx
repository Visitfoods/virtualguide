import Link from 'next/link';

export const metadata = {
  title: 'Página não encontrada | VirtualGuide',
};

export default function NotFoundPage() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f7f8fb',
      padding: '40px',
      position: 'relative',
      zIndex: 99999,
    }}>
      <div style={{
        maxWidth: 560,
        width: '100%',
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
        padding: '32px 28px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 64, fontWeight: 800, color: '#0b5cff', lineHeight: 1 }}>404</div>
        <h1 style={{ margin: '6px 0 12px', fontSize: 24, color: '#1f2937' }}>Página não encontrada</h1>
        <p style={{ margin: '0 0 24px', color: '#6b7280' }}>
          O endereço que procurou não existe ou foi removido.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link
            href="/"
            style={{
              padding: '10px 16px',
              background: '#0b5cff',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            Ir para o início
          </Link>
          <Link
            href="/backoffice"
            style={{
              padding: '10px 16px',
              background: '#111827',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
            }}
          >
            Ir para o Backoffice
          </Link>
        </div>
      </div>
    </main>
  );
}


