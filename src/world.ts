import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { LOT_DEPTH, LOT_WIDTH } from "./levels";
import type { CarState, Level, Obstacle } from "./types";

const paintMaterial = new THREE.MeshStandardMaterial({ color: 0xdde6df, roughness: 0.86 });
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x18221f, roughness: 0.48, metalness: 0.65 });

function box(width: number, height: number, depth: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function roundedBox(width: number, height: number, depth: number, radius: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 5, radius), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is required for the asphalt texture.");
  context.fillStyle = "#2c3332";
  context.fillRect(0, 0, 512, 512);
  let seed = 43019;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let index = 0; index < 6200; index += 1) {
    const shade = 45 + Math.floor(random() * 34);
    context.fillStyle = `rgba(${shade},${shade + 5},${shade + 3},${0.12 + random() * 0.2})`;
    const size = random() * 1.7 + 0.25;
    context.fillRect(random() * 512, random() * 512, size, size);
  }
  for (let index = 0; index < 14; index += 1) {
    context.strokeStyle = `rgba(10,15,13,${0.08 + random() * 0.09})`;
    context.lineWidth = random() * 2 + 0.4;
    context.beginPath();
    context.moveTo(random() * 512, random() * 512);
    context.bezierCurveTo(random() * 512, random() * 512, random() * 512, random() * 512, random() * 512, random() * 512);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function addParkingBay(group: THREE.Group, x: number, z: number, north: boolean): void {
  const lineWidth = 0.12;
  const bayWidth = 6.2;
  const bayDepth = 9.2;
  const left = box(lineWidth, 0.025, bayDepth, paintMaterial);
  const right = left.clone();
  const back = box(bayWidth, 0.025, lineWidth, paintMaterial);
  left.position.set(x - bayWidth / 2, 0.045, z);
  right.position.set(x + bayWidth / 2, 0.045, z);
  back.position.set(x, 0.045, z + (north ? -bayDepth / 2 : bayDepth / 2));
  group.add(left, right, back);
}

function createTree(x: number, z: number, scale: number): THREE.Group {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.25 * scale, 2.1 * scale, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a3528, roughness: 1 })
  );
  trunk.position.y = 1.05 * scale;
  trunk.castShadow = true;
  const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x315b43, roughness: 0.93 });
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35 * scale, 1), leavesMaterial);
  crown.position.y = 2.75 * scale;
  crown.scale.set(1, 1.15, 1);
  crown.castShadow = true;
  tree.add(trunk, crown);
  for (let i = 0; i < 5; i += 1) {
    const cluster = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 * scale, 2), leavesMaterial);
    cluster.position.set(Math.cos(i * 2.4) * scale, (2.5 + (i % 2) * 0.65) * scale, Math.sin(i * 2.4) * scale);
    cluster.castShadow = true;
    tree.add(cluster);
  }
  tree.position.set(x, 0, z);
  return tree;
}

