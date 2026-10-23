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
  MOUSE,
  TOUCH,
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
import { COSMOS_COLOR, YOU_GAP } from '../render/events';
import { outlineOf, placeFlags } from '../render/flag-placement';
import type { Flag } from '../render/flags';
import { drawBadge } from '../render/illustrations/icons';
import { seeded } from '../render/seeded';
import { spanBands, type Band } from '../render/span-colours';
import {
  easeInOutCubic,
  eventPose,
  fitDistance,
  flightPose,
  FOV,
  journeyPose,
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

/** One moment of the landing journey, as the 3D view draws it (see `journeyState`). */
export interface JourneyFrame {
  f: number;
  popped: readonly string[];
  highlight: [number, number] | null;
  /** Milliseconds into the current stop, for pulsing the highlight. */
  stepMs: number;
  travelling: boolean;
  flash: number;
  finale: number;
  /** Screen space covered by the caption panel. */
  inset: { right: number; bottom: number };
}

export interface HelixView {
  setView(view: ViewName): void;
  /** Draws a moment of the landing journey; null ends it and gives the controls back. */
  journey(frame: JourneyFrame | null): void;
  /** Move mode: one finger or a plain drag slides the model instead of turning it. */
  setMoveMode(on: boolean): void;
  resize(): void;
  dispose(): void;
}

const FLIGHT_MS = 1100;
const BANG_GLOW = 0.75;
/** How quickly the journey camera catches up with where it should be (seconds). */
const JOURNEY_LAG = 0.35;
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

/**
 * Stardust floating around the coils before the Earth (decoration, not data). Sorted from Now to
 * the past, so the journey can reveal it with the ribbon; `fractions` says where each speck is.
 */
function stardust(path: HelixPath, from: number): { dust: Points; fractions: number[] } {
  const random = seeded(11);
  const count = 420;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const fractions = Array.from({ length: count }, () => from + random() * (1 - from)).sort(
    (a, b) => a - b,
  );
  for (let i = 0; i < count; i++) {
    const f = fractions[i] ?? 1;
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
  return { dust: points(positions, colors, 0.012), fractions };
}

/** A stretch of ribbon the journey draws bit by bit: its triangles go from Now to the past. */
interface Reveal {
  mesh: Mesh;
  from: number;
  to: number;
  steps: number;
  indicesPerStep: number;
}

function ribbonMesh(
  path: HelixPath,
  band: Pick<Band, 'from' | 'to'>,
  material: Material,
  widthScale = 1,
  reveals?: Reveal[],
): Mesh {
  const arrays = helixRibbon(path, band.from, band.to, {
    widthScale,
    thickness: widthScale > 1 ? 0.06 : 0.2,
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(arrays.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(arrays.normals, 3));
  geometry.setAttribute('uv', new BufferAttribute(arrays.uvs, 2));
  geometry.setIndex(new BufferAttribute(arrays.indices, 1));
  const mesh = new Mesh(geometry, material);
  const { indicesPerStep } = arrays;
  reveals?.push({
    mesh,
    from: band.from,
    to: band.to,
    steps: arrays.indices.length / indicesPerStep,
    indicesPerStep,
  });
  return mesh;
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
  /** What the journey reveals bit by bit. */
  reveals: Reveal[];
  dust: { dust: Points; fractions: number[] } | null;
  stickers: Map<string, HTMLElement>;
  poles: Map<string, Line>;
  bangGlow: Sprite;
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
  const reveals: Reveal[] = [];
  const stickers = new Map<string, HTMLElement>();
  const poles = new Map<string, Line>();

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
    group.add(ribbonMesh(path, band, material, 1, reveals));
    group.add(ribbonMesh(path, band, halo(cosmos ? '#6c5ce7' : band.color), 1.9, reveals));
  }
  const cosmos = bands.find((b) => b.unitId === null);
  const dust = cosmos ? stardust(path, cosmos.from) : null;
  if (dust) group.add(dust.dust);
  await breathe();

  // Glows: Now at the start, the Big Bang at the bottom tip.
  const glow = (texture: CanvasTexture, at: Point3, size: number): Sprite => {
    const sprite = new Sprite(
      new SpriteMaterial({ map: texture, blending: AdditiveBlending, depthWrite: false }),
    );
    sprite.position.copy(vec(at));
    sprite.scale.set(size, size, 1);
    group.add(sprite);
    return sprite;
  };
  const now = path.pointAt(0);
  glow(glowTexture('rgba(255,230,160,1)', 'rgba(255,209,102,0.45)'), now, 0.34);
  const bangGlow = glow(
    glowTexture('rgba(255,250,230,1)', 'rgba(255,170,80,0.5)'),
    path.pointAt(1),
    BANG_GLOW,
  );
  const you = floatingText('you-label3d', t('spiral.you'));
  // Just left of the Now glow, where nothing is drawn (the ribbon starts at Now); the CSS shifts
  // the text so it ends there.
  you.position.set(now.x - YOU_GAP, now.y, now.z);
  group.add(you);

  // Event flags: a pole on the exact spot, the picture on top (placement shared with 2D).
  const placed = placeFlags(path, spanYears);
  const outline = outlineOf(path, placed);
  for (const { flag, look, foot, top } of placed) {
    const pole = new Line(
      new BufferGeometry().setFromPoints([vec(foot), vec(top)]),
      new LineBasicMaterial({ color: look.ring, transparent: true, opacity: 0.85 }),
    );
    poles.set(look.id, pole);
    group.add(pole);

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
    stickers.set(look.id, wrap);
    const object = new CSS2DObject(wrap);
    object.position.copy(vec(top));
    group.add(object);
  }
  await breathe();
  return { outline, reveals, dust, stickers, poles, bangGlow };
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
  controls.keyPanSpeed = 20;
  controls.listenToKeyEvents(window);

  const path = createHelixPath(CORKSCREW);
  // M2 shows the whole story, Now → Big Bang. (The Zoom Ladder, M3, will change this span.)
  const spanYears = resolveAge(findEvent('big-bang')).years;
  let outline: Point3[] = [];
  let parts: Built | null = null;
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
    // Looking down from above (the Top view, or dragged there): the CSS tucks the labels away.
    container.dataset.overhead = String(controls.getPolarAngle() < 0.5);
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
    parts = built;
    scene.add(next);
    controls.maxDistance = fitDistance(CORKSCREW.topRadius + CORKSCREW.depth, FOV, aspect) * 2.4;
    // Compile the shaders in the background where the browser can, instead of at the first draw.
    await renderer.compileAsync(scene, camera);
  };

  // The landing journey: the spark, the pulsing highlight, and the camera that follows them.
  const spark = new Sprite(
    new SpriteMaterial({
      map: glowTexture('rgba(255,255,240,1)', 'rgba(255,220,140,0.6)'),
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  spark.visible = false;
  scene.add(spark);
  let highlight: { mesh: Mesh; range: [number, number] } | null = null;
  let journeyCamera: { pose: CameraPose; at: number } | null = null;

  const setHighlight = (range: [number, number] | null): void => {
    if (highlight && range && highlight.range[0] === range[0] && highlight.range[1] === range[1]) {
      return;
    }
    if (highlight) {
      scene.remove(highlight.mesh);
      disposeTree(highlight.mesh);
      highlight = null;
    }
    if (range) {
      const material = new MeshBasicMaterial({
        color: '#ffe08a',
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      // A glowing block around the ribbon: wide and tall, so it shows from any angle.
      const arrays = helixRibbon(path, range[0], range[1], { widthScale: 2.2, thickness: 1.6 });
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(arrays.positions, 3));
      geometry.setIndex(new BufferAttribute(arrays.indices, 1));
      const mesh = new Mesh(geometry, material);
      scene.add(mesh);
      highlight = { mesh, range };
    }
  };

  /** Shows the corkscrew drawn up to `f`, with only the popped pictures (null: everything). */
  const reveal = (f: number | null, popped: readonly string[] | null): void => {
    if (!parts) return;
    for (const r of parts.reveals) {
      const share = f === null ? 1 : Math.min(1, Math.max(0, (f - r.from) / (r.to - r.from)));
      r.mesh.geometry.setDrawRange(0, Math.floor(share * r.steps) * r.indicesPerStep);
    }
    if (parts.dust) {
      const { dust, fractions } = parts.dust;
      const shown = f === null ? fractions.length : fractions.filter((x) => x <= f).length;
      dust.geometry.setDrawRange(0, shown);
    }
    for (const [id, sticker] of parts.stickers) {
      sticker.classList.toggle('waiting', popped !== null && !popped.includes(id));
    }
    for (const [id, pole] of parts.poles) pole.visible = popped === null || popped.includes(id);
  };

  const setInset = (right: number, bottom: number): void => {
    if (right < 1 && bottom < 1) {
      camera.clearViewOffset();
      camera.fov = FOV;
      camera.aspect = width / height;
    } else {
      // Render the screen as part of a bigger picture whose middle is the free area beside the
      // panel. The bigger picture's shape and field of view keep the free area's scale exactly
      // as if it were the whole screen (FOV across its height), with nothing stretched.
      const full = { width: width + right, height: height + bottom };
      const half = Math.tan((FOV * Math.PI) / 360) * (full.height / Math.max(1, height - bottom));
      camera.fov = (Math.atan(half) * 360) / Math.PI;
      camera.aspect = full.width / full.height;
      camera.setViewOffset(full.width, full.height, right, bottom, width, height);
    }
    camera.updateProjectionMatrix();
  };

  // Gentle auto-spin, only after the child has played with it and then left it alone.
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    window.clearTimeout(idleTimer);
    container.dataset.camera = 'free';
  });
  controls.addEventListener('end', () => {
    const { x, y, z } = controls.target;
    container.dataset.target = [x, y, z].map((n) => n.toFixed(2)).join(',');
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
    journey(frame) {
      if (!parts) return;
      if (frame === null) {
        journeyCamera = null;
        reveal(null, null);
        spark.visible = false;
        setHighlight(null);
        parts.bangGlow.scale.setScalar(BANG_GLOW);
        parts.bangGlow.visible = true;
        setInset(0, 0);
        controls.enabled = true;
        setPose(presetPose('home', outline, cameraFrame()));
        report('home');
        requestRender();
        return;
      }
      controls.enabled = false;
      controls.autoRotate = false;
      window.clearTimeout(idleTimer);
      reveal(frame.f, frame.popped);

      spark.visible = frame.travelling;
      spark.position.copy(vec(path.pointAt(frame.f)));
      spark.position.y += 0.01;
      const size = 0.1 + 0.02 * Math.sin(performance.now() / 90);
      spark.scale.set(size, size, 1);

      setHighlight(frame.highlight);
      if (highlight) {
        const material = highlight.mesh.material as MeshBasicMaterial;
        material.opacity = 0.35 + 0.5 * (0.5 - 0.5 * Math.cos(frame.stepMs / 260));
      }
      parts.bangGlow.visible = frame.f > 0.995;
      parts.bangGlow.scale.setScalar(BANG_GLOW * (1 + 3.5 * frame.flash));

      // The camera: framed beside the panel, sliding back to the full screen as it pulls out.
      const settle = easeInOutCubic(frame.finale);
      const right = frame.inset.right * (1 - settle);
      const bottom = frame.inset.bottom * (1 - settle);
      setInset(right, bottom);
      const freeAspect = Math.max(0.3, (width - right) / Math.max(1, height - bottom));
      const goal =
        frame.finale > 0
          ? flightPose(
              journeyPose(path, 1, freeAspect),
              presetPose('home', outline, cameraFrame()),
              frame.finale,
            )
          : journeyPose(path, frame.f, freeAspect);
      const nowMs = performance.now();
      if (!journeyCamera || reducedMotion || frame.finale >= 1) {
        journeyCamera = { pose: goal, at: nowMs };
      } else {
        // Follow smoothly: no jolt when the spark starts or stops.
        const k = 1 - Math.exp(-(nowMs - journeyCamera.at) / 1000 / JOURNEY_LAG);
        const mix = (a: Point3, b: Point3): Point3 => ({
          x: a.x + (b.x - a.x) * k,
          y: a.y + (b.y - a.y) * k,
          z: a.z + (b.z - a.z) * k,
        });
        journeyCamera = {
          pose: {
            position: mix(journeyCamera.pose.position, goal.position),
            target: mix(journeyCamera.pose.target, goal.target),
          },
          at: nowMs,
        };
      }
      setPose(journeyCamera.pose);
      report('journey');
      requestRender();
    },
    setMoveMode(on) {
      controls.mouseButtons.LEFT = on ? MOUSE.PAN : MOUSE.ROTATE;
      controls.mouseButtons.RIGHT = on ? MOUSE.ROTATE : MOUSE.PAN;
      controls.touches.ONE = on ? TOUCH.PAN : TOUCH.ROTATE;
      container.dataset.move = String(on);
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
