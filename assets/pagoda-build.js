// 석탑 모식 모델 생성기: 층수·평면 같은 구조 정보만으로 단순화한 입체 모형을 만든다.
// 실제 조각, 세부 비례, 훼손 상태는 담지 않는다.
import * as THREE from 'three';

const STONE = {
  granite: { color: 0xb9b5ac, rough: 0.92 },
  marble:  { color: 0xe7e3da, rough: 0.6 },
};

export const DEFAULTS = {
  tiers: 3,            // 탑신(몸돌+지붕돌) 층수
  base_tiers: 2,       // 기단 단수
  base_plan: 'square', // 기단 평면: square | octagon | ya
  body_plan: 'square', // 탑신 평면: square | octagon | ya
  ya_body_tiers: 0,    // 아래에서부터 몇 층의 탑신이 亞자형인지 (나머지는 body_plan)
  finial: true,        // 상륜부 유무
  stone: 'granite',    // granite | marble
  height: 10,          // 모델 전체 높이(상대 단위)
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// 평면 모양에 맞는 돌덩이 하나. 바닥이 y=0에 닿는다.
function slab(plan, w, h, mat, edgeMat) {
  const g = new THREE.Group();
  const add = (geo) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = h / 2;
    g.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat);
    e.position.y = h / 2;
    g.add(e);
  };
  if (plan === 'octagon') {
    const r = w / 2 / Math.cos(Math.PI / 8);
    const geo = new THREE.CylinderGeometry(r, r, h, 8);
    geo.rotateY(Math.PI / 8);
    add(geo);
  } else if (plan === 'ya') {
    // 亞자형: 정사각형 위에 십자형 돌출부를 겹쳐 모서리가 층층이 꺾이게 한다.
    add(new THREE.BoxGeometry(w * 0.78, h, w * 0.78));
    add(new THREE.BoxGeometry(w, h, w * 0.5));
    add(new THREE.BoxGeometry(w * 0.5, h, w));
  } else {
    add(new THREE.BoxGeometry(w, h, w));
  }
  return g;
}

// 지붕돌 윗면: 사방(또는 팔방)으로 흘러내리는 경사면
function roofTop(plan, w, h, mat, edgeMat) {
  const sides = plan === 'octagon' ? 8 : 4;
  const r = w / 2 / Math.cos(Math.PI / sides);
  const geo = new THREE.ConeGeometry(r, h, sides);
  geo.rotateY(sides === 4 ? Math.PI / 4 : Math.PI / 8);
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  m.position.y = h / 2;
  g.add(m);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat);
  e.position.y = h / 2;
  g.add(e);
  return g;
}

export function buildPagoda(userSpec = {}) {
  const s = Object.assign({}, DEFAULTS, userSpec);
  s.tiers = clamp(Math.round(s.tiers), 1, 15);
  s.base_tiers = clamp(Math.round(s.base_tiers), 1, 4);
  s.ya_body_tiers = clamp(Math.round(s.ya_body_tiers), 0, s.tiers);
  const stone = STONE[s.stone] || STONE.granite;
  const mat = new THREE.MeshStandardMaterial({ color: stone.color, roughness: stone.rough, metalness: 0, flatShading: true });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x8a867c, transparent: true, opacity: 0.55 });

  const H = s.height;
  const n = s.tiers;
  const nb = s.base_tiers;

  // 비례(모식): 층수가 많을수록 폭이 좁고 높아진다.
  const W0 = H * clamp(0.62 - 0.035 * n, 0.34, 0.52); // 기단 맨 아래 폭
  const b0 = W0 * 0.46;   // 맨 아래 몸돌 폭
  const r0 = W0 * 0.86;   // 맨 아래 지붕돌 폭
  const groundH = H * 0.02;
  const capH = H * 0.012;
  const baseH = H * clamp(0.18 + 0.015 * nb, 0.18, 0.24);
  const finialH = s.finial ? H * 0.09 : 0;

  const group = new THREE.Group();
  let y = 0;
  const put = (obj, h) => { obj.position.y = y; group.add(obj); y += h; };

  // 지대석
  put(slab(s.base_plan, W0 * 1.12, groundH, mat, edgeMat), groundH);

  // 기단: 단마다 폭이 줄고, 맨 아래 단이 가장 높다.
  const bw = [1.35, 1, 1, 1].slice(0, nb);
  const bsum = bw.reduce((a, b) => a + b, 0);
  let topBaseW = W0;
  for (let j = 0; j < nb; j++) {
    const t = nb === 1 ? 0 : j / (nb - 1);
    topBaseW = lerp(W0, b0 * 1.5, t);
    const h = baseH * bw[j] / bsum;
    put(slab(s.base_plan, topBaseW, h, mat, edgeMat), h);
  }
  put(slab(s.base_plan, topBaseW * 1.08, capH, mat, edgeMat), capH); // 갑석

  // 탑신: 몸돌 + 지붕돌(받침 3단 + 윗면 경사). 위로 갈수록 폭과 높이가 줄어든다.
  const bodyTotal = H - finialH - y;
  const weights = [];
  for (let i = 0; i < n; i++) weights.push(n === 1 ? 1 : 1 - 0.3 * (i / (n - 1)));
  const wsum = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) {
    const sc = n === 1 ? 1 : lerp(1, 0.38, i / (n - 1));
    const unit = (bodyTotal * weights[i]) / wsum;
    const plan = i < s.ya_body_tiers ? 'ya' : s.body_plan;
    const roofPlan = plan === 'ya' ? 'square' : plan;
    const bodyW = b0 * sc;
    const roofW = r0 * sc;
    const bodyH = unit * 0.42;
    const stepsH = unit * 0.16;
    const topH = unit * 0.42;

    put(slab(plan, bodyW, bodyH, mat, edgeMat), bodyH);
    const steps = 3;
    for (let k = 0; k < steps; k++) {
      const w = lerp(bodyW * 1.15, roofW * 0.96, (k + 1) / steps);
      put(slab(roofPlan, w, stepsH / steps, mat, edgeMat), stepsH / steps);
    }
    put(roofTop(roofPlan, roofW, topH, mat, edgeMat), topH);
  }

  // 상륜부(노반, 복발, 보륜, 보주)를 단순화한 막대와 고리
  if (s.finial) {
    const tw = b0 * 0.38 * (n === 1 ? 1 : 0.38) * 2;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(tw * 0.06, tw * 0.08, finialH, 12), mat);
    rod.position.y = y + finialH / 2;
    group.add(rod);
    for (let k = 0; k < 3; k++) {
      const rr = tw * 0.25 * (1 - k * 0.22);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, finialH * 0.08, 16), mat);
      ring.position.y = y + finialH * (0.3 + 0.2 * k);
      group.add(ring);
    }
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(tw * 0.11, 14, 10), mat);
    jewel.position.y = y + finialH;
    group.add(jewel);
    y += finialH + tw * 0.11;
  }

  group.userData = { height: y, width: W0 * 1.12 };
  return group;
}