function createCar(color: number, headlights: boolean): THREE.Group {
  const car = new THREE.Group();
  const bodyMaterial = new THREE.MeshPhysicalMaterial({ color, roughness: 0.26, metalness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.16 });
  const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0x173b43, roughness: 0.08, metalness: 0.15, transmission: 0.2, transparent: true, opacity: 0.92 });
  const body = roundedBox(2.2, 0.72, 4.45, 0.18, bodyMaterial);
  body.position.y = 0.8;
  body.geometry.translate(0, 0, 0.08);
  const hood = roundedBox(1.95, 0.22, 1.2, 0.1, bodyMaterial);
  hood.position.set(0, 1.16, -1.48);
  const cabinGeometry = new THREE.BoxGeometry(1.72, 0.72, 2.35);
  const vertices = cabinGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i += 1) {
    if (vertices.getY(i) > 0) {
      vertices.setX(i, vertices.getX(i) * 0.83);
      vertices.setZ(i, vertices.getZ(i) * 0.62);
    }
  }
  cabinGeometry.computeVertexNormals();
  const cabin = new THREE.Mesh(cabinGeometry, glassMaterial);
  cabin.position.set(0, 1.48, 0.15);
  cabin.geometry.translate(0, 0, 0.08);
  const roof = roundedBox(1.46, 0.09, 1.5, 0.04, bodyMaterial);
  roof.position.set(0, 1.88, 0.23);
  const bumperFront = box(2.05, 0.18, 0.18, darkMetal);
  bumperFront.position.set(0, 0.67, -2.23);
  const bumperRear = bumperFront.clone();
  bumperRear.position.z = 2.23;
  car.add(body, hood, cabin, roof, bumperFront, bumperRear);
  for (const side of [-1, 1]) {
    const pillar = box(0.045, 0.63, 0.1, darkMetal);
    pillar.position.set(side * 0.79, 1.48, 0.23);
    car.add(pillar);
    const handle = roundedBox(0.045, 0.055, 0.23, 0.02, darkMetal);
    handle.position.set(side * 1.105, 1.02, 0.35);
    car.add(handle);
  }
  const grille = box(1.3, 0.22, 0.03, darkMetal);
  grille.position.set(0, 0.85, -2.24);
  car.add(grille);
  for (let i = 0; i < 6; i += 1) {
    const slat = box(0.025, 0.18, 0.04, paintMaterial);
    slat.position.set(-0.5 + i * 0.2, 0.85, -2.26);
    car.add(slat);
  }
  for (const end of [-1, 1]) {
    const plate = box(0.48, 0.13, 0.025, paintMaterial);
    plate.position.set(0, 0.61, end * 2.33);
    car.add(plate);
  }

  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x090b0a, roughness: 0.8 });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x9da7a1, roughness: 0.3, metalness: 0.8 });
  const wheelPositions: Array<[number, number]> = [[-1.08, -1.35], [1.08, -1.35], [-1.08, 1.35], [1.08, 1.35]];
  for (const [wheelX, wheelZ] of wheelPositions) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.26, 20), wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0, 0, 0);
    wheel.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.275, 16), rimMaterial);
    rim.rotation.z = Math.PI / 2;
    rim.position.copy(wheel.position);
    const axle = new THREE.Group();
    axle.name = wheelZ < 0 ? "front-wheel" : "rear-wheel";
    axle.position.set(wheelX, 0.39, wheelZ);
    const rolling = new THREE.Group();
    rolling.add(wheel, rim);
    for (let i = 0; i < 5; i += 1) {
      const spoke = box(0.29, 0.035, 0.34, rimMaterial);
      spoke.rotation.x = i * Math.PI / 5;
      rolling.add(spoke);
    }
    axle.add(rolling);
    car.add(axle);
  }

  const headlightMaterial = new THREE.MeshStandardMaterial({ color: 0xfffbd2, emissive: 0xffef9d, emissiveIntensity: 3 });
  const tailMaterial = new THREE.MeshStandardMaterial({ color: 0xff4f3f, emissive: 0xff2014, emissiveIntensity: 2 });
  for (const side of [-0.7, 0.7]) {
    const lamp = box(0.42, 0.18, 0.08, headlightMaterial);
    lamp.position.set(side, 0.87, -2.25);
    const tail = box(0.4, 0.16, 0.08, tailMaterial);
    tail.position.set(side, 0.84, 2.25);
    car.add(lamp, tail);
  }

  if (headlights) {
    for (const side of [-0.62, 0.62]) {
      const light = new THREE.SpotLight(0xfff5cc, 22, 24, Math.PI / 8, 0.55, 1.3);
      light.position.set(side, 0.92, -2.2);
      light.target.position.set(side * 0.45, 0, -15);
      light.castShadow = false;
      car.add(light, light.target);
    }
  }
  car.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return car;
}

function createBarrier(obstacle: Obstacle): THREE.Group {
  const group = new THREE.Group();
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x323b38, roughness: 0.72 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xe6b756, roughness: 0.6 });
  const base = box(obstacle.width, 0.65, obstacle.depth, baseMaterial);
  base.position.y = 0.34;
  group.add(base);
  const count = Math.max(2, Math.floor(obstacle.width / 1.5));
  for (let index = 0; index < count; index += 1) {
    const stripe = box(obstacle.width / count * 0.48, 0.045, obstacle.depth + 0.04, amber);
    stripe.position.set(-obstacle.width / 2 + (index + 0.5) * obstacle.width / count, 0.69, 0);
    group.add(stripe);
  }
  return group;
}

function createPlanter(obstacle: Obstacle): THREE.Group {
  const group = new THREE.Group();
  const base = box(obstacle.width, 0.65, obstacle.depth, new THREE.MeshStandardMaterial({ color: 0x717b70, roughness: 0.9 }));
  base.position.y = 0.33;
  group.add(base);
  const soil = box(obstacle.width - 0.5, 0.1, obstacle.depth - 0.5, new THREE.MeshStandardMaterial({ color: 0x30251d, roughness: 1 }));
  soil.position.y = 0.7;
  group.add(soil);
  const plantMaterial = new THREE.MeshStandardMaterial({ color: 0x4f784f, roughness: 0.95 });
  const count = Math.max(3, Math.floor(obstacle.width / 1.8));
  for (let index = 0; index < count; index += 1) {
    const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72 + (index % 2) * 0.16, 1), plantMaterial);
    shrub.position.set(-obstacle.width / 2 + (index + 0.5) * obstacle.width / count, 1.2, (index % 2 ? 0.5 : -0.45));
    shrub.castShadow = true;
    group.add(shrub);
  }
  return group;
}

