import * as THREE from "three";
import { ViewMode } from "../types.ts";
import { TitleSlate } from "./slate.ts";

const PANO_RADIUS = 80;
/** Quest 2 GPU budget for the copied film frame. */
const MAX_BLIT_EDGE = 1280;

export class VideoSurface {
  readonly group = new THREE.Group();
  readonly cinemaScreen: THREE.Mesh;
  readonly sphere: THREE.Mesh;
  readonly hemi: THREE.Mesh;
  readonly slate: TitleSlate;
  readonly slateTexture: THREE.CanvasTexture;
  readonly filmTexture: THREE.CanvasTexture;

  private readonly video: HTMLVideoElement;
  private readonly blitCanvas: HTMLCanvasElement;
  private readonly blitCtx: CanvasRenderingContext2D;
  private readonly useVideoFrameCallback: boolean;

  private screenSlateMaterial: THREE.MeshBasicMaterial;
  private screenVideoMaterial: THREE.MeshBasicMaterial;
  private panoSlateMaterial: THREE.MeshBasicMaterial;
  private panoVideoMaterial: THREE.MeshBasicMaterial;
  private mode: ViewMode = ViewMode.Cinema;
  private showingVideo = false;
  private frameDirty = true;

  constructor(video: HTMLVideoElement) {
    this.video = video;
    this.slate = new TitleSlate();
    this.slateTexture = new THREE.CanvasTexture(this.slate.canvas);
    this.slateTexture.colorSpace = THREE.SRGBColorSpace;

    this.blitCanvas = document.createElement("canvas");
    this.blitCanvas.width = 16;
    this.blitCanvas.height = 16;
    const ctx = this.blitCanvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    if (!ctx) throw new Error("Canvas 2D indisponible pour la copie vidéo.");
    this.blitCtx = ctx;
    this.blitCtx.fillStyle = "#000";
    this.blitCtx.fillRect(0, 0, 16, 16);
    this.blitCtx.imageSmoothingEnabled = true;
    this.blitCtx.imageSmoothingQuality = "medium";

    this.filmTexture = new THREE.CanvasTexture(this.blitCanvas);
    this.filmTexture.colorSpace = THREE.SRGBColorSpace;
    this.filmTexture.minFilter = THREE.LinearFilter;
    this.filmTexture.magFilter = THREE.LinearFilter;
    this.filmTexture.generateMipmaps = false;
    this.filmTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.filmTexture.wrapT = THREE.ClampToEdgeWrapping;

    this.useVideoFrameCallback = "requestVideoFrameCallback" in video;
    const onVideoFrame = () => {
      this.frameDirty = true;
      if (this.useVideoFrameCallback) {
        video.requestVideoFrameCallback(onVideoFrame);
      }
    };
    if (this.useVideoFrameCallback) {
      video.requestVideoFrameCallback(onVideoFrame);
    }
    video.addEventListener("loadedmetadata", () => this.resizeBlitCanvas());

    this.screenSlateMaterial = new THREE.MeshBasicMaterial({
      map: this.slateTexture,
    });
    this.screenVideoMaterial = new THREE.MeshBasicMaterial({
      map: this.filmTexture,
    });
    this.panoSlateMaterial = new THREE.MeshBasicMaterial({
      map: this.slateTexture,
      toneMapped: false,
      depthWrite: false,
      depthTest: false,
    });
    this.panoVideoMaterial = new THREE.MeshBasicMaterial({
      map: this.filmTexture,
      toneMapped: false,
      depthWrite: false,
      depthTest: false,
    });

    this.cinemaScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(9.6, 5.4),
      this.screenSlateMaterial,
    );
    this.cinemaScreen.position.set(0, 2.75, -8.82);
    this.cinemaScreen.name = "screen";

    const sphereGeom = new THREE.SphereGeometry(PANO_RADIUS, 96, 64);
    sphereGeom.scale(-1, 1, 1);
    this.sphere = new THREE.Mesh(sphereGeom, this.panoSlateMaterial);
    this.sphere.frustumCulled = false;
    this.sphere.renderOrder = -1000;
    this.sphere.visible = false;

