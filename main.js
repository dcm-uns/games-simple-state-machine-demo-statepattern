'use strict';

// 1. Estados posibles (enumerado)
const State = Object.freeze({ PATROL: 0, CHASE: 1, ATTACK: 2, HURT: 3, DEATH: 4 });
const StateName = Object.fromEntries(Object.entries(State).map(([k, v]) => [v, k]));

// Animaciones por estado: hoja de sprites 112x96 por frame
const FW = 112, FH = 96;
const ANIMS = {
  [State.PATROL]: { src: 'images/WALK.png', frames: 8, fps: 8, loop: true },
  [State.CHASE]: { src: 'images/RUN.png', frames: 8, fps: 12, loop: true },
  [State.ATTACK]: { src: 'images/ATTACK 1.png', frames: 8, fps: 12, loop: true },
  [State.HURT]: { src: 'images/HURT.png', frames: 8, fps: 14, loop: false },
  [State.DEATH]: { src: 'images/DEATH.png', frames: 15, fps: 10, loop: false },
};
for (const a of Object.values(ANIMS)) { a.img = new Image(); a.img.src = a.src; }

const SIGHT_RANGE = 200, LOSE_RANGE = 280, ATTACK_RANGE = 60;
const PATROL_SPEED = 50, CHASE_SPEED = 140, SCALE = 3;
const GROUND_Y = 280;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const logEl = document.getElementById('log');

const player = { x: 600, y: GROUND_Y };
const enemy = {};
let currentState, hp, facing, patrolDir, animTime, stateTime, patrolMin, patrolMax;

function reset() {
  Object.assign(enemy, { x: 150 });
  hp = 3; facing = 1; patrolDir = 1; patrolMin = 60; patrolMax = 300;
  currentState = State.PATROL; currentStateObj = STATES[State.PATROL]; animTime = 0; stateTime = 0;
  logEl.textContent = '';
  log('Inicio en PATROL');
}

