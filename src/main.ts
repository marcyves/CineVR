import * as THREE from "three";
import { catalog } from "./catalog.ts";
import "./style.css";
import { MediaPlayer } from "./media.ts";
import { createCinema, createLights } from "./scene/cinema.ts";
import { VideoSurface } from "./scene/videoSurface.ts";
import { ViewMode, type VideoItem } from "./types.ts";
import { Overlay } from "./ui/overlay.ts";
import { SpatialPanel } from "./ui/spatialPanel.ts";
import { XrInput } from "./xr/input.ts";

const player = new MediaPlayer();
const canvas = document.querySelector<HTMLCanvasElement>("#view");
if (!canvas) throw new Error("Canvas #view introuvable");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local-floor");
renderer.xr.setFoveation(0.75);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07060c);
scene.fog = new THREE.Fog(0x07060c, 12, 24);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.05,
  80,
);
camera.position.set(0, 1.28, 0.2);

const cinema = createCinema();
const lights = createLights();
const surface = new VideoSurface(player.video);
const xrInput = new XrInput(renderer);
const panel = new SpatialPanel();
panel.setVisible(false);

scene.add(cinema, lights, surface.group, xrInput.group, panel.mesh);

let stage: "lobby" | "preview" | "xr" = "lobby";
let yaw = 0;
let pitch = 0.04;
let dragging = false;
let lastHover = "";
let stickCooldown = 0;

const overlay = new Overlay({
  onSelectVideo: (item) => void loadItem(item),
  onCustomUrl: (url) => {
    void player.loadUrl(url, url, true);
    overlay.notify("Chargement de votre flux…");
  },
  onCustomFile: (file) => {
    void player.loadFile(file);
    overlay.notify(`Fichier prêt : ${file.name}`);
  },
  onMode: setMode,
  onEnterVr: () => void enterVr(),
  onPreview: enterPreview,
  onLobby: enterLobby,
  onPlayToggle: () => player.togglePlay(),
  onSeek: (ratio) => player.seekRatio(ratio),
  onVolume: (ratio) => player.setVolume(ratio),
  onMute: () => player.toggleMute(),
});

player.onChange(() => {
  overlay.syncPlayer(player);
  surface.showVideo(player.status === "ready");
});

void loadItem(catalog[0]);
void detectHeadset();

function setMode(mode: ViewMode): void {
  overlay.setMode(mode);
  surface.setMode(mode);
  const hideRoom = mode === ViewMode.Sphere || mode === ViewMode.Half;
  cinema.visible = !hideRoom;
  lights.visible = !hideRoom;
  scene.fog = hideRoom ? null : new THREE.Fog(0x07060c, 12, 24);
  scene.background = new THREE.Color(hideRoom ? 0x000000 : 0x07060c);
}

async function loadItem(item: VideoItem): Promise<void> {
  overlay.setSelected(item.id);
  if (item.kind === "360") setMode(ViewMode.Sphere);
  await player.loadUrl(item.src, item.title, true);
}

async function detectHeadset(): Promise<void> {
  const quest = /OculusBrowser|Quest/i.test(navigator.userAgent);
  let supported = false;
  try {
    supported = (await navigator.xr?.isSessionSupported("immersive-vr")) ?? false;
  } catch {
    supported = false;
  }
  overlay.setVrAvailability(supported, quest);
  if (quest && supported) {
    overlay.notify("Quest prêt. Choisissez un film, puis Entrer en VR.");
  }
}