    const hemiGeom = new THREE.SphereGeometry(
      PANO_RADIUS,
      64,
      48,
      Math.PI / 2,
      Math.PI,
    );
    hemiGeom.scale(-1, 1, 1);
    this.hemi = new THREE.Mesh(hemiGeom, this.panoSlateMaterial);
    this.hemi.frustumCulled = false;
    this.hemi.renderOrder = -1000;
    this.hemi.visible = false;

    this.group.add(this.cinemaScreen, this.sphere, this.hemi);

    const bindEye = (mesh: THREE.Mesh) => {
      mesh.onBeforeRender = (
        r: THREE.WebGLRenderer,
        _scene: THREE.Scene,
        camera: THREE.Camera,
      ) => {
        if (!this.showingVideo || this.mode !== ViewMode.Sbs) return;
        const tex = this.filmTexture;
        tex.repeat.set(0.5, 1);
        if (!r.xr.isPresenting) {
          tex.offset.set(0, 0);
          return;
        }
        const cameras = r.xr.getCamera().cameras;
        const isLeft = cameras.length < 2 || camera === cameras[0];
        tex.offset.set(isLeft ? 0 : 0.5, 0);
      };
    };
    bindEye(this.cinemaScreen);
    bindEye(this.sphere);
    bindEye(this.hemi);
  }

  setMode(mode: ViewMode): void {
    this.mode = mode;
    const immersive = mode === ViewMode.Sphere || mode === ViewMode.Half;
    this.cinemaScreen.visible = !immersive;
    this.sphere.visible = mode === ViewMode.Sphere;
    this.hemi.visible = mode === ViewMode.Half;
    this.applyMaterial();
  }

  getMode(): ViewMode {
    return this.mode;
  }

  showVideo(show: boolean): void {
    if (this.showingVideo === show) return;
    this.showingVideo = show;
    this.applyMaterial();
  }

  /** Copy the decoder frame once per animation frame, before renderer.render. */
  commitFrame(): void {
    const video = this.video;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (this.useVideoFrameCallback && !this.frameDirty) return;
    this.resizeBlitCanvas();
    try {
      this.blitCtx.drawImage(
        video,
        0,
        0,
        this.blitCanvas.width,
        this.blitCanvas.height,
      );
    } catch {
      return;
    }
    this.filmTexture.needsUpdate = true;
    this.frameDirty = false;
  }

  updateSlate(timeMs: number, title: string, subtitle: string, status: string): void {
    if (this.showingVideo) return;
    this.slate.draw(timeMs, title, subtitle, status);
    this.slateTexture.needsUpdate = true;
  }

  private resizeBlitCanvas(): void {
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (!vw || !vh) return;
    const scale = Math.min(1, MAX_BLIT_EDGE / Math.max(vw, vh));
    const w = Math.max(2, Math.round(vw * scale));
    const h = Math.max(2, Math.round(vh * scale));
    if (this.blitCanvas.width === w && this.blitCanvas.height === h) return;
    this.blitCanvas.width = w;
    this.blitCanvas.height = h;
    this.blitCtx.imageSmoothingEnabled = true;
    this.blitCtx.imageSmoothingQuality = "medium";
    this.filmTexture.needsUpdate = true;
    this.frameDirty = true;
  }

  private applyMaterial(): void {
    const pano = this.mode === ViewMode.Sphere || this.mode === ViewMode.Half;
    if (pano) {
      const material = this.showingVideo
        ? this.panoVideoMaterial
        : this.panoSlateMaterial;
      this.sphere.material = material;
      this.hemi.material = material;
    } else {
      const material = this.showingVideo
        ? this.screenVideoMaterial
        : this.screenSlateMaterial;
      this.cinemaScreen.material = material;
    }

    if (this.showingVideo && this.mode === ViewMode.Sbs) {
      this.filmTexture.repeat.set(0.5, 1);
      this.filmTexture.offset.set(0, 0);
    } else {
      this.filmTexture.repeat.set(1, 1);
      this.filmTexture.offset.set(0, 0);
    }
  }
}
