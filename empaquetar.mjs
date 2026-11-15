import { mkdir, readFile, writeFile } from 'node:fs/promises';

const read = (file) => readFile(new URL(file, import.meta.url), 'utf8');
const license = await read('sim/vendor/LICENSE');
const style = await read('sim/estilos.css');
const modules = {
  three: 'sim/vendor/three.module.js',
  'simulacion/orbita': 'sim/vendor/OrbitControls.js',
  'simulacion/motor': 'sim/motor.js',
  'simulacion/visores': 'sim/visores.js',
  'simulacion/app': 'sim/app.js'
};
const imports = {};

for (const [name, file] of Object.entries(modules)) {
  let source = await read(file);
  if (name === 'simulacion/visores') {
    source = source.replace("from './vendor/OrbitControls.js'", "from 'simulacion/orbita'");
  }
  if (name === 'simulacion/app' || name === 'simulacion/visores') {
    source = source.replace("from './motor.js'", "from 'simulacion/motor'");
    source = source.replace("from './visores.js'", "from 'simulacion/visores'");
  }
  imports[name] = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
}

const sourcePage = await read('index.html');
const portable = sourcePage
  .replace('<link rel="stylesheet" href="./sim/estilos.css">', () => `<style>\n${style}</style>`)
  .replace(/<script type="importmap">.*?<\/script>/, () => `<script type="importmap">${JSON.stringify({ imports })}</script>`)
  .replace('<script type="module" src="./sim/app.js"></script>', '<script type="module">import "simulacion/app";</script>')
  .replace('<html lang="es">', () => `<!-- Three.js and OrbitControls\n${license}\n-->\n<html lang="es">`);
const hostedOutput = new URL('Simulacion_Vercel/public/', import.meta.url);
await mkdir(hostedOutput, { recursive: true });
await Promise.all([
  writeFile(new URL('Simulacion.html', import.meta.url), portable),
  writeFile(new URL('index.html', hostedOutput), portable)
]);
console.log('Simulacion.html y Simulacion_Vercel/public/index.html listos.');
