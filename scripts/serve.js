'use strict';

const http = require('node:http');
const fs = require('node:fs');
const root = __dirname.slice(0, -'/scripts'.length);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(request.url.split('?')[0]); }
  catch { response.writeHead(400); response.end('Solicitud inválida'); return; }
  if (pathname === '/') pathname = '/index.html';
  const extension = pathname.match(/\.[a-z]+$/i)?.[0];
  if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some((segment) => segment === '..' || segment.startsWith('.')) || !types[extension]) {
    response.writeHead(404); response.end('No encontrado'); return;
  }
  fs.readFile(root + pathname, (error, contents) => {
    if (error) { response.writeHead(404); response.end('No encontrado'); return; }
    response.writeHead(200, { 'Content-Type': types[extension], 'X-Content-Type-Options': 'nosniff' });
    response.end(contents);
  });
}).listen(3000, '127.0.0.1', () => console.log('BEIQA disponible en el puerto 3000'));
