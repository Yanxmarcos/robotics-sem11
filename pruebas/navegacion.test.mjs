import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALTERNATE_GATE, GATE, GOAL, Simulation, center } from '../sim/motor.js';

function run(scenario) {
  const simulation = new Simulation(scenario);
  simulation.start();
  for (let i = 0; i < 2400 && !simulation.finished; i++) simulation.step();
  assert.equal(simulation.contacts, 0);
  return simulation;
}

test('recorrido base por el pasillo principal', () => {
  const simulation = run('base');
  assert.equal(simulation.state, 'arrived');
  assert.equal(simulation.replans, 0);
  assert.equal(Math.round(simulation.distance), 13);
  assert.deepEqual(simulation.position, center(GOAL));
});

test('la caja se detecta después de aparecer y el robot se desvía por el norte', () => {
  const simulation = run('desvio');
  assert.equal(simulation.state, 'arrived');
  assert.equal(simulation.replans, 1);
  assert.deepEqual(simulation.events.map(({ type }) => type), ['plan', 'spawn', 'detect', 'replan', 'arrive']);
  assert.ok(simulation.events[2].time > simulation.events[1].time);
  assert.ok(simulation.route.some(({ x, z }) => x === ALTERNATE_GATE.x && z === ALTERNATE_GATE.z));
  assert.ok(simulation.route.every(({ x, z }) => x !== GATE.x || z !== GATE.z));
  assert.deepEqual(simulation.position, center(GOAL));
});

test('sin un paso alternativo el robot detiene la misión antes de tocar la caja', () => {
  const simulation = run('bloqueo');
  assert.equal(simulation.state, 'blocked');
  assert.equal(simulation.replans, 1);
  assert.equal(simulation.route.length, 0);
  assert.equal(simulation.speed, 0);
  assert.ok(simulation.position.x < GATE.x);
  const position = { ...simulation.position };
  simulation.step();
  assert.deepEqual(simulation.position, position);
});