function log(msg) {
  logEl.textContent += msg + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

function dist() { return Math.abs(player.x - enemy.x); }
function canSeePlayer() { return dist() < (currentState === State.CHASE || currentState === State.ATTACK ? LOSE_RANGE : SIGHT_RANGE); }
function playerInAttackRange() { return dist() < ATTACK_RANGE; }
function animFinished() {
  const a = ANIMS[currentState];
  return animTime * a.fps >= a.frames;
}

function changeState(newState) {
  if (newState === currentState) return;
  log(`${StateName[currentState]} -> ${StateName[newState]}`);
  currentStateObj.exit();
  currentState = newState;
  currentStateObj = STATES[newState];
  animTime = 0; stateTime = 0;
  currentStateObj.enter();
}

function physicsProcess(dt) {
  animTime += dt; stateTime += dt;
  currentStateObj.update(dt);
}

// Patrón State: cada estado encapsula su comportamiento
class EnemyState {
  constructor(id) { this.id = id; }
  enter() {}
  exit() {}
  update(dt) {}
  // Reacción al golpe; por defecto pasa a HURT o DEATH
  onHit() {
    if (hp <= 0) changeState(State.DEATH);
    else { changeState(State.HURT); animTime = 0; }
  }
}

class PatrolState extends EnemyState {
  constructor() { super(State.PATROL); }
  update(dt) {
    enemy.x += patrolDir * PATROL_SPEED * dt;
    if (enemy.x > patrolMax) patrolDir = -1;
    if (enemy.x < patrolMin) patrolDir = 1;
    facing = patrolDir;
    if (canSeePlayer()) changeState(State.CHASE);
  }
}

class ChaseState extends EnemyState {
  constructor() { super(State.CHASE); }
  update(dt) {
    facing = Math.sign(player.x - enemy.x) || facing;
    enemy.x += facing * CHASE_SPEED * dt;
    if (playerInAttackRange()) changeState(State.ATTACK);
    else if (!canSeePlayer()) changeState(State.PATROL);
  }
}

class AttackState extends EnemyState {
  constructor() { super(State.ATTACK); }
  update(dt) {
    facing = Math.sign(player.x - enemy.x) || facing;
    if (!playerInAttackRange()) changeState(State.CHASE);
  }
}

class HurtState extends EnemyState {
  constructor() { super(State.HURT); }
  update(dt) {
    if (animFinished()) changeState(canSeePlayer() ? State.CHASE : State.PATROL);
  }
}

class DeathState extends EnemyState {
  constructor() { super(State.DEATH); }
  onHit() {}
}

const STATES = {
  [State.PATROL]: new PatrolState(),
  [State.CHASE]: new ChaseState(),
  [State.ATTACK]: new AttackState(),
  [State.HURT]: new HurtState(),
  [State.DEATH]: new DeathState(),
};
let currentStateObj = STATES[State.PATROL];

function hit() {
  if (currentState === State.DEATH) return;
  hp--;
  log(`Enemigo golpeado (HP ${hp})`);
  currentStateObj.onHit();
}

// Render
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#556'; ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 2); ctx.lineTo(canvas.width, GROUND_Y + 2); ctx.stroke();

  // rangos
  ctx.setLineDash([4, 4]);
  const ranges = [[SIGHT_RANGE, '#4a4'], [ATTACK_RANGE, '#d44']];
  for (const [r, c] of ranges) {
    ctx.strokeStyle = c; ctx.strokeRect(enemy.x - r, GROUND_Y - 120, r * 2, 120);
  }
  ctx.setLineDash([]);

  const a = ANIMS[currentState];
  let f = Math.floor(animTime * a.fps);
  f = a.loop ? f % a.frames : Math.min(f, a.frames - 1);
  const w = FW * SCALE, h = FH * SCALE;
  ctx.save();
  ctx.translate(enemy.x, GROUND_Y + 30);
  ctx.scale(facing, 1);
  ctx.drawImage(a.img, f * FW, 0, FW, FH, -w / 2, -h, w, h);
  ctx.restore();

  // jugador
  ctx.fillStyle = '#4af';
  ctx.beginPath(); ctx.arc(player.x, GROUND_Y - 15, 15, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
  ctx.fillText(`Estado: ${StateName[currentState]}   HP: ${hp}`, 10, 20);
}

// Diagrama de estados (SVG)
const NODES = {
  [State.PATROL]: [70, 90], [State.CHASE]: [290, 90], [State.ATTACK]: [290, 250],
  [State.HURT]: [70, 250], [State.DEATH]: [180, 342],
};
const EDGES = [
  [State.PATROL, State.CHASE, 've jugador'],
  [State.CHASE, State.PATROL, 'pierde de vista'],
  [State.CHASE, State.ATTACK, 'en rango'],
  [State.ATTACK, State.CHASE, 'fuera de rango'],
  [State.HURT, State.CHASE, 'fin anim.'],
  [State.PATROL, State.HURT, 'golpe'],
  [State.CHASE, State.HURT, 'golpe'],
  [State.ATTACK, State.HURT, 'golpe'],
  [State.PATROL, State.DEATH, 'HP = 0'],
  [State.ATTACK, State.DEATH, 'HP = 0'],
  [State.HURT, State.DEATH, 'HP = 0'],
];
const NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('diagram');
const nodeEls = {};
function el(name, attrs, parent = svg) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent.appendChild(e); return e;
}
function buildDiagram() {
  const defs = el('defs', {});
  const m = el('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, defs);
  el('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#889' }, m);
  const R = 34;
  const offset = (from, to, o) => {
    const [x1, y1] = NODES[from], [x2, y2] = NODES[to];
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
    const nx = -dy / d * o, ny = dx / d * o;
    return [x1 + dx / d * R + nx, y1 + dy / d * R + ny, x2 - dx / d * R + nx, y2 - dy / d * R + ny];
  };
  const bidir = (a, b) => EDGES.some(e => e[0] === b && e[1] === a);
  for (const [a, b, label] of EDGES) {
    const o = bidir(a, b) ? 9 : 0;
    const [x1, y1, x2, y2] = offset(a, b, o);
    el('line', { class: 'edge', x1, y1, x2, y2 });
    const vertical = Math.abs(x1 - x2) < 1;
    const t = el('text', vertical
      ? { class: 'edge-label', x: (x1 + x2) / 2 + (a < b ? -34 : 34), y: (y1 + y2) / 2 }
      : { class: 'edge-label', x: (x1 + x2) / 2, y: (y1 + y2) / 2 + (a < b ? 14 : -6) });
    t.textContent = label;
  }
  for (const [s, [x, y]] of Object.entries(NODES)) {
    const n = el('g', { class: 'node' });
    el('circle', { cx: x, cy: y, r: 34 }, n);
    const t = el('text', { x, y: y + 4 }, n); t.textContent = StateName[s];
    nodeEls[s] = n;
  }
}

// Bucle
let last = performance.now(), prevShown = -1;
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  physicsProcess(dt);
  if (prevShown !== currentState) {
    for (const s in nodeEls) nodeEls[s].classList.toggle('active', +s === currentState);
    prevShown = currentState;
  }
  draw();
  requestAnimationFrame(loop);
}

canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  player.x = (e.clientX - r.left) * canvas.width / r.width;
});
canvas.addEventListener('click', e => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * canvas.width / r.width;
  if (Math.abs(x - enemy.x) < 50) hit();
});
addEventListener('keydown', e => { if (e.key.toLowerCase() === 'r') reset(); });

buildDiagram();
reset();
requestAnimationFrame(loop);
