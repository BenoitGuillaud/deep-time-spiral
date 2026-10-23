import { select } from 'd3';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  RepeatWrapping,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { event as findEvent, resolveAge } from '../data';
import { CORKSCREW, createHelixPath, type HelixPath, type Point3 } from '../geometry/helix';
import { t } from '../i18n/i18n';
import { COSMOS_COLOR } from '../render/events';
import { outlineOf, placeFlags } from '../render/flag-placement';
import type { Flag } from '../render/flags';
import { drawBadge } from '../render/illustrations/icons';
import { seeded } from '../render/seeded';
import { spanBands, type Band } from '../render/span-colours';
import {
  eventPose,
  fitDistance,
  flightPose,
  FOV,
  presetPose,
  stickerSize,
  viewFrame,
  type CameraPose,
  type ViewName,
} from './camera';
import { helixRibbon } from './helix-ribbon';

/** The 3D corkscrew (three.js): one true-size spiral from Now down to the Big Bang. */

export interface HelixViewOptions {
  /** Opens the event card once the camera has arrived. */
  onSelect: (flag: Flag) => void;
  reducedMotion: boolean;
}

export interface HelixView {
  setView(view: ViewName): void;
  resize(): void;
  dispose(): void;
}

const FLIGHT_MS = 1100;
const IDLE_SPIN_MS = 10_000;

const vec = (p: Point3): Vector3 => new Vector3(p.x, p.y, p.z);

function glowTexture(inner: string, outer: string): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.4, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The time before Earth: deep violet sprinkled with stars, tiling along the ribbon. */
function cosmosTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = COSMOS_COLOR;
    ctx.fillRect(0, 0, size, size);
    const random = seeded(7);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(240,235,255,${(0.5 + random() * 0.5).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(random() * size, random() * size, 1 + random() * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

function points(positions: Float32Array, colors: Float32Array, size: number): Points {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return new Points(
    geometry,
    new PointsMaterial({ size, vertexColors: true, transparent: true, opacity: 0.9 }),
  );
}

function stars(): Points {
  const random = seeded(42);
  const count = 1800;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Uniform directions on a sphere, at a large distance.
    const z = random() * 2 - 1;
    const a = random() * Math.PI * 2;
    const r = 30 + random() * 25;
    const s = Math.sqrt(1 - z * z);
    positions.set([r * s * Math.cos(a), r * z, r * s * Math.sin(a)], i * 3);
    const b = 0.45 + random() * 0.55;
    colors.set([b, b, Math.min(1, b + 0.08)], i * 3);
  }
  return points(positions, colors, 0.14);
}

/** Stardust floating around the coils before the Earth (decoration, not data). */
function stardust(path: HelixPath, from: number): Points {
  const random = seeded(11);
  const count = 420;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const f = from + random() * (1 - from);
    const c = path.pointAt(f);
    const a = path.across(f);
    const spread = path.widthAt(f) * 1.6;
    const side = (random() - 0.5) * spread;
    positions.set(
      [c.x + a.x * side, c.y + (random() - 0.3) * spread * 0.6, c.z + a.z * side],
      i * 3,
    );
    const b = 0.7 + random() * 0.3;
    colors.set([b, b * 0.92, 1], i * 3);
  }
  return points(positions, colors, 0.012);
}

function ribbonMesh(path: HelixPath, band: Band, material: Material, widthScale = 1): Mesh {
  const arrays = helixRibbon(path, band.from, band.to, {
    widthScale,
    thickness: widthScale > 1 ? 0.06 : 0.2,
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(arrays.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(arrays.normals, 3));
  geometry.setAttribute('uv', new BufferAttribute(arrays.uvs, 2));
  geometry.setIndex(new BufferAttribute(arrays.indices, 1));
  return new Mesh(geometry, material);
}

// Lambert, not the heavier physically based shader: much quicker to compile on slow tablets, and
// the strong emissive part keeps the ICS colours true whatever the lighting.
function lit(color: string): MeshLambertMaterial {
  return new MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.32 });
}

function halo(color: string): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.16,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

/** Lets the browser breathe between building steps, so no single task blocks a tap for long. */
const breathe = (): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });

/** A label floating in the scene (HTML, so it stays crisp and readable). */
function floatingText(className: string, text: string): CSS2DObject {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  el.setAttribute('aria-hidden', 'true');
  return new CSS2DObject(el);
}

interface Target {
  flag: Flag;
  id: string;
  pose: CameraPose;
}

interface Built {
  /** Points along the corkscrew and the flags, for framing the camera. */
  outline: Point3[];
}

