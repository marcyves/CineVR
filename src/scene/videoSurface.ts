import * as THREE from "three";
import { ViewMode } from "../types.ts";
import { TitleSlate } from "./slate.ts";

const PANO_RADIUS = 80;

export class VideoSurface {
  readonly group = new THREE.Group();
  readonly cinemaScreen: THREE.Mesh;
  readonly sphere: THREE.Mesh;
  readonly hemi: THREE.Mesh;
  readonly slate: TitleSlate;
  readonly slateTexture: THREE.CanvasTexture;
  readonly videoTexture: THREE.VideoTexture;

  private screenSlateMaterial: THREE.MeshBasicMaterial;
  private screenVideoMaterial: THREE.MeshBasicMaterial;
  private panoSlateMaterial: THREE.MeshBasicMaterial;
  private panoVideoMaterial: THREE.MeshBasicMaterial;
  private mode: ViewMode = ViewMode.Cinema;
  private showingVideo = false;
  private frameDirty = true;

  constructor(video: HTMLVideoElement) {
    this.slate = new TitleSlate();
    this.slateTexture = new THREE.CanvasTexture(this.slate.canvas);
    this.slateTexture.colorSpace = THREE.SRGBColorSpace;

    this.videoTexture = new THREE.VideoTexture(video);
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;
    this.videoTexture.generateMipmaps = false;
    this.videoTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.videoTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.videoTexture.update = () => {
      /* Uploaded once per animation frame in commitFrame() so both XR eyes share the same picture. */
    };

    const onVideoFrame = () => {
      this.frameDirty = true;
      if ("requestVideoFrameCallback" in video) {
        video.requestVideoFrameCallback(onVideoFrame);
      }
    };
    if ("requestVideoFrameCallback" in video) {
      video.requestVideoFrameCallback(onVideoFrame);
    }

    this.screenSlateMaterial = new THREE.MeshBasicMaterial({
      map: this.slateTexture,
    });
    this.screenVideoMaterial = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
    });
    this.panoSlateMaterial = new THREE.MeshBasicMaterial({
      map: this.slateTexture,
      toneMapped: false,
      depthWrite: false,
      depthTest: false,
    });
    this.panoVideoMaterial = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
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
        const tex = this.videoTexture;
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

  /** Call once per animation frame, before renderer.render. */
  commitFrame(): void {
    const video = this.videoTexture.source.data as HTMLVideoElement;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if ("requestVideoFrameCallback" in video && !this.frameDirty) return;
    this.videoTexture.needsUpdate = true;
    this.frameDirty = false;
  }

  updateSlate(timeMs: number, title: string, subtitle: string, status: string): void {
    if (this.showingVideo) return;
    this.slate.draw(timeMs, title, subtitle, status);
    this.slateTexture.needsUpdate = true;
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
      this.videoTexture.repeat.set(0.5, 1);
      this.videoTexture.offset.set(0, 0);
    } else {
      this.videoTexture.repeat.set(1, 1);
      this.videoTexture.offset.set(0, 0);
    }
  }
}
