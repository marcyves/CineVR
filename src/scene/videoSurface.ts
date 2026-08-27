import * as THREE from "three";
import { ViewMode } from "../types.ts";
import { TitleSlate } from "./slate.ts";

export class VideoSurface {
  readonly group = new THREE.Group();
  readonly cinemaScreen: THREE.Mesh;
  readonly sphere: THREE.Mesh;
  readonly hemi: THREE.Mesh;
  readonly slate: TitleSlate;
  readonly slateTexture: THREE.CanvasTexture;
  readonly videoTexture: THREE.VideoTexture;

  private videoMaterial: THREE.MeshBasicMaterial;
  private slateMaterial: THREE.MeshBasicMaterial;
  private mode: ViewMode = ViewMode.Cinema;
  private showingVideo = false;

  constructor(video: HTMLVideoElement) {
    this.slate = new TitleSlate();
    this.slateTexture = new THREE.CanvasTexture(this.slate.canvas);
    this.slateTexture.colorSpace = THREE.SRGBColorSpace;

    this.videoTexture = new THREE.VideoTexture(video);
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;
    this.videoTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.videoTexture.wrapT = THREE.ClampToEdgeWrapping;

    this.slateMaterial = new THREE.MeshBasicMaterial({ map: this.slateTexture });
    this.videoMaterial = new THREE.MeshBasicMaterial({ map: this.videoTexture });

    this.cinemaScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(9.6, 5.4),
      this.slateMaterial,
    );
    this.cinemaScreen.position.set(0, 2.75, -8.82);
    this.cinemaScreen.name = "screen";

    this.sphere = new THREE.Mesh(
      new THREE.SphereGeometry(18, 64, 40),
      this.slateMaterial,
    );
    this.sphere.scale.x = -1;
    this.sphere.visible = false;

    this.hemi = new THREE.Mesh(
      new THREE.SphereGeometry(18, 48, 32, Math.PI / 2, Math.PI),
      this.slateMaterial,
    );
    this.hemi.scale.x = -1;
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
    this.showingVideo = show;
    this.applyMaterial();
  }

  updateSlate(timeMs: number, title: string, subtitle: string, status: string): void {
    if (this.showingVideo) return;
    this.slate.draw(timeMs, title, subtitle, status);
    this.slateTexture.needsUpdate = true;
  }

  private applyMaterial(): void {
    const material = this.showingVideo ? this.videoMaterial : this.slateMaterial;
    this.cinemaScreen.material = material;
    this.sphere.material = material;
    this.hemi.material = material;

    if (this.showingVideo && this.mode === ViewMode.Sbs) {
      this.videoTexture.repeat.set(0.5, 1);
      this.videoTexture.offset.set(0, 0);
    } else {
      this.videoTexture.repeat.set(1, 1);
      this.videoTexture.offset.set(0, 0);
    }
  }
}