/** Builds the corkscrew for a time span (years), with a flag for each event inside it. */
async function buildContent(
  group: Group,
  path: HelixPath,
  spanYears: number,
  badge: number,
  onPick: (target: Target) => void,
): Promise<Built> {
  const bands = spanBands(spanYears);

  // The ribbon: one stretch per colour band, with a faint wider glow underneath.
  for (const band of bands) {
    const cosmos = band.unitId === null;
    const material = cosmos
      ? new MeshLambertMaterial({
          map: cosmosTexture(),
          emissive: new Color(COSMOS_COLOR),
          emissiveIntensity: 0.55,
        })
      : lit(band.color);
    group.add(ribbonMesh(path, band, material));
    group.add(ribbonMesh(path, band, halo(cosmos ? '#6c5ce7' : band.color), 1.9));
  }
  const cosmos = bands.find((b) => b.unitId === null);
  if (cosmos) group.add(stardust(path, cosmos.from));
  await breathe();

  // Glows: Now at the start, the Big Bang at the bottom tip.
  const glow = (texture: CanvasTexture, at: Point3, size: number): void => {
    const sprite = new Sprite(
      new SpriteMaterial({ map: texture, blending: AdditiveBlending, depthWrite: false }),
    );
    sprite.position.copy(vec(at));
    sprite.scale.set(size, size, 1);
    group.add(sprite);
  };
  const now = path.pointAt(0);
  glow(glowTexture('rgba(255,230,160,1)', 'rgba(255,209,102,0.45)'), now, 0.34);
  glow(glowTexture('rgba(255,250,230,1)', 'rgba(255,170,80,0.5)'), path.pointAt(1), 0.75);
  const you = floatingText('you-label3d', t('spiral.you'));
  // Just below the Now glow: the flags stand above it, and below are only the unlabelled coils.
  you.position.set(now.x - 0.04, now.y - 0.1, now.z + 0.06);
  group.add(you);

  // Event flags: a pole on the exact spot, the picture on top (placement shared with 2D).
  const placed = placeFlags(path, spanYears);
  const outline = outlineOf(path, placed);
  for (const { flag, look, foot, top } of placed) {
    group.add(
      new Line(
        new BufferGeometry().setFromPoints([vec(foot), vec(top)]),
        new LineBasicMaterial({ color: look.ring, transparent: true, opacity: 0.85 }),
      ),
    );

    const radius = Math.hypot(foot.x, foot.z);
    const target: Target = {
      flag,
      id: look.id,
      pose: eventPose(top, { x: 0, y: top.y, z: 0 }, 0.5 + 0.9 * radius),
    };
    const wrap = document.createElement('div');
    wrap.className = 'sticker';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sticker-button';
    button.dataset.event = look.id;
    button.setAttribute('aria-label', look.name);
    const box = badge * 1.32;
    const svg = select(button)
      .append('svg')
      .attr('width', box)
      .attr('height', box)
      .attr('viewBox', `${String(-box / 2)} ${String(-box / 2)} ${String(box)} ${String(box)}`)
      .attr('aria-hidden', 'true');
    drawBadge(svg.append('g'), look.art, badge, look.ring);
    button.addEventListener('click', () => {
      onPick(target);
    });
    const label = document.createElement('span');
    label.className = 'sticker-label';
    label.textContent = look.label;
    wrap.append(button, label);
    const object = new CSS2DObject(wrap);
    object.position.copy(vec(top));
    group.add(object);
  }
  await breathe();
  return { outline };
}

/** Frees the GPU memory held by everything under `root` (geometries, materials, textures). */
function disposeTree(root: Object3D): void {
  root.traverse((object) => {
    // three.js only takes a label's HTML off the page when the label itself is removed, not when a
    // parent group is: remove it here so a rebuild never leaves old stickers behind.
    if (object instanceof CSS2DObject) object.element.remove();
    const { geometry, material } = object as Partial<Pick<Mesh, 'geometry' | 'material'>>;
    geometry?.dispose();
    const materials: Material[] =
      material === undefined ? [] : Array.isArray(material) ? material : [material];
    for (const m of materials) {
      for (const value of Object.values(m) as unknown[]) {
        if (value instanceof CanvasTexture) value.dispose();
      }
      m.dispose();
    }
  });
}

