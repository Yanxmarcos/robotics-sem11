import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { ALTERNATE_GATE, GOAL, GATE, SHELVES, START, WORLD, center } from './motor.js';

const PATH = { plan: '#45ccf6', reroute: '#f5c166', trace: '#88e6a4', sensor: '#de9afb' };
const start = center(START);
const goal = center(GOAL);
const { width, depth } = WORLD;

export function createMap(canvas) {
  const ctx = canvas.getContext('2d');
  return (sim) => {
    const viewWidth = canvas.clientWidth;
    const viewHeight = canvas.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(viewWidth * ratio) || canvas.height !== Math.round(viewHeight * ratio)) {
      canvas.width = Math.round(viewWidth * ratio);
      canvas.height = Math.round(viewHeight * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#192d3b';
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    const scale = Math.min((viewWidth - 38) / width, (viewHeight - 58) / depth);
    const offsetX = (viewWidth - width * scale) / 2;
    const offsetZ = (viewHeight - depth * scale) / 2;
    const x = (value) => offsetX + value * scale;
    const y = (value) => offsetZ + value * scale;

    function path(points, color, weight, pattern = []) {
      if (points.length < 2) return;
      ctx.beginPath();
      ctx.setLineDash(pattern);
      ctx.lineWidth = weight;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.moveTo(x(points[0].x), y(points[0].z));
      for (const point of points.slice(1)) ctx.lineTo(x(point.x), y(point.z));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = '#233b46';
    ctx.fillRect(x(0), y(0), width * scale, depth * scale);
    for (let i = 0; i <= width; i++) path([{ x: i, z: 0 }, { x: i, z: depth }], '#3d545e', 1);
    for (let i = 0; i <= depth; i++) path([{ x: 0, z: i }, { x: width, z: i }], '#3d545e', 1);
    for (const shelf of SHELVES) {
      ctx.fillStyle = '#56717d';
      ctx.fillRect(x(shelf.x) + 1, y(shelf.z) + 1, shelf.width * scale - 2, shelf.depth * scale - 2);
      ctx.fillStyle = '#7b939a';
      ctx.fillRect(x(shelf.x) + 2, y(shelf.z) + 2, shelf.width * scale - 4, 2);
    }
    path(sim.initialRoute.map(center), PATH.plan, 3, [6, 6]);
    if (sim.route !== sim.initialRoute) path(sim.route.map(center), PATH.reroute, 5.5);
    path(sim.trace, PATH.trace, 2);

    function box(cell, detected) {
      ctx.fillStyle = detected ? '#f98260' : '#c58960';
      ctx.fillRect(x(cell.x) + 2, y(cell.z) + 2, scale - 4, scale - 4);
      ctx.strokeStyle = '#422f38';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x(cell.x) + 4, y(cell.z) + 4, scale - 8, scale - 8);
    }
    if (sim.scenario === 'bloqueo') box(ALTERNATE_GATE, false);
    if (sim.obstaclePresent) box(GATE, sim.obstacleKnown);

    for (const sensor of sim.sensors) {
      path([sensor.origin, sensor.end], sensor.gate ? '#ffab91' : PATH.sensor, sensor.gate ? 2 : 1.25, [2, 4]);
    }

    for (const [point, label, color] of [[start, 'Salida', '#bde9fd'], [goal, 'Despacho', '#b0edae']]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x(point.x), y(point.z), Math.max(5, scale * 0.33), 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '600 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      ctx.fillText(label, x(point.x), y(point.z + 0.92));
    }
    ctx.save();
    ctx.translate(x(sim.position.x), y(sim.position.z));
    ctx.rotate(sim.heading);
    ctx.fillStyle = '#ffd381';
    ctx.strokeStyle = '#152934';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.max(8, scale * 0.44), 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#dbe9ec';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Norte ↑', x(0), y(0) - 9);
    ctx.textAlign = 'right';
    ctx.fillText('1 celda = 1 m', x(width), y(depth) + 18);
  };
}

const material = (color, metalness = 0.1, roughness = 0.73) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });

