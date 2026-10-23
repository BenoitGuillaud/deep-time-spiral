import { select } from 'd3';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
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
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { event as findEvent, resolveAge, unitsOfRank } from '../data';
import { evenSpiralPoint, linearMapping } from '../geometry/spiral';
import { vortexPoint, type Point3 } from '../geometry/vortex';
import { t } from '../i18n/i18n';
import {
  COSMOS_COLOR,
  eventLabel,
  eventName,
  LENS_EVENTS,
  MAIN_EVENTS,
  timeSpans,
  zoomFactor,
  type EventMarker,
} from '../render/events';
import { formatAgo, formatSpanMillions } from '../render/format';
import { drawBadge } from '../render/illustrations/icons';
import { seeded } from '../render/seeded';
import {
  eventPose,
  fitDistance,
  flightPose,
  presetPose,
  type CameraPose,
  type Frame,
  type ViewName,
} from './camera';
import { ribbonArrays } from './ribbon-geometry';
import { computeWorld, lensRing, placed, type Placement, type World } from './world';

/** The 3D vortex view (three.js). Loaded lazily, after the 2D view has painted. */

export interface VortexViewOptions {
  /** Opens the event card once the camera has arrived. */
  onSelect: (marker: EventMarker) => void;
  reducedMotion: boolean;
  /** Start looking straight down (like the 2D map) and lift into 3D. */
  intro: boolean;
}

export interface VortexView {
  setView(view: ViewName): void;
  resize(): void;
  dispose(): void;
}

const FOV = 40;
const FLIGHT_MS = 1100;
const INTRO_MS = 2200;
const IDLE_SPIN_MS = 10_000;
/** Sticker size in px: smaller on phones, but the button (with its glow) stays over 48 px. */
const stickerSize = (width: number, height: number): number =>
  Math.round(Math.min(60, Math.max(46, Math.min(width, height) * 0.12)));

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
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return new Points(
    geometry,
    new PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0.9 }),
  );
}

function ribbonMesh(
  placement: Placement,
  u0: number,
  u1: number,
  material: Material,
  scale = 1,
): Mesh {
  const { width, thickness } = placement.ribbon;
  const arrays = ribbonArrays(
    placement.vortex,
    u0,
    u1,
    width * scale,
    thickness * (scale > 1 ? 0.4 : 1),
  );
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(arrays.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(arrays.normals, 3));
  geometry.setAttribute('uv', new BufferAttribute(arrays.uvs, 2));
  geometry.setIndex(new BufferAttribute(arrays.indices, 1));
  const mesh = new Mesh(geometry, material);
  mesh.position.copy(vec(placement.origin));
  return mesh;
}

// Lambert, not the heavier physically based shader: much quicker to compile on slow tablets, and
// the strong emissive part keeps the ICS colours true whatever the lighting.
function lit(color: string): MeshLambertMaterial {
  return new MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.32 });
}

/** Lets the browser breathe between building steps, so no single task blocks a tap for long. */
const breathe = (): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });

function halo(color: string): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.16,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

/** A label floating in the scene (HTML, so it stays crisp and readable). */
function floatingText(className: string, text: string): CSS2DObject {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  el.setAttribute('aria-hidden', 'true');
  return new CSS2DObject(el);
}

interface Target {
  marker: EventMarker;
  pose: CameraPose;
}