/** Mounts the 3D corkscrew into `container` (which must be visible, so it has a size). */
export async function mountHelixView(
  container: HTMLElement,
  options: HelixViewOptions,
): Promise<HelixView> {
  const { reducedMotion } = options;
  const size = (): { width: number; height: number; aspect: number } => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    return { width, height, aspect: width / height };
  };
  let { width, height, aspect } = size();

  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  // 1.5× is sharp enough for the glowing ribbon and much lighter for tablets than 2× or 3×.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(width, height);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.className = 'vortex-canvas';
  const labels = new CSS2DRenderer();
  labels.setSize(width, height);
  labels.domElement.className = 'labels3d';
  container.append(renderer.domElement, labels.domElement);

  const scene = new Scene();
  scene.background = new Color('#060a14');
  scene.add(new HemisphereLight('#c9d6ff', '#24123f', 1.25));
  const sun = new DirectionalLight('#ffffff', 1.6);
  sun.position.set(3, 6, 4);
  scene.add(sun);
  scene.add(stars());

  const camera = new PerspectiveCamera(FOV, aspect, 0.01, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.25;
  controls.maxPolarAngle = Math.PI * 0.75;
  controls.autoRotateSpeed = 0.35;

  const path = createHelixPath(CORKSCREW);
  // M2 shows the whole story, Now → Big Bang. (The Zoom Ladder, M3, will change this span.)
  const spanYears = resolveAge(findEvent('big-bang')).years;
  let outline: Point3[] = [];
  const cameraFrame = () => viewFrame(width, height);
  let content = new Group();
  let flight: {
    from: CameraPose;
    to: CameraPose;
    start: number;
    ms: number;
    done?: () => void;
  } | null = null;
  let raf = 0;
  let idleTimer: number | undefined;

  const setPose = (pose: CameraPose): void => {
    camera.position.copy(vec(pose.position));
    controls.target.copy(vec(pose.target));
    controls.update();
  };
  const currentPose = (): CameraPose => ({
    position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
  });
  const report = (cameraName?: string): void => {
    if (cameraName) container.dataset.camera = cameraName;
    container.dataset.distance = camera.position.distanceTo(controls.target).toFixed(3);
    container.dataset.azimuth = ((controls.getAzimuthalAngle() * 180) / Math.PI).toFixed(1);
  };

  const render = (): void => {
    renderer.render(scene, camera);
    labels.render(scene, camera);
  };
  const frame = (nowMs: number): void => {
    raf = 0;
    let active = false;
    if (flight) {
      const progress = (nowMs - flight.start) / flight.ms;
      setPose(flightPose(flight.from, flight.to, progress));
      if (progress >= 1) {
        const done = flight.done;
        flight = null;
        controls.enabled = true;
        done?.();
      } else {
        active = true;
      }
    }
    if (controls.update()) active = true;
    if (controls.autoRotate) active = true;
    render();
    report();
    if (active) requestRender();
  };
  function requestRender(): void {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  const flyTo = (to: CameraPose, name: string, ms: number, done?: () => void): void => {
    controls.autoRotate = false;
    if (reducedMotion || ms <= 0) {
      setPose(to);
      report(name);
      requestRender();
      done?.();
      return;
    }
    controls.enabled = false;
    flight = {
      from: currentPose(),
      to,
      start: performance.now(),
      ms,
      done: () => {
        report(name);
        done?.();
      },
    };
    requestRender();
  };

  // Counts builds, so a slow build finishing after a newer one throws itself away.
  let builds = 0;
  const build = async (): Promise<void> => {
    const id = ++builds;
    scene.remove(content);
    disposeTree(content);
    const next = new Group();
    content = next;
    const built = await buildContent(
      next,
      path,
      spanYears,
      stickerSize(width, height),
      ({ flag, id, pose }) => {
        flyTo(pose, id, FLIGHT_MS, () => {
          options.onSelect(flag);
        });
      },
    );
    if (id !== builds) {
      disposeTree(next);
      return;
    }
    outline = built.outline;
    scene.add(next);
    controls.maxDistance = fitDistance(CORKSCREW.topRadius + CORKSCREW.depth, FOV, aspect) * 2.4;
    // Compile the shaders in the background where the browser can, instead of at the first draw.
    await renderer.compileAsync(scene, camera);
  };

  // Gentle auto-spin, only after the child has played with it and then left it alone.
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    window.clearTimeout(idleTimer);
    container.dataset.camera = 'free';
  });
  controls.addEventListener('end', () => {
    if (reducedMotion) return;
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      controls.autoRotate = true;
      requestRender();
    }, IDLE_SPIN_MS);
  });
  controls.addEventListener('change', requestRender);

  await build();
  setPose(presetPose('home', outline, cameraFrame()));
  report('home');
  requestRender();

  return {
    setView(view) {
      flyTo(presetPose(view, outline, cameraFrame()), view, FLIGHT_MS);
    },
    resize() {
      ({ width, height, aspect } = size());
      renderer.setSize(width, height);
      labels.setSize(width, height);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      requestRender();
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.clearTimeout(idleTimer);
      controls.dispose();
      disposeTree(scene);
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
  };
}