export function createScene(host, invalidate) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#192d3b');
  const camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 100);
  camera.position.set(17, 19, 24);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor('#192d3b');
  renderer.domElement.setAttribute('aria-label', 'Almacén 3D con cámaras orbitales y robot móvil');
  host.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(9, 0.12, 6);
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minPolarAngle = 0.13;
  controls.minZoom = 0.68;
  controls.maxZoom = 3;
  controls.update();
  controls.addEventListener('change', invalidate);

  scene.add(new THREE.HemisphereLight('#ecf8ff', '#5a6d6a', 2));
  const sun = new THREE.DirectionalLight('#fff3db', 2.7);
  sun.position.set(4, 16, 13);
  sun.target.position.set(9, 0, 6);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 10, bottom: -10, near: 0.5, far: 36 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.025;
  sun.shadow.camera.updateProjectionMatrix();

  function block(parent, mat, sx, sy, sz, x, y, z, casts = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = casts;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function lines(parent, color, points, opacity = 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(({ x, y, z }) => new THREE.Vector3(x, y, z)));
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: opacity !== 1, opacity }));
    parent.add(line);
    return line;
  }

  block(scene, material('#334653'), width + 0.32, 0.35, depth + 0.32, 9, -0.22, 6, false);
  block(scene, material('#53656b'), width, 0.05, depth, 9, -0.025, 6, false);
  const grid = [];
  for (let x = 0; x <= width; x++) grid.push({ x, y: 0.008, z: 0 }, { x, y: 0.008, z: depth });
  for (let z = 0; z <= depth; z++) grid.push({ x: 0, y: 0.008, z }, { x: width, y: 0.008, z });
  lines(scene, '#b2c5c8', grid, 0.28);

  const steel = material('#426174', 0.34);
  const trim = material('#93aab2', 0.4);
  const shelf = material('#687984');
  const boxes = ['#bd844d', '#d9a86d', '#839a9f', '#a16e51'].map((color) => material(color));
  const tape = material('#e3c395');
  for (const [index, rack] of SHELVES.entries()) {
    const rackGroup = new THREE.Group();
    scene.add(rackGroup);
    const longZ = rack.depth > rack.width;
    rackGroup.position.set(rack.x + rack.width / 2, 0, rack.z + rack.depth / 2);
    rackGroup.rotation.y = longZ ? Math.PI / 2 : 0;
    const span = (longZ ? rack.depth : rack.width) - 0.12;
    const thick = (longZ ? rack.width : rack.depth) - 0.14;
    const bays = Math.ceil(span / 1.1);
    for (let bay = 0; bay <= bays; bay++) {
      const x = -span / 2 + bay * span / bays;
      for (const side of [-1, 1]) block(rackGroup, steel, 0.055, 1.58, 0.065, x, 0.79, side * thick / 2);
    }
    for (const level of [0.16, 0.71, 1.24]) {
      block(rackGroup, shelf, span, 0.063, thick, 0, level, 0);
      for (const side of [-1, 1]) block(rackGroup, trim, span, 0.055, 0.065, 0, level + 0.04, side * thick / 2);
      for (let bay = 0; bay < bays; bay++) {
        const cargoX = -span / 2 + (bay + 0.5) * span / bays;
        const tall = 0.27 + 0.045 * ((bay + index) % 4);
        const wide = 0.38 + 0.05 * (bay % 3);
        const cargoZ = ((bay + index) % 3 - 1) * thick * 0.18;
        const cargoDepth = Math.min(thick * 0.54, 0.7);
        if (level === 1.24 && (bay + index) % 5 === 0) continue;
        block(rackGroup, boxes[(bay + index + Math.round(level * 10)) % boxes.length],
          wide, tall, cargoDepth, cargoX, level + 0.033 + tall / 2, cargoZ);
        block(rackGroup, tape, 0.06, 0.008, cargoDepth, cargoX, level + 0.039 + tall, cargoZ, false);
      }
    }
  }

  function station(point, color, name) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.49, 36), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(point.x, 0.023, point.z);
    scene.add(ring);
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    context.fillStyle = '#182d39';
    context.fillRect(0, 3, 384, 90);
    context.fillStyle = color;
    context.font = '700 45px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(name, 192, 49);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide }));
    label.rotation.x = -Math.PI / 2;
    label.position.set(point.x, 0.027, point.z + 0.68);
    scene.add(label);
  }
  station(start, '#bde9fd', 'SALIDA');
  station(goal, '#b0edae', 'DESPACHO');

  function crate(cell) {
    const point = center(cell);
    const group = new THREE.Group();
    group.position.set(point.x, 0, point.z);
    const wood = material('#d2754e');
    const brace = material('#f3ae72');
    block(group, wood, 0.99, 0.83, 0.99, 0, 0.415, 0);
    for (const edge of [-0.45, 0.45]) {
      block(group, brace, 0.07, 0.85, 0.99, edge, 0.43, 0);
      block(group, brace, 0.99, 0.05, 0.07, 0, 0.846, edge);
    }
    scene.add(group);
    return group;
  }
  const gate = crate(GATE);
  const alternate = crate(ALTERNATE_GATE);
  const robot = new THREE.Group();
  const rubber = material('#192432');
  const silver = material('#aab9bf', 0.52);
  block(robot, silver, 0.42, 0.16, 0.40, 0, 0.18, 0);
  block(robot, material('#f5ae47', 0.2), 0.38, 0.16, 0.32, -0.004, 0.34, 0);
  block(robot, material('#303c3f'), 0.10, 0.10, 0.22, 0.184, 0.31, 0);
  for (const side of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.123, 0.123, 0.074, 16), rubber);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(-0.035, 0.124, side * 0.22);
    wheel.castShadow = true;
    robot.add(wheel);
    block(robot, silver, 0.09, 0.09, 0.018, -0.035, 0.124, side * 0.261);
  }
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.053, 0.053, 0.08, 12), new THREE.MeshBasicMaterial({ color: '#9afaf6' }));
  beacon.position.set(0.09, 0.455, 0);
  robot.add(beacon);
  const locator = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.46, 32), new THREE.MeshBasicMaterial({ color: '#ffd381', side: THREE.DoubleSide }));
  locator.rotation.x = -Math.PI / 2;
  locator.position.y = 0.037;
  robot.add(locator);
  scene.add(robot);

  function routeLine(color, radius, y) {
    const group = new THREE.Group();
    scene.add(group);
    const mat = new THREE.MeshBasicMaterial({ color });
    return (points) => {
      for (const mesh of [...group.children]) {
        group.remove(mesh);
        mesh.geometry.dispose();
      }
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(length + radius, 0.014, radius), mat);
        mesh.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
        mesh.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
        group.add(mesh);
      }
    };
  }
  const drawPlan = routeLine(PATH.plan, 0.075, 0.031);
  const drawReroute = routeLine(PATH.reroute, 0.10, 0.047);
  const trace = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: PATH.trace }));
  scene.add(trace);
  const rayPositions = new THREE.BufferAttribute(new Float32Array(18), 3);
  const rayColors = new THREE.BufferAttribute(new Float32Array(18), 3);
  const rayGeometry = new THREE.BufferGeometry();
  rayGeometry.setAttribute('position', rayPositions);
  rayGeometry.setAttribute('color', rayColors);
  const rays = new THREE.LineSegments(rayGeometry, new THREE.LineBasicMaterial({ vertexColors: true }));
  rays.frustumCulled = false;
  scene.add(rays);
  const sensedColor = new THREE.Color('#ffab91');
  const activeColor = new THREE.Color(PATH.sensor);

  let lastInitial, lastRoute, lastTrace, count, lastWidth, lastHeight;
  return (sim) => {
    if (!host.clientWidth || !host.clientHeight) return;
    if (host.clientWidth !== lastWidth || host.clientHeight !== lastHeight) {
      lastWidth = host.clientWidth;
      lastHeight = host.clientHeight;
      const aspect = lastWidth / lastHeight;
      const halfHeight = Math.max(7.0, 10.6 / aspect);
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(lastWidth, lastHeight, false);
    }
    gate.visible = sim.obstaclePresent;
    alternate.visible = sim.scenario === 'bloqueo';
    robot.position.set(sim.position.x, 0, sim.position.z);
    robot.rotation.y = -sim.heading;
    if (lastInitial !== sim.initialRoute) {
      drawPlan(sim.initialRoute.map(center));
      lastInitial = sim.initialRoute;
    }
    if (lastRoute !== sim.route) {
      drawReroute(sim.route === sim.initialRoute ? [] : sim.route.map(center));
      lastRoute = sim.route;
    }
    if (lastTrace !== sim.trace || count !== sim.trace.length) {
      trace.geometry.dispose();
      trace.geometry = new THREE.BufferGeometry().setFromPoints(sim.trace.map(({ x, z }) => new THREE.Vector3(x, 0.067, z)));
      lastTrace = sim.trace;
      count = sim.trace.length;
    }
    sim.sensors.forEach((ray, i) => {
      rayPositions.setXYZ(i * 2, ray.origin.x, 0.31, ray.origin.z);
      rayPositions.setXYZ(i * 2 + 1, ray.end.x, 0.31, ray.end.z);
      const color = ray.gate ? sensedColor : activeColor;
      for (const vertex of [i * 2, i * 2 + 1]) rayColors.setXYZ(vertex, color.r, color.g, color.b);
    });
    rayPositions.needsUpdate = true;
    rayColors.needsUpdate = true;
    renderer.render(scene, camera);
  };
}