export class ParkingWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 300);
  readonly car = createCar(0xa9ed72, true);
  private readonly levelObjects = new THREE.Group();
  private readonly target = new THREE.Group();
  private readonly cameraLook = new THREE.Vector3();
  private readonly resizeObserver: ResizeObserver;
  private overhead = false;
  private previousWheelPosition: THREE.Vector2 | null = null;

  constructor(private readonly mount: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.setAttribute("aria-label", "Interactive three-dimensional parking lot");
    this.mount.append(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x9fc8c2);
    this.scene.fog = new THREE.Fog(0x9fc1b8, 72, 145);
    this.setupEnvironment();
    this.scene.add(this.levelObjects, this.target, this.car);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.mount);
    this.resize();
  }

  loadLevel(level: Level): void {
    this.previousWheelPosition = null;
    this.levelObjects.clear();
    this.target.clear();
    for (const obstacle of level.obstacles) {
      let object: THREE.Group;
      if (obstacle.kind === "parked-car") object = createCar(obstacle.color ?? 0x7b8d88, false);
      else if (obstacle.kind === "barrier") object = createBarrier(obstacle);
      else object = createPlanter(obstacle);
      object.position.set(obstacle.x, 0, obstacle.z);
      object.rotation.y = obstacle.rotation ?? 0;
      this.levelObjects.add(object);
    }
    this.buildTarget(level);
  }

  updateCar(state: CarState): void {
    this.car.position.set(state.x, 0, state.z);
    this.car.rotation.y = -state.heading;
    const position = new THREE.Vector2(state.x, state.z);
    const distance = this.previousWheelPosition ? position.distanceTo(this.previousWheelPosition) : 0;
    this.previousWheelPosition = position;
    for (const wheel of this.car.children) {
      if (wheel.name !== "front-wheel" && wheel.name !== "rear-wheel") continue;
      wheel.rotation.y = wheel.name === "front-wheel" ? -state.steering * 0.45 : 0;
      wheel.children[0].rotation.x -= distance * Math.sign(state.speed) / 0.38;
    }
  }

  updateCamera(state: CarState, delta: number, immediate = false): void {
    const forward = new THREE.Vector3(Math.sin(state.heading), 0, -Math.cos(state.heading));
    const desired = this.overhead
      ? new THREE.Vector3(state.x, 42, state.z + 0.01)
      : new THREE.Vector3(state.x, 7.6, state.z).addScaledVector(forward, -13.5);
    const lookAt = this.overhead
      ? new THREE.Vector3(state.x, 0, state.z)
      : new THREE.Vector3(state.x, 1, state.z).addScaledVector(forward, 5.2);
    const blend = immediate ? 1 : 1 - Math.exp(-delta * 5.5);
    this.camera.up.set(0, this.overhead ? 0 : 1, this.overhead ? -1 : 0);
    this.camera.position.lerp(desired, blend);
    this.cameraLook.lerp(lookAt, blend);
    this.camera.lookAt(this.cameraLook);
  }

  toggleCamera(): boolean {
    this.overhead = !this.overhead;
    return this.overhead;
  }

  setTargetReady(ready: boolean): void {
    this.target.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.emissiveIntensity = ready ? 3.5 : 1.3;
      }
    });
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const width = Math.max(1, this.mount.clientWidth);
    const height = Math.max(1, this.mount.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private setupEnvironment(): void {
    const hemisphere = new THREE.HemisphereLight(0xd7f0ef, 0x243b31, 2.1);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(0xfff0c9, 4.2);
    sun.position.set(-28, 42, 24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -52;
    sun.shadow.camera.right = 52;
    sun.shadow.camera.top = 48;
    sun.shadow.camera.bottom = -48;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);

    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 120),
      new THREE.MeshStandardMaterial({ color: 0x395b49, roughness: 1 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.12;
    grass.receiveShadow = true;
    this.scene.add(grass);

    const asphaltTexture = createAsphaltTexture();
    const asphalt = new THREE.Mesh(
      new THREE.PlaneGeometry(LOT_WIDTH, LOT_DEPTH),
      new THREE.MeshStandardMaterial({ map: asphaltTexture, bumpMap: asphaltTexture, bumpScale: 0.08, color: 0xd3d6d4, roughness: 0.94, metalness: 0.03 })
    );
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.receiveShadow = true;
    this.scene.add(asphalt);

    const curbMaterial = new THREE.MeshStandardMaterial({ color: 0x9ca89c, roughness: 0.9 });
    const northCurb = box(LOT_WIDTH + 1, 0.42, 0.6, curbMaterial);
    const southCurb = northCurb.clone();
    northCurb.position.set(0, 0.12, -LOT_DEPTH / 2);
    southCurb.position.set(0, 0.12, LOT_DEPTH / 2);
    const westCurb = box(0.6, 0.42, LOT_DEPTH, curbMaterial);
    const eastCurb = westCurb.clone();
    westCurb.position.set(-LOT_WIDTH / 2, 0.12, 0);
    eastCurb.position.set(LOT_WIDTH / 2, 0.12, 0);
    this.scene.add(northCurb, southCurb, westCurb, eastCurb);

    const bayGroup = new THREE.Group();
    for (let x = -34; x <= 34; x += 8.5) {
      addParkingBay(bayGroup, x, -23.3, true);
      addParkingBay(bayGroup, x, 23.3, false);
    }
    const centerLineMaterial = new THREE.MeshStandardMaterial({ color: 0xe4e7dd, roughness: 0.9 });
    for (let z = -9; z <= 11; z += 5) {
      const dash = box(0.18, 0.03, 2.2, centerLineMaterial);
      dash.position.set(0, 0.04, z);
      bayGroup.add(dash);
    }
    this.scene.add(bayGroup);

    const lampPositions: Array<[number, number]> = [[-38, -24], [38, -24], [-38, 24], [38, 24], [0, -28], [0, 28]];
    for (const [x, z] of lampPositions) this.scene.add(this.createLamp(x, z));

    const treePositions: Array<[number, number, number]> = [
      [-49, -30, 1.4], [-44, -11, 1.1], [-50, 12, 1.45], [-45, 33, 1.2],
      [49, -31, 1.35], [46, -9, 1.15], [50, 14, 1.45], [45, 34, 1.2]
    ];
    for (const [x, z, scale] of treePositions) this.scene.add(createTree(x, z, scale));

    const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x55716b, roughness: 0.86 });
    for (let index = 0; index < 9; index += 1) {
      const width = 7 + (index % 3) * 2;
      const height = 8 + (index % 4) * 3;
      const building = box(width, height, 7, buildingMaterial);
      building.position.set(-40 + index * 10, height / 2, -52 - (index % 2) * 4);
      this.scene.add(building);
      const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x47646b, metalness: 0.45, roughness: 0.22 });
      for (let floor = 2; floor < height - 1; floor += 2.4) {
        const windows = box(width - 1.2, 1.3, 0.04, windowMaterial);
        windows.position.set(building.position.x, floor, building.position.z + 3.53);
        this.scene.add(windows);
      }
      const ledge = box(width + 0.3, 0.25, 7.3, curbMaterial);
      ledge.position.set(building.position.x, height, building.position.z);
      this.scene.add(ledge);
    }
    for (const side of [-1, 1]) {
      const sidewalk = box(3, 0.16, LOT_DEPTH + 6, curbMaterial);
      sidewalk.position.set(side * (LOT_WIDTH / 2 + 2), -0.01, 0);
      this.scene.add(sidewalk);
      for (let z = -28; z <= 28; z += 2) {
        const seam = box(2.9, 0.01, 0.025, darkMetal);
        seam.position.set(side * (LOT_WIDTH / 2 + 2), 0.08, z);
        this.scene.add(seam);
      }
    }
  }

  private createLamp(x: number, z: number): THREE.Group {
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 10), darkMetal);
    pole.position.y = 3.25;
    pole.castShadow = true;
    const housing = box(0.85, 0.28, 0.55, darkMetal);
    housing.position.set(0, 6.45, 0);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff4c4, emissive: 0xffed9f, emissiveIntensity: 5 })
    );
    bulb.position.set(0, 6.28, 0);
    const light = new THREE.PointLight(0xffedb0, 9, 17, 1.5);
    light.position.set(0, 6.1, 0);
    lamp.add(pole, housing, bulb, light);
    lamp.position.set(x, 0, z);
    return lamp;
  }

  private buildTarget(level: Level): void {
    const zone = level.zone;
    const glow = new THREE.MeshStandardMaterial({
      color: 0x9fee72,
      emissive: 0x73d94c,
      emissiveIntensity: 1.3,
      transparent: true,
      opacity: 0.84,
      roughness: 0.55
    });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(zone.width - 0.3, zone.depth - 0.3),
      new THREE.MeshBasicMaterial({ color: 0x72dc4e, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.055;
    const sideA = box(0.16, 0.045, zone.depth, glow);
    const sideB = sideA.clone();
    sideA.position.set(-zone.width / 2, 0.07, 0);
    sideB.position.set(zone.width / 2, 0.07, 0);
    const back = box(zone.width, 0.045, 0.16, glow);
    back.position.set(0, 0.07, -zone.depth / 2);
    const front = back.clone();
    front.position.z = zone.depth / 2;
    this.target.add(floor, sideA, sideB, back, front);
    this.target.position.set(zone.x, 0, zone.z);
    this.target.rotation.y = zone.heading;
  }
}
