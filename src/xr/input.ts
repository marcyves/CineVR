import * as THREE from "three";

export type XrButtonState = {
  play: boolean;
  menu: boolean;
  seek: number;
  volume: number;
  select: boolean;
};

export class XrInput {
  readonly group = new THREE.Group();
  readonly controllers: THREE.XRTargetRaySpace[] = [];
  readonly rays: THREE.Line[] = [];
  readonly dots: THREE.Mesh[] = [];

  private prevPlay = [false, false];
  private prevMenu = [false, false];
  private prevSelect = [false, false];
  private raycaster = new THREE.Raycaster();
  private origin = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private world = new THREE.Matrix4();

  constructor(renderer: THREE.WebGLRenderer) {
    const rayMat = new THREE.LineBasicMaterial({
      color: 0xe8c07a,
      transparent: true,
      opacity: 0.85,
    });
    const rayGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);

    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      const ray = new THREE.Line(rayGeom, rayMat);
      ray.scale.z = 4;
      controller.add(ray, makeControllerMesh());
      this.group.add(controller);
      this.controllers.push(controller);
      this.rays.push(ray);

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xffe3a8 }),
      );
      dot.visible = false;
      this.group.add(dot);
      this.dots.push(dot);
    }
  }

  readSession(renderer: THREE.WebGLRenderer): XrButtonState {
    const state: XrButtonState = {
      play: false,
      menu: false,
      seek: 0,
      volume: 0,
      select: false,
    };
    const session = renderer.xr.getSession();
    if (!session) return state;

    let index = 0;
    for (const source of session.inputSources) {
      const gp = source.gamepad;
      if (!gp || index > 1) continue;
      const playDown = gp.buttons[4]?.pressed ?? false;
      const menuDown = gp.buttons[5]?.pressed ?? false;
      const selectDown = gp.buttons[0]?.pressed ?? false;
      if (playDown && !this.prevPlay[index]) state.play = true;
      if (menuDown && !this.prevMenu[index]) state.menu = true;
      if (selectDown && !this.prevSelect[index]) state.select = true;
      this.prevPlay[index] = playDown;
      this.prevMenu[index] = menuDown;
      this.prevSelect[index] = selectDown;
      const ax = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0];
      const ay = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1];
      if (ax !== undefined && Math.abs(ax) > 0.35) state.seek = ax;
      if (ay !== undefined && Math.abs(ay) > 0.35) state.volume = -ay;
      index += 1;
    }
    return state;
  }

  intersect(targets: THREE.Object3D[]): THREE.Intersection | null {
    let closest: THREE.Intersection | null = null;
    let closestIndex = 0;

    for (let i = 0; i < this.controllers.length; i++) {
      const controller = this.controllers[i];
      this.world.copy(controller.matrixWorld);
      this.origin.setFromMatrixPosition(this.world);
      this.direction.set(0, 0, -1).transformDirection(this.world);
      this.raycaster.set(this.origin, this.direction);
      const hit = this.raycaster.intersectObjects(targets, true)[0];
      if (hit && (!closest || hit.distance < closest.distance)) {
        closest = hit;
        closestIndex = i;
      }
    }

    for (let i = 0; i < this.dots.length; i++) {
      const isHit = closest !== null && i === closestIndex;
      this.dots[i].visible = isHit;
      this.rays[i].scale.z = isHit && closest ? closest.distance : 4;
      if (isHit && closest) this.dots[i].position.copy(closest.point);
    }

    return closest;
  }
}

function makeControllerMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, 0.11, 14),
    new THREE.MeshStandardMaterial({
      color: 0x1a1520,
      roughness: 0.45,
      metalness: 0.2,
    }),
  );
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.04;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.035, 0.006, 8, 18),
    new THREE.MeshStandardMaterial({
      color: 0xe8c07a,
      emissive: 0x5a3a10,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    }),
  );
  ring.position.z = -0.02;
  g.add(body, ring);
  return g;
}
