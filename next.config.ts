import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // basePath: '/portugaldospequenitos',
  // assetPrefix: '/portugaldospequenitos',
  
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
           ];
         },
};

export default nextConfig;