/** Builds everything that depends on the layout; returns the fly-to targets. */
async function buildContent(
  group: Group,
  world: World,
  badge: number,
  onPick: (target: Target) => void,
): Promise<void> {
  const spans = timeSpans();
  const { main, lens } = world;
  const mainMap = linearMapping(spans.main);
  const lensMap = linearMapping(spans.lens);

  // Main ribbon: the four eons in ICS colours, then the starry time before Earth.
  const cosmos = new MeshLambertMaterial({
    map: cosmosTexture(),
    emissive: new Color(COSMOS_COLOR),
    emissiveIntensity: 0.55,
  });
  for (const eon of unitsOfRank('eon')) {
    const u0 = mainMap.toUnit(eon.end.ma * 1e6);
    const u1 = mainMap.toUnit(eon.begin.ma * 1e6);
    group.add(ribbonMesh(main, u0, u1, lit(eon.color)));
    group.add(ribbonMesh(main, u0, u1, halo(eon.color), 1.9));
  }
  const earth = mainMap.toUnit(spans.earth);
  group.add(ribbonMesh(main, earth, 1, cosmos));
  group.add(ribbonMesh(main, earth, 1, halo('#6c5ce7'), 1.9));
  await breathe();

  // Lens ribbon: the Phanerozoic by ICS period.
  for (const period of unitsOfRank('period').filter((p) => p.begin.ma * 1e6 <= spans.lens)) {
    const u0 = lensMap.toUnit(period.end.ma * 1e6);
    const u1 = lensMap.toUnit(period.begin.ma * 1e6);
    group.add(ribbonMesh(lens, u0, u1, lit(period.color)));
    group.add(ribbonMesh(lens, u0, u1, halo(period.color), 1.9));
  }
  await breathe();

  // Glows: Now on both summits, and the Big Bang at the bottom rim.
  const glow = (texture: CanvasTexture, at: Point3, size: number): void => {
    const sprite = new Sprite(
      new SpriteMaterial({ map: texture, blending: AdditiveBlending, depthWrite: false }),
    );
    sprite.position.copy(vec(at));
    sprite.scale.set(size, size, 1);
    group.add(sprite);
  };
  const now = glowTexture('rgba(255,230,160,1)', 'rgba(255,209,102,0.45)');
  glow(now, main.origin, 0.32);
  glow(now, lens.origin, 0.3);
  glow(
    glowTexture('rgba(255,250,230,1)', 'rgba(255,170,80,0.5)'),
    placed(main, vortexPoint(1, main.vortex)),
    0.9,
  );

  // Magnifier ring around the Phanerozoic on the main summit, and a light beam to the lens.
  const uPhanerozoic = mainMap.toUnit(spans.lens);
  const ringRadius = evenSpiralPoint(uPhanerozoic, main.vortex).r + main.ribbon.width / 2 + 0.04;
  const ringY = main.origin.y - (main.vortex.depth * uPhanerozoic) / 2;
  const glass = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 });
  const magnifier = new Mesh(new TorusGeometry(ringRadius, 0.008, 10, 96), glass);
  magnifier.rotation.x = Math.PI / 2;
  magnifier.position.set(main.origin.x, ringY, main.origin.z);
  group.add(magnifier);
  const { radius: lensRingRadius, y: lensRingY } = lensRing(lens);
  const lensRim = new Mesh(new TorusGeometry(lensRingRadius, 0.012, 10, 128), glass);
  lensRim.rotation.x = Math.PI / 2;
  lensRim.position.set(lens.origin.x, lensRingY, lens.origin.z);
  group.add(lensRim);
  const from = new Vector3(main.origin.x, ringY, main.origin.z);
  const to = new Vector3(lens.origin.x, lensRingY, lens.origin.z);
  const beam = new Mesh(
    new CylinderGeometry(lensRingRadius, ringRadius, from.distanceTo(to), 48, 1, true),
    new MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.018,
      side: DoubleSide,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  beam.position.copy(from.clone().add(to).multiplyScalar(0.5));
  beam.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize());
  group.add(beam);

  // Floating labels: honest zoom factor and the lens span on the lens rim (the badge at the back,
  // above it on screen; the caption at the front, below it), and "you are here".
  const zoom = String(Math.max(2, Math.round(zoomFactor(main.vortex, lens.vortex))));
  const pill = floatingText('pill3d pill3d-zoom', t('lens.title', { zoom }));
  pill.position.set(lens.origin.x, lens.origin.y + 0.12, lens.origin.z - lensRingRadius);
  group.add(pill);
  const caption = floatingText(
    'pill3d',
    t('lens.caption', { span: formatSpanMillions(spans.lens) }),
  );
  caption.position.set(lens.origin.x, lensRingY - 0.08, lens.origin.z + lensRingRadius + 0.08);
  group.add(caption);
  const you = floatingText('you-label3d', t('spiral.you'));
  you.position.set(lens.origin.x - 0.1, lens.origin.y + 0.16, lens.origin.z);
  group.add(you);

  // Event stickers: real HTML buttons at the exact spot of each event.
  const sticker = (
    marker: EventMarker,
    placement: Placement,
    u: number,
    distance: number,
    offset?: Point3,
  ): void => {
    const exact = placed(placement, vortexPoint(u, placement.vortex));
    exact.y += placement.ribbon.thickness / 2;
    const at = offset
      ? { x: exact.x + offset.x, y: exact.y + offset.y, z: exact.z + offset.z }
      : exact;
    if (offset) {
      // A pointer from the badge to the exact spot, for events too close to now to see.
      const line = new Line(
        new BufferGeometry().setFromPoints([vec(exact), vec(at)]),
        new LineBasicMaterial({ color: marker.ring }),
      );
      group.add(line);
    }
    const target: Target = { marker, pose: eventPose(at, placement.origin, distance) };
    const wrap = document.createElement('div');
    wrap.className = 'sticker';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sticker-button';
    button.dataset.event = marker.id;
    button.setAttribute(
      'aria-label',
      eventName(marker.id, formatAgo(resolveAge(findEvent(marker.id)))),
    );
    const box = badge * 1.32;
    const svg = select(button)
      .append('svg')
      .attr('width', box)
      .attr('height', box)
      .attr('viewBox', `${String(-box / 2)} ${String(-box / 2)} ${String(box)} ${String(box)}`)
      .attr('aria-hidden', 'true');
    drawBadge(svg.append('g'), marker.art, badge, marker.ring);
    button.addEventListener('click', () => {
      onPick(target);
    });
    const label = document.createElement('span');
    label.className = 'sticker-label';
    label.textContent = eventLabel(marker.id);
    wrap.append(button, label);
    const object = new CSS2DObject(wrap);
    object.position.copy(vec(at));
    group.add(object);
  };
  for (const marker of MAIN_EVENTS) {
    sticker(marker, main, mainMap.toUnit(resolveAge(findEvent(marker.id)).years), 2.4);
  }
  for (const marker of LENS_EVENTS) {
    const u = lensMap.toUnit(resolveAge(findEvent(marker.id)).years);
    const offset = marker.id === 'first-people' ? { x: 0.62, y: 0.18, z: 0.12 } : undefined;
    sticker(marker, lens, u, marker.id === 'first-people' ? 1.6 : 2, offset);
  }
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