async function enterVr(): Promise<void> {
  if (!navigator.xr) {
    overlay.notify("WebXR n’est pas disponible dans ce navigateur.");
    return;
  }
  try {
    const session = await navigator.xr.requestSession("immersive-vr", {
      optionalFeatures: ["local-floor", "bounded-floor"],
    });
    await renderer.xr.setSession(session);
    stage = "xr";
    panel.setVisible(true);
    overlay.hideChrome();
    await player.play();
    overlay.notify("Visez le panneau avec la gâchette.");
    session.addEventListener("end", () => {
      stage = "preview";
      panel.setVisible(false);
      overlay.showHud();
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Session VR refusée.";
    overlay.notify(message);
  }
}

function enterPreview(): void {
  stage = "preview";
  overlay.showHud();
  void player.play();
}

function enterLobby(): void {
  const session = renderer.xr.getSession();
  if (session) void session.end();
  stage = "lobby";
  panel.setVisible(false);
  overlay.showLobby();
  player.pause();
}

function applySpatialAction(hit: ReturnType<SpatialPanel["hit"]>): void {
  if (!hit) return;
  pulse();
  if (hit.kind === "play") player.togglePlay();
  if (hit.kind === "mute") player.toggleMute();
  if (hit.kind === "seek") player.seekRatio(hit.ratio);
  if (hit.kind === "volume") player.setVolume(hit.ratio);
  if (hit.kind === "mode") setMode(hit.mode);
  if (hit.kind === "lobby") enterLobby();
}

function pulse(): void {
  const session = renderer.xr.getSession();
  if (!session) return;
  for (const source of session.inputSources) {
    const actuator = source.gamepad?.hapticActuators?.[0];
    void actuator?.pulse(0.4, 28);
  }
}

canvas.addEventListener("pointerdown", (event) => {
  if (stage === "lobby") return;
  dragging = true;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointerup", () => {
  dragging = false;
});
canvas.addEventListener("pointermove", (event) => {
  if (!dragging || renderer.xr.isPresenting) return;
  yaw -= event.movementX * 0.0035;
  pitch -= event.movementY * 0.0035;
  pitch = Math.min(0.7, Math.max(-0.45, pitch));
});

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.code === "Space") {
    event.preventDefault();
    player.togglePlay();
  } else if (event.code === "ArrowRight") player.seekBy(8);
  else if (event.code === "ArrowLeft") player.seekBy(-8);
  else if (event.code === "ArrowUp") player.nudgeVolume(0.08);
  else if (event.code === "ArrowDown") player.nudgeVolume(-0.08);
  else if (event.code === "KeyM") player.toggleMute();
  else if (event.code === "Escape") enterLobby();
  else if (event.code === "Digit1") setMode(ViewMode.Cinema);
  else if (event.code === "Digit2") setMode(ViewMode.Sbs);
  else if (event.code === "Digit3") setMode(ViewMode.Half);
  else if (event.code === "Digit4") setMode(ViewMode.Sphere);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let hudAge = 0;

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  const t = performance.now();

  const slateStatus =
    player.status === "loading"
      ? "Chargement de la copie…"
      : player.status === "error"
        ? player.errorMessage
        : "Choisissez un film, puis lancez la projection";
  surface.updateSlate(t, "Ciné VR", player.sourceLabel, slateStatus);

  if (stage === "lobby" && !renderer.xr.isPresenting) {
    const idle = Math.sin(t * 0.00025) * 0.18;
    camera.position.set(Math.sin(idle) * 0.35, 1.32, 0.55);
    camera.lookAt(0, 2.4, -8.8);
  } else if (!renderer.xr.isPresenting) {
    camera.position.set(0, 1.28, 0.2);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
  }

  if (renderer.xr.isPresenting) {
    const buttons = xrInput.readSession(renderer);
    if (buttons.play) player.togglePlay();
    if (buttons.menu) panel.toggle();
    stickCooldown -= dt;
    if (stickCooldown <= 0 && buttons.seek) {
      player.seekBy(buttons.seek * 10);
      stickCooldown = 0.18;
    }
    if (buttons.volume) player.nudgeVolume(buttons.volume * 0.04);

    const hit = panel.visible ? xrInput.intersect([panel.mesh]) : xrInput.intersect([]);
    const hover = hit?.uv ? panel.hoverAt(hit.uv) : null;
    if (hover && hover !== lastHover) pulse();
    lastHover = hover ?? "";
    if (buttons.select && hit?.uv) applySpatialAction(panel.hit(hit.uv));
    panel.draw(player, surface.getMode(), hover);
  }

  hudAge += dt;
  if (hudAge > 0.2) {
    overlay.syncPlayer(player);
    hudAge = 0;
  }
  renderer.render(scene, camera);
});
