export const WORLD = { width: 18, depth: 12, radius: 0.28, clearance: 0.12 };
export const START = { x: 2, z: 6 };
export const GOAL = { x: 15, z: 6 };
export const GATE = { x: 8, z: 6 };
export const ALTERNATE_GATE = { x: 8, z: 2 };
export const SENSOR_RANGE = 2.45;
export const SENSOR_ANGLES = [-Math.PI / 12, 0, Math.PI / 12];
export const SPEED = 1.4;
export const STEP = 1 / 60;
export const SPAWN_AT = 1.8;

const rectangles = [
  [8, 0, 2, 2], [8, 3, 2, 3], [8, 7, 2, 5],
  [3, 4, 3, 2], [3, 8, 3, 2], [12, 4, 3, 2], [12, 8, 3, 2],
  [2, 0, 4, 1], [12, 0, 4, 1], [2, 11, 4, 1], [12, 11, 4, 1]
];
export const SHELVES = rectangles.map(([x, z, width, depth]) => ({ x, z, width, depth }));
export const SCENARIOS = {
  base: { name: 'Recorrido base', description: 'El pasillo principal está libre. El robot calcula la ruta y llega al despacho.' },
  desvio: { name: 'Obstáculo inesperado', description: 'Aparece una caja en el pasillo principal. El robot puede desviarse por el paso norte.' },
  bloqueo: { name: 'Destino inaccesible', description: 'El paso norte está cerrado desde el inicio. Una caja termina de bloquear el acceso al despacho.' }
};

export const STATE = {
  ready: 'Listo',
  moving: 'En marcha',
  detected: 'Obstáculo detectado',
  arrived: 'Meta alcanzada',
  blocked: 'Sin ruta disponible',
  contact: 'Contacto'
};

export const center = (cell) => ({ x: cell.x + 0.5, z: cell.z + 0.5 });
const cellAt = ({ x, z }) => ({ x: Math.floor(x), z: Math.floor(z) });
const key = ({ x, z }) => z * WORLD.width + x;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const gateBox = (cell) => ({ ...cell, width: 1, depth: 1 });
const neighbours = [[1, 0], [0, -1], [-1, 0], [0, 1]];

function touches(position, obstacle, radius) {
  const x = clamp(position.x, obstacle.x, obstacle.x + obstacle.width);
  const z = clamp(position.z, obstacle.z, obstacle.z + obstacle.depth);
  return Math.hypot(position.x - x, position.z - z) <= radius;
}

export function plan(start, goal, obstacles) {
  function passable(cell) {
    if (cell.x < 0 || cell.z < 0 || cell.x >= WORLD.width || cell.z >= WORLD.depth) return false;
    return !obstacles.some((obstacle) => touches(center(cell), obstacle, WORLD.radius + WORLD.clearance));
  }
  if (!passable(start) || !passable(goal)) return [];
  const startKey = key(start);
  const goalKey = key(goal);
  const open = [{ ...start, cost: 0, heuristic: manhattan(start, goal) }];
  const costs = new Map([[startKey, 0]]);
  const parents = new Map();
  while (open.length) {
    open.sort((a, b) => (a.cost + a.heuristic) - (b.cost + b.heuristic) || a.heuristic - b.heuristic);
    const current = open.shift();
    const currentKey = key(current);
    if (current.cost !== costs.get(currentKey)) continue;
    if (currentKey === goalKey) {
      const path = [];
      for (let node = current; node; node = parents.get(key(node))) path.push({ x: node.x, z: node.z });
      return path.reverse();
    }
    for (const [dx, dz] of neighbours) {
      const next = { x: current.x + dx, z: current.z + dz };
      if (!passable(next)) continue;
      const nextKey = key(next);
      const cost = current.cost + 1;
      if (cost >= (costs.get(nextKey) ?? Infinity)) continue;
      costs.set(nextKey, cost);
      parents.set(nextKey, current);
      open.push({ ...next, cost, heuristic: manhattan(next, goal) });
    }
  }
  return [];
}

function rayDistance(origin, dx, dz, box) {
  let near = 0;
  let far = Infinity;
  for (const [value, direction, low, high] of [
    [origin.x, dx, box.x, box.x + box.width],
    [origin.z, dz, box.z, box.z + box.depth]
  ]) {
    if (Math.abs(direction) < 1e-9) {
      if (value < low || value > high) return Infinity;
      continue;
    }
    const first = (low - value) / direction;
    const second = (high - value) / direction;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return Infinity;
  }
  return near;
}

