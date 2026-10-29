import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

import { canOccupy } from "./navigation.js";
import "./style.css";


const MODEL_URL = `${import.meta.env.BASE_URL}models/dazhou_store_base_V4.glb`;
const canvas = document.querySelector("#scene");
const status = document.querySelector("#status");
const enterButton = document.querySelector("#enter-store");
const exitButton = document.querySelector("#exit-walk");
const walkHelp = document.querySelector("#walk-help");
const touchControls = document.querySelector("#touch-controls");
const errorPanel = document.querySelector("#error-panel");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071f22);


const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.05, 120);
camera.position.set(19, 15, 22);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight(0xd9ffff, 0x163437, 2.4));
const sun = new THREE.DirectionalLight(0xffffff, 3.6);
sun.position.set(9, 18, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:0.5,far:70});
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.025;
scene.add(sun);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.07;
orbit.minDistance = 5;
orbit.maxDistance = 85;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.target.set(-0.7, 0.7, 0.2);

const pointer = new PointerLockControls(camera, renderer.domElement);
const clock = new THREE.Clock();
const pressed = new Set();
let colliders = [];
let footprint = [];
let eyeY = 1.77;
const entrySpawn = new THREE.Vector3(0, 1.65, 7.6);
const lookEuler = new THREE.Euler(0, 0, 0, "YXZ");
let walking = false;
let touchLook;

const views = {
  overview: {position:[18,19,23],target:[-2,0.4,1.5]},
  facade: {position:[0,5,26],target:[0,1.5,8.3]},
  top: {position:[0,36,0.001],target:[0,0,0]},
  side: {position:[25,6,7],target:[8.8,1.5,5.3]},
  interior: {position:[-4,1.77,7.7],target:[-4,1.77,-4]},
};


function setStatus(message) {
  status.textContent = message;
}


function setView(name) {
  if (pointer.isLocked) pointer.unlock();
  if (walking) stopWalking();
  else document.body.classList.remove("walking");
  orbit.enabled = true;
  orbit.enableDamping = false;
  orbit.update();
  const view = views[name];
  camera.position.fromArray(view.position);
  orbit.target.fromArray(view.target);
  if(innerWidth < 700 && name !== "interior") camera.position.sub(orbit.target).multiplyScalar(1.65).add(orbit.target);
  orbit.update();
  orbit.enableDamping = true;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
  });
}


function enterStore() {
  camera.position.copy(entrySpawn);
  camera.position.y = eyeY;
  camera.lookAt(new THREE.Vector3(-4, eyeY, -4));
  if (matchMedia("(pointer: coarse)").matches) startWalking();
  else pointer.lock();
}


function startWalking() {
  walking = true;
  document.body.classList.add("walking");
  orbit.enabled = false;
  walkHelp.hidden = false;
  touchControls.hidden = !matchMedia("(pointer: coarse)").matches;
  setStatus("店内漫游中");
}


function stopWalking() {
  walking = false;
  document.body.classList.remove("walking");
  orbit.enabled = true;
  walkHelp.hidden = true;
  touchControls.hidden = true;
  touchLook = undefined;
  pressed.clear();
  setStatus("门店模型已就绪");
}


function updateWalking(delta) {
  if (!walking) return;
  const forwardAmount = Number(pressed.has("KeyW") || pressed.has("ArrowUp")) - Number(pressed.has("KeyS") || pressed.has("ArrowDown"));
  const rightAmount = Number(pressed.has("KeyD") || pressed.has("ArrowRight")) - Number(pressed.has("KeyA") || pressed.has("ArrowLeft"));
  if (!forwardAmount && !rightAmount) return;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
  const direction = forward.multiplyScalar(forwardAmount).add(right.multiplyScalar(rightAmount)).normalize();
  const candidate = camera.position.clone().addScaledVector(direction, 3.2 * delta);
  candidate.y = eyeY;
  if (canOccupy(candidate.x, candidate.z, colliders, footprint)) camera.position.copy(candidate);
}


pointer.addEventListener("lock", () => {
  startWalking();
});

pointer.addEventListener("unlock", () => {
  stopWalking();
});

document.addEventListener("pointerlockerror", () => {
  setStatus("当前浏览器未允许鼠标锁定，请使用独立浏览器打开漫游");
});
enterButton.addEventListener("click", enterStore);
exitButton.addEventListener("click", () => {
  if (pointer.isLocked) pointer.unlock();
  else stopWalking();
});
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));

addEventListener("keydown", (event) => pressed.add(event.code));
addEventListener("keyup", (event) => pressed.delete(event.code));
addEventListener("blur", () => pressed.clear());
document.querySelectorAll("[data-key]").forEach((button) => {
  const start = (event) => {
    event.preventDefault();
    pressed.add(button.dataset.key);
    button.setPointerCapture(event.pointerId);
  };
  const stop = (event) => {
    event.preventDefault();
    pressed.delete(button.dataset.key);
  };
  button.addEventListener("pointerdown", start);
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointercancel", stop);
});

canvas.addEventListener("pointerdown", (event) => {
  if (!walking || event.pointerType !== "touch") return;
  touchLook = { id: event.pointerId, x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!touchLook || event.pointerId !== touchLook.id) return;
  lookEuler.setFromQuaternion(camera.quaternion);
  lookEuler.y -= (event.clientX - touchLook.x) * 0.004;
  lookEuler.x -= (event.clientY - touchLook.y) * 0.004;
  lookEuler.x = THREE.MathUtils.clamp(lookEuler.x, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
  camera.quaternion.setFromEuler(lookEuler);
  touchLook.x = event.clientX;
  touchLook.y = event.clientY;
});
canvas.addEventListener("pointerup", () => {
  touchLook = undefined;
});
canvas.addEventListener("pointercancel", () => {
  touchLook = undefined;
});

Promise.all([
  new GLTFLoader().loadAsync(MODEL_URL),
  fetch(`${import.meta.env.BASE_URL}navigation-v4.json`).then(r => { if(!r.ok) throw new Error("Navigation unavailable"); return r.json(); }),
]).then(([gltf, nav]) => {
  if (!Array.isArray(nav.footprint) || nav.footprint.length < 3 || !Array.isArray(nav.colliders)) throw new Error("Invalid navigation data");
  colliders = nav.colliders;
  footprint = nav.footprint;
  eyeY = nav.eyeY;
  entrySpawn.fromArray(nav.entry);
  scene.add(gltf.scene);
  gltf.scene.traverse(node => {
    if(node.isMesh){ node.castShadow=true; node.receiveShadow=true; }
  });
  enterButton.disabled = false;
  setStatus("门店模型已就绪 · V4 结构白模");
  setView("overview");
  // 仅开发环境的本地自检读取相机状态，不改变模型。
  if (import.meta.env.DEV) window.__storeQA = {camera, scene, colliders, footprint, entrySpawn, get walking(){return walking;}};
}).catch(error => {
  console.error(error);
  errorPanel.hidden = false;
  setStatus("模型加载失败");
});

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener("resize", resize);

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  updateWalking(delta);
  if (!walking) orbit.update();
  renderer.render(scene, camera);
}
animate();