/** Mounts the 3D vortex into `container` (which must be visible, so it has a size). */
export async function mountVortexView(
  container: HTMLElement,
  options: VortexViewOptions,
): Promise<VortexView> {
  const { reducedMotion } = options;
  const size = (): { width: number; height: number; aspect: number } => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    return { width, height, aspect: width / height };
  };
  let { width, height, aspect } = size();

  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  // 1.5× is sharp enough for the glowing ribbons and much lighter for tablets than 2× or 3×.
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
  const sky = stars();
  scene.add(sky);

  const camera = new PerspectiveCamera(FOV, aspect, 0.01, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.3;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.autoRotateSpeed = 0.35;

  let world = computeWorld(aspect);
  const cameraFrame = (): Frame => {
    const sticker = stickerSize(width, height) * 0.7;
    return {
      fovDeg: FOV,
      aspect,
      marginX: Math.min(0.2, (sticker + 8) / width),
      marginY: Math.min(0.25, (Math.max(sticker, 80) + 4) / height),
    };
  };
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
  const frame = (now: number): void => {
    raf = 0;
    let active = false;
    if (flight) {
      const progress = (now - flight.start) / flight.ms;
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
    await buildContent(next, world, stickerSize(width, height), ({ marker, pose }) => {
      flyTo(pose, marker.id, FLIGHT_MS, () => {
        options.onSelect(marker);
      });
    });
    if (id !== builds) {
      disposeTree(next);
      return;
    }
    scene.add(next);
    controls.maxDistance = fitDistance(world.bounds.radius, FOV, aspect) * 2.2;
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
  const home = presetPose('home', world, cameraFrame());
  if (options.intro && !reducedMotion) {
    setPose(presetPose('top', world, cameraFrame()));
    report('top');
    flyTo(home, 'home', INTRO_MS);
  } else {
    setPose(home);
    report('home');
    requestRender();
  }

  return {
    setView(view) {
      flyTo(presetPose(view, world, cameraFrame()), view, FLIGHT_MS);
    },
    resize() {
      ({ width, height, aspect } = size());
      renderer.setSize(width, height);
      labels.setSize(width, height);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      const next = computeWorld(aspect);
      if (next.landscape !== world.landscape) {
        // Portrait ↔ landscape: the lens moves, so rebuild and go home.
        world = next;
        void build().then(() => {
          setPose(presetPose('home', world, cameraFrame()));
          report('home');
          requestRender();
        });
      }
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
