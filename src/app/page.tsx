'use client';

import GuideWrapper from './[guideSlug]/page';

export default function HomeAsVirtualGuide() {
  const params = Promise.resolve({ guideSlug: 'virtualguide' });
  // Reutiliza a mesma página dinâmica para renderizar o guia "virtualguide" na raiz
  // Sem redirects nem rewrites
  return (
    // Tipagem compatível em runtime; o componente interno usa `use as usePromise`
    // para resolver os parâmetros
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    <GuideWrapper params={params} />
  );
}


