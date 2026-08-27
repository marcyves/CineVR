import * as THREE from "three";

function mat(color: number, extras: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.86,
    metalness: 0.04,
    ...extras,
  });
}

function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function makeSeat(upholstery: THREE.Material, frame: THREE.Material): THREE.Group {
  const seat = new THREE.Group();
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.48), upholstery);
  cushion.position.set(0, 0.46, 0);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.08), upholstery);
  back.position.set(0, 0.72, 0.22);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.46), frame);
  base.position.set(0, 0.22, 0.02);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.46), frame);
  armL.position.set(-0.28, 0.56, 0);
  const armR = armL.clone();
  armR.position.x = 0.28;
  seat.add(cushion, back, base, armL, armR);
  return seat;
}

export function createCinema(): THREE.Group {
  const root = new THREE.Group();
  root.name = "cinema";

  const carpet = mat(0x2a1018);
  const wood = mat(0x1b120e, { roughness: 0.7 });
  const wall = mat(0x120e16);
  const gold = mat(0xb8893a, { metalness: 0.55, roughness: 0.35, emissive: 0x3a2408, emissiveIntensity: 0.25 });
  const velvet = mat(0x4a1020, { roughness: 0.95 });
  const frame = mat(0x161018);
  const upholstery = mat(0x5c1b28);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 18), carpet);
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);

  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 14), wood);
  aisle.rotation.x = -Math.PI / 2;
  aisle.position.y = 0.01;
  aisle.position.z = 1;
  root.add(aisle);

  root.add(box(16.2, 6.2, 0.3, wall, 0, 3.1, -9.4));
  root.add(box(0.3, 6.2, 18, wall, -8, 3.1, -0.5));
  root.add(box(0.3, 6.2, 18, wall, 8, 3.1, -0.5));
  root.add(box(16.2, 6.2, 0.3, wall, 0, 3.1, 8.4));

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(16, 18), mat(0x0c0a10));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 6.15;
  root.add(ceiling);

  const screenFrame = box(10.4, 6.1, 0.18, gold, 0, 2.85, -8.95);
  root.add(screenFrame);

  const curtainL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 6.2, 0.12), velvet);
  curtainL.position.set(-5.7, 3.1, -8.7);
  const curtainR = curtainL.clone();
  curtainR.position.x = 5.7;
  root.add(curtainL, curtainR);

  const valance = box(12.2, 0.45, 0.22, velvet, 0, 5.7, -8.72);
  root.add(valance);

  const seatTemplate = makeSeat(upholstery, frame);
  for (let row = 0; row < 5; row++) {
    const z = 1.4 + row * 1.15;
    const y = row * 0.12;
    for (const x of [-3.1, -2.4, -1.7, 1.7, 2.4, 3.1]) {
      const seat = seatTemplate.clone();
      seat.position.set(x, y, z);
      root.add(seat);
    }
  }

  const userRow = makeSeat(mat(0x7a2434), frame);
  userRow.position.set(-0.7, 0, 0.35);
  const userRowR = userRow.clone();
  userRowR.position.x = 0.7;
  root.add(userRow, userRowR);

  for (const x of [-7.4, 7.4]) {
    for (const z of [-6, -2, 2, 6]) {
      const sconce = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 10, 10),
        new THREE.MeshStandardMaterial({
          color: 0xffd9a0,
          emissive: 0xffb978,
          emissiveIntensity: 1.4,
          roughness: 0.3,
        }),
      );
      sconce.position.set(x, 2.4, z);
      root.add(sconce);

      const light = new THREE.PointLight(0xffc48a, 0.55, 7, 2);
      light.position.copy(sconce.position);
      root.add(light);
    }
  }

  const rail = box(10.6, 0.06, 0.06, gold, 0, 0.04, -7.6);
  root.add(rail);

  const exitGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.28),
    new THREE.MeshBasicMaterial({ color: 0x7dffb3 }),
  );
  exitGlow.position.set(-6.6, 1.6, 8.22);
  exitGlow.rotation.y = Math.PI;
  root.add(exitGlow);

  return root;
}

export function createLights(): THREE.Group {
  const lights = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0x6b5b8c, 0x1a0c10, 0.35);
  lights.add(hemi);

  const screenWash = new THREE.SpotLight(0xffe6c2, 4.2, 22, Math.PI / 5, 0.45, 1);
  screenWash.position.set(0, 5.4, 1.5);
  screenWash.target.position.set(0, 2.6, -8.8);
  lights.add(screenWash, screenWash.target);

  const fill = new THREE.DirectionalLight(0x8ea0ff, 0.18);
  fill.position.set(-4, 6, 6);
  lights.add(fill);

  return lights;
}
