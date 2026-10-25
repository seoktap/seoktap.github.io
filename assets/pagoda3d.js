// 글 머리의 3D 뷰어: front matter의 model 값을 읽어 석탑 모식 모델을 돌려 볼 수 있게 한다.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildPagoda } from './pagoda-build.js';

const root = document.getElementById('pagoda-viewer');
const dataEl = document.getElementById('pagoda-model');
if (root && dataEl) init();

function fail(msg) {
  const note = root.querySelector('.viewer-note');
  root.classList.add('is-failed');
  if (note) note.textContent = msg || '이 브라우저에서는 3D 보기를 쓸 수 없습니다.';
}

function init() {
  let spec = {};
  try { spec = JSON.parse(dataEl.textContent) || {}; } catch (e) { return fail(); }

  const view = root.querySelector('.view');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    return fail();
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  view.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pagoda = buildPagoda(spec);
  scene.add(pagoda);
  const H = pagoda.userData.height;
  const W = pagoda.userData.width;

  // 바닥
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(W * 1.9, H * 0.5), 48),
    new THREE.MeshStandardMaterial({ color: 0xe6dfcf, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  scene.add(ground);

  // 조명
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d0bd, 1.05));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
  sun.position.set(H * 0.6, H * 1.2, H * 0.8);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdfe9ff, 0.5);
  fill.position.set(-H, H * 0.4, -H * 0.6);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, H * 20);
  const home = new THREE.Vector3(H * 1.3, H * 0.72, H * 1.85);
  const target = new THREE.Vector3(0, H * 0.48, 0);
  camera.position.copy(home);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = H * 0.7;
  controls.maxDistance = H * 4;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.autoRotateSpeed = 1.2;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotate = !reduce;

  // 터치 화면에서는 세로 밀기를 페이지 스크롤에 양보한다.
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  renderer.domElement.style.touchAction = coarse ? 'pan-y' : 'none';

  // 버튼
  const rotateBtn = root.querySelector('[data-act="rotate"]');
  const syncRotate = () => {
    if (!rotateBtn) return;
    rotateBtn.textContent = controls.autoRotate ? '회전 멈춤' : '회전 시작';
    rotateBtn.setAttribute('aria-pressed', controls.autoRotate ? 'true' : 'false');
  };
  syncRotate();
  controls.addEventListener('start', () => { controls.autoRotate = false; syncRotate(); });

  const flyTo = (pos) => {
    controls.autoRotate = false;
    syncRotate();
    camera.position.copy(pos);
    controls.target.copy(target);
    controls.update();
  };
  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-act]');
    if (!b) return;
    const act = b.getAttribute('data-act');
    if (act === 'rotate') { controls.autoRotate = !controls.autoRotate; syncRotate(); }
    if (act === 'home') flyTo(home);
    if (act === 'front') flyTo(new THREE.Vector3(0, H * 0.5, H * 2.35));
    if (act === 'top') flyTo(new THREE.Vector3(0.001, H * 2.1, H * 0.35));
  });

  // 크기 맞추기
  const resize = () => {
    const w = view.clientWidth;
    const h = view.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(view);
  resize();

  // 화면에 보일 때만 그린다.
  let visible = true;
  let raf = 0;
  const loop = () => {
    raf = 0;
    if (!visible) return;
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(loop);
  }).observe(root);
  raf = requestAnimationFrame(loop);
  root.classList.add('is-ready');
}