export class Simulation {
  constructor(scenario = 'desvio') {
    if (!Object.hasOwn(SCENARIOS, scenario)) throw new RangeError('Escenario desconocido');
    this.scenario = scenario;
    this.position = center(START);
    this.heading = 0;
    this.state = 'ready';
    this.time = 0;
    this.distance = 0;
    this.replans = 0;
    this.contacts = 0;
    this.speed = 0;
    this.obstaclePresent = false;
    this.obstacleKnown = false;
    this.events = [];
    this.trace = [{ ...this.position }];
    this.staticObstacles = scenario === 'bloqueo' ? [...SHELVES, gateBox(ALTERNATE_GATE)] : SHELVES;
    this.gate = gateBox(GATE);
    this.route = [];
    this.initialRoute = [];
    this.sensors = this.readSensors();
  }

  get finished() {
    return ['arrived', 'blocked', 'contact'].includes(this.state);
  }

  log(type, message) {
    this.events.push({ time: this.time, type, message });
  }

  start() {
    if (this.state !== 'ready') return;
    this.route = plan(START, GOAL, this.staticObstacles);
    this.initialRoute = this.route;
    this.targetIndex = 1;
    this.state = 'moving';
    this.log('plan', 'Ruta inicial calculada');
  }

  readSensors() {
    const world = this.obstaclePresent ? [...this.staticObstacles, this.gate] : this.staticObstacles;
    const origin = {
      x: this.position.x + Math.cos(this.heading) * 0.23,
      z: this.position.z + Math.sin(this.heading) * 0.23
    };
    return SENSOR_ANGLES.map((offset) => {
      const angle = this.heading + offset;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      let range = SENSOR_RANGE;
      let obstacle = null;
      for (const candidate of world) {
        const hit = rayDistance(origin, dx, dz, candidate);
        if (hit < range) {
          range = hit;
          obstacle = candidate;
        }
      }
      return { origin, end: { x: origin.x + dx * range, z: origin.z + dz * range }, range, hit: obstacle !== null, gate: obstacle === this.gate };
    });
  }

  replan() {
    this.replans += 1;
    this.route = plan(cellAt(this.position), GOAL, [...this.staticObstacles, this.gate]);
    if (!this.route.length) {
      this.state = 'blocked';
      this.log('blocked', 'Sin ruta disponible. Parada segura');
      return;
    }
    this.targetIndex = 0;
    this.state = 'moving';
    this.log('replan', 'Desvío calculado por el paso norte');
  }

  step(dt = STEP) {
    if (this.state === 'ready' || this.finished) return;
    this.time += dt;
    this.speed = 0;
    if (this.scenario !== 'base' && !this.obstaclePresent && this.time + 1e-9 >= SPAWN_AT) {
      this.obstaclePresent = true;
      this.log('spawn', 'Caja en el pasillo principal');
    }
    this.sensors = this.readSensors();
    if (this.state === 'detected') {
      if (this.time - this.detectedAt >= 0.95) this.replan();
      return;
    }
    if (!this.obstacleKnown && this.sensors.some((sensor) => sensor.gate)) {
      this.obstacleKnown = true;
      this.detectedAt = this.time;
      this.state = 'detected';
      this.log('detect', 'El sensor detectó la caja. Robot detenido');
      return;
    }
    const target = center(this.route[this.targetIndex]);
    const remaining = distance(this.position, target);
    if (remaining <= 1e-8) {
      this.targetIndex += 1;
      if (this.targetIndex === this.route.length) {
        this.state = 'arrived';
        this.log('arrive', 'Robot en la estación de despacho');
      }
      return;
    }
    const desired = Math.atan2(target.z - this.position.z, target.x - this.position.x);
    const delta = angleDifference(desired, this.heading);
    const turnLimit = Math.PI * dt;
    this.heading += clamp(delta, -turnLimit, turnLimit);
    if (Math.abs(delta) > turnLimit) {
      this.sensors = this.readSensors();
      return;
    }
    const advance = Math.min(remaining, SPEED * dt);
    const next = remaining <= advance ? target : {
      x: this.position.x + (target.x - this.position.x) * advance / remaining,
      z: this.position.z + (target.z - this.position.z) * advance / remaining
    };
    const world = this.obstaclePresent ? [...this.staticObstacles, this.gate] : this.staticObstacles;
    if (world.some((obstacle) => touches(next, obstacle, WORLD.radius))) {
      this.contacts += 1;
      this.state = 'contact';
      this.log('contact', 'Contacto con un obstáculo. Robot detenido');
      return;
    }
    this.position = next;
    this.speed = advance / dt;
    this.distance += advance;
    if (distance(this.trace.at(-1), next) >= 0.075 || remaining <= advance) this.trace.push({ ...next });
    this.sensors = this.readSensors();
  }
}
