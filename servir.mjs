import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const root = new URL('./', import.meta.url);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2'
};
const port = Number(process.env.SIMULADOR_PUERTO ?? 8011);

const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    const file = path === '/' ? 'index.html' : path.slice(1);
    const isPublic = file === 'index.html' || /^sim\/(?:[\w-]+\/)*[\w.-]+$/.test(file);
    if (!isPublic || !types[extname(file)]) {
      response.writeHead(404).end('Archivo no disponible');
      return;
    }
    const content = await readFile(new URL(file, root));
    response.writeHead(200, {
      'Content-Type': types[extname(file)],
      'Cache-Control': 'no-store'
    }).end(content);
  } catch {
    response.writeHead(404).end('Archivo no disponible');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Abre http://127.0.0.1:${port} en el navegador.`));
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} ya está en uso.` : error.message);
  process.exitCode = 1;
});
