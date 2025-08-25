import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aumentar o limite de tamanho do corpo da requisição
  api: {
    bodyParser: {
      sizeLimit: '500mb',
    },
    responseLimit: '500mb',
  },
  /* config options here */
  // basePath: '/portugaldospequenitos',
  // assetPrefix: '/portugaldospequenitos',
  // Sem redirects: a página principal renderiza diretamente o guia
  
  // Configuração para imagens de domínios externos
  images: {
    domains: [
      'visitfoods.pt',
      'virtualguide.info',
      'lhwp3192.webapps.net'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'visitfoods.pt',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'virtualguide.info',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lhwp3192.webapps.net',
        port: '',
        pathname: '/**',
      }
    ],
  },

  // Configuração para servir ficheiros VTT com o Content-Type correto
  async headers() {
    return [
      {
        source: '/legendas.vtt',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/vtt; charset=utf-8',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        source: '/legendas-desktop.vtt',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/vtt; charset=utf-8',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        source: '/legendas-mobile.vtt',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/vtt; charset=utf-8',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        source: '/legendas-tablet.vtt',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/vtt; charset=utf-8',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;