import { SCENARIOS, Simulation, STATE, STEP } from './motor.js';
import { createMap, createScene } from './visores.js';

const element = (id) => document.getElementById(id);
const scenario = element('scenario');
const description = element('scenario-description');
const status = element('status');
const start = element('start');
const reset = element('reset');
const advance = element('step');
const rate = element('rate');
const eventsList = element('events');
const eventsEmpty = element('events-empty');
const download = element('download');
const viewHint = element('view-hint');
const viewButtons = [...document.querySelectorAll('[data-view]')];
const scene = element('scene');
const map = element('map');
const drawMap = createMap(map);
const decimal = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const values = {
  time: element('time').firstChild,
  distance: element('distance').firstChild,
  speed: element('speed').firstChild,
  replans: element('replans').firstChild,
  contacts: element('contacts').firstChild
};

let simulation;
let playing = false;
let view;
let eventCount = 0;
let accumulated = 0;
let tick = 0;
let needsDraw = true;
let drawScene;
try {
  drawScene = createScene(scene, () => { needsDraw = true; });
} catch {
  viewButtons.find((button) => button.dataset.view === '3d').disabled = true;
}

function chooseView(next) {
  view = next;
  scene.hidden = next !== '3d';
  map.hidden = next !== 'map';
  viewHint.textContent = next === '3d' ? 'Arrastra para girar · Desplaza para acercar'
    : (drawScene ? '' : 'Vista 3D no disponible en este navegador');
  viewHint.hidden = viewHint.textContent === '';
  for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  needsDraw = true;
}

function setText(target, value) {
  if (target.data !== value) target.data = value;
}

function updateControls() {
  const state = !playing && simulation.state === 'moving' ? 'En pausa' : STATE[simulation.state];
  if (status.textContent !== state) status.textContent = state;
  status.parentElement.dataset.state = simulation.state;
  start.textContent = playing ? 'Pausar' : simulation.state === 'ready' || simulation.finished ? 'Iniciar' : 'Continuar';
  start.disabled = simulation.finished;
  advance.disabled = playing || simulation.finished;
  download.disabled = simulation.events.length === 0;
  setText(values.time, decimal.format(simulation.time) + ' ');
  setText(values.distance, decimal.format(simulation.distance) + ' ');
  setText(values.speed, decimal.format(playing ? simulation.speed : 0) + ' ');
  setText(values.replans, String(simulation.replans));
  setText(values.contacts, String(simulation.contacts));
  eventsEmpty.hidden = simulation.events.length > 0;
  for (const event of simulation.events.slice(eventCount)) {
    const entry = document.createElement('li');
    const time = document.createElement('time');
    const message = document.createElement('span');
    time.dateTime = `PT${event.time.toFixed(2)}S`;
    time.textContent = `${decimal.format(event.time)} s`;
    message.textContent = event.message;
    entry.dataset.type = event.type;
    entry.append(time, message);
    eventsList.append(entry);
  }
  eventCount = simulation.events.length;
}

function restart() {
  simulation = new Simulation(scenario.value);
  description.textContent = SCENARIOS[scenario.value].description;
  eventsList.replaceChildren();
  eventCount = 0;
  playing = false;
  accumulated = 0;
  updateControls();
  needsDraw = true;
}

start.addEventListener('click', () => {
  if (simulation.state === 'ready') simulation.start();
  playing = !playing;
  accumulated = 0;
  updateControls();
  needsDraw = true;
});
reset.addEventListener('click', restart);
scenario.addEventListener('change', restart);
advance.addEventListener('click', () => {
  if (simulation.state === 'ready') simulation.start();
  for (let i = 0; i < 15 && !simulation.finished; i++) simulation.step();
  updateControls();
  needsDraw = true;
});
for (const button of viewButtons) button.addEventListener('click', () => chooseView(button.dataset.view));

download.addEventListener('click', () => {
  const rows = [
    ['Escenario', 'Estado actual', 'Tiempo de ejecución (s)', 'Distancia (m)', 'Recálculos', 'Contactos', 'Tiempo del evento (s)', 'Evento'],
    ...simulation.events.map((event) => [
      SCENARIOS[simulation.scenario].name, STATE[simulation.state], decimal.format(simulation.time),
      decimal.format(simulation.distance), simulation.replans, simulation.contacts, decimal.format(event.time), event.message
    ])
  ];
  const csv = '\uFEFF' + rows.map((row) => row.map((field) => '"' + String(field).replaceAll('"', '""') + '"').join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `navegacion-${simulation.scenario}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

chooseView(drawScene ? '3d' : 'map');
restart();
const resizeObserver = new ResizeObserver(() => { needsDraw = true; });
resizeObserver.observe(element('viewport'));

function animate(now) {
  const elapsed = tick ? Math.min((now - tick) / 1000, 0.1) : 0;
  tick = now;
  if (playing) {
    accumulated += elapsed * Number(rate.value);
    while (accumulated >= STEP && !simulation.finished) {
      simulation.step();
      accumulated -= STEP;
    }
    if (simulation.finished) playing = false;
    updateControls();
    needsDraw = true;
  }
  if (view === '3d' && needsDraw) drawScene(simulation);
  if (view === 'map' && needsDraw) drawMap(simulation);
  needsDraw = false;
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
