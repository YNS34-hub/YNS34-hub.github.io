import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { SimplexNoise } from "three/addons/math/SimplexNoise.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const PAPER = 0xf3f1ea;
const WORLD_X = new THREE.Vector3(1, 0, 0);
const WORLD_Y = new THREE.Vector3(0, 1, 0);
const EULER = new THREE.Euler(0, 0, 0, "YXZ");
const ROTATION_Y = new THREE.Quaternion();
const ROTATION_X = new THREE.Quaternion();
let areaLightsInitialized = false;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const seededRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const CAVITIES = [
  { direction: [0.47, 0.43, 0.77], depth: 0.155, radius: 0.3 },
  { direction: [-0.62, 0.18, 0.77], depth: 0.125, radius: 0.24 },
  { direction: [0.12, -0.73, 0.67], depth: 0.11, radius: 0.23 },
  { direction: [0.81, 0.26, -0.53], depth: 0.18, radius: 0.32 },
  { direction: [-0.6, 0.57, -0.56], depth: 0.145, radius: 0.28 },
  { direction: [-0.08, -0.28, -0.96], depth: 0.185, radius: 0.31 }
].map((cavity) => ({
  ...cavity,
  direction: new THREE.Vector3(...cavity.direction).normalize()
}));

export const buildNonlinearGeometry = (detail) => {
  let geometry = new THREE.IcosahedronGeometry(1, detail);

  // Weld the base icosphere before recalculating normals so the displaced
  // surface remains continuous instead of exposing triangular facets.
  geometry.deleteAttribute("normal");
  geometry.deleteAttribute("uv");
  geometry = mergeVertices(geometry, 1e-5);

  const positions = geometry.getAttribute("position");
  const noise = new SimplexNoise({ random: seededRandom(0x4a544e50) });
  const direction = new THREE.Vector3();

  for (let index = 0; index < positions.count; index += 1) {
    direction.fromBufferAttribute(positions, index).normalize();
    const { x, y, z } = direction;

    const broad = noise.noise3d(x * 0.92 + 1.4, y * 0.92 - 0.8, z * 0.92 + 0.3);
    const folded = noise.noise3d(x * 2.15 - 1.7, y * 2.15 + 2.1, z * 2.15 - 0.4);
    const fine = noise.noise3d(x * 4.1 + 0.2, y * 4.1 - 2.8, z * 4.1 + 1.9);

    let deformation = broad * 0.078 + folded * 0.032 + fine * 0.009;
    deformation += x * y * 0.026 - y * z * 0.018 + x * z * 0.014;
    deformation += Math.sin((x * 1.18 - z * 0.76 + y * 0.42) * Math.PI) * 0.018;

    for (const cavity of CAVITIES) {
      const angle = Math.acos(clamp(direction.dot(cavity.direction), -1, 1));
      const depression = -cavity.depth * Math.exp(
        -(angle * angle) / (2 * cavity.radius * cavity.radius)
      );
      const rimCenter = cavity.radius * 1.12;
      const rimWidth = cavity.radius * 0.19;
      const rim = cavity.depth * 0.31 * Math.exp(
        -((angle - rimCenter) ** 2) / (2 * rimWidth * rimWidth)
      );
      deformation += depression + rim;
    }

    const radius = 1.55 * (1 + deformation);
    const px = direction.x * radius * 1.035 + direction.y * direction.y * 0.025;
    const py = direction.y * radius * 0.985 - direction.x * direction.z * 0.018;
    const pz = direction.z * radius * 1.01 + direction.x * direction.y * 0.02;
    positions.setXYZ(index, px, py, pz);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.name = "Nonlinear level-set icosphere";
  return geometry;
};

const addBreathingDisplacement = (material, amplitude, phase) => {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSurfaceTime = { value: 0 };
    shader.uniforms.uBreathAmplitude = { value: amplitude };
    shader.uniforms.uSurfacePhase = { value: phase };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uSurfaceTime;
        uniform float uBreathAmplitude;
        uniform float uSurfacePhase;`
      )
      .replace(
        "#include <begin_vertex>",
        `vec3 transformed = vec3(position);
        float surfaceWave = sin(
          uSurfaceTime * 0.48 +
          position.x * 1.34 +
          position.y * 0.91 -
          position.z * 1.12 +
          uSurfacePhase
        );
        float secondaryWave = sin(
          uSurfaceTime * 0.31 -
          position.x * 0.72 +
          position.y * 1.23 +
          position.z * 0.83
        );
        transformed += objectNormal * (surfaceWave * 0.72 + secondaryWave * 0.28) * uBreathAmplitude;`
      );
    material.userData.surfaceShader = shader;
  };
  material.customProgramCacheKey = () => `nonlinear-breath-${amplitude}-${phase}`;
};

const updateSurfaceTime = (material, time) => {
  const shader = material.userData.surfaceShader;
  if (shader) shader.uniforms.uSurfaceTime.value = time;
};

const createGlassMaterials = (mobile) => {
  const outer = new THREE.MeshPhysicalMaterial({
    name: "Clear nonlinear glass",
    color: 0xf6f9fa,
    metalness: 0,
    roughness: mobile ? 0.085 : 0.055,
    transmission: 1,
    thickness: mobile ? 1.25 : 1.85,
    ior: 1.465,
    dispersion: mobile ? 0.018 : 0.036,
    specularIntensity: 1,
    specularColor: 0xffffff,
    clearcoat: 0.78,
    clearcoatRoughness: 0.06,
    attenuationColor: 0xe4edf1,
    attenuationDistance: 5.8,
    envMapIntensity: mobile ? 1.2 : 1.42,
    transparent: true,
    opacity: 1,
    side: THREE.FrontSide,
    depthWrite: true
  });

  const inner = new THREE.MeshPhysicalMaterial({
    name: "Inner refractive shell",
    color: 0xdce7ec,
    metalness: 0,
    roughness: mobile ? 0.16 : 0.11,
    transmission: mobile ? 0.72 : 0.84,
    thickness: 0.74,
    ior: 1.42,
    dispersion: mobile ? 0 : 0.018,
    clearcoat: 0.3,
    clearcoatRoughness: 0.12,
    attenuationColor: 0xd8e8ef,
    attenuationDistance: 3.6,
    envMapIntensity: 0.94,
    transparent: true,
    opacity: mobile ? 0.19 : 0.25,
    side: THREE.BackSide,
    depthWrite: false
  });

  addBreathingDisplacement(outer, mobile ? 0.0033 : 0.0055, 0);
  addBreathingDisplacement(inner, mobile ? 0.002 : 0.0035, 1.7);
  return { outer, inner };
};

const createOrbit = (radiusX, radiusY, opacity, color = 0x343a3e) => {
  const curve = new THREE.EllipseCurve(0, 0, radiusX, radiusY, 0, Math.PI * 2);
  const points = curve.getPoints(192).map((point) => new THREE.Vector3(point.x, point.y, 0));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false
  });
  return new THREE.LineLoop(geometry, material);
};

const disposeObject = (object) => {
  object.traverse((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
    else child.material?.dispose();
  });
};

const createFallbackController = (stage, reason) => {
  stage.classList.remove("webgl-ready", "is-dragging", "is-interacting");
  stage.classList.add("is-fallback");
  stage.dataset.renderMode = reason;
  return {
    setScroll() {},
    rotateBy() {},
    rotateTo() {},
    getState() {
      return { renderMode: reason, isThreeDimensional: false };
    },
    destroy() {}
  };
};

export const initNonlinearSphere = (canvas, stage, reducedMotionQuery) => {
  if (!canvas || !stage) return null;

  const smallScreenQuery = window.matchMedia("(max-width: 760px)");
  const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const lowPerformance = Boolean(
    connection?.saveData ||
    (navigator.deviceMemory && navigator.deviceMemory <= 1) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2)
  );

  if (reducedMotionQuery.matches) {
    return createFallbackController(stage, "reduced-motion-poster");
  }
  if (lowPerformance) {
    return createFallbackController(stage, "low-performance-poster");
  }

  const mobile = smallScreenQuery.matches || coarsePointerQuery.matches;
  const contextAttributes = {
    alpha: true,
    antialias: !mobile,
    depth: true,
    powerPreference: "high-performance",
    premultipliedAlpha: true,
    preserveDrawingBuffer: false
  };
  let webglContext = null;
  let renderer;

  try {
    webglContext = canvas.getContext("webgl2", contextAttributes);
    if (!webglContext) {
      return createFallbackController(stage, "webgl-unavailable-poster");
    }
    renderer = new THREE.WebGLRenderer({
      canvas,
      context: webglContext,
      ...contextAttributes
    });
  } catch (error) {
    renderer?.dispose();
    console.warn("The 3D glass sculpture is unavailable; showing its poster instead.", error);
    return createFallbackController(stage, "webgl-unavailable-poster");
  }

  const disposers = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const release of disposers.reverse()) release();
    renderer.dispose();
    canvas.removeAttribute("tabindex");
    canvas.setAttribute("aria-hidden", "true");
  };

  try {
    renderer.debug.onShaderError = () => { throw new Error("Physical glass shader compilation failed"); };
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = mobile ? 1.08 : 1.12;
    renderer.transmissionResolutionScale = mobile ? 0.5 : 0.78;
    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(PAPER, 1);

    const scene = new THREE.Scene();
    disposers.push(() => disposeObject(scene));
    scene.background = new THREE.Color(PAPER);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
    camera.position.set(0, 0.06, 5.7);
    camera.lookAt(0, 0, 0);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    disposers.push(() => pmremGenerator.dispose());
    pmremGenerator.compileEquirectangularShader();
    const roomEnvironment = new RoomEnvironment();
    let environmentTarget;
    try {
      environmentTarget = pmremGenerator.fromScene(roomEnvironment, 0.045);
    } finally {
      roomEnvironment.dispose();
    }
    disposers.push(() => environmentTarget.dispose());
    scene.environment = environmentTarget.texture;

    if (!areaLightsInitialized) {
      RectAreaLightUniformsLib.init();
      areaLightsInitialized = true;
    }
    const keyLight = new THREE.RectAreaLight(0xffffff, 5.8, 4.8, 4.2);
    keyLight.position.set(-3.2, 4.1, 4.6);
    keyLight.lookAt(0, 0.15, 0);
    scene.add(keyLight);

    const fillLight = new THREE.RectAreaLight(0xf8fbff, 2.35, 3.6, 4.5);
    fillLight.position.set(4.2, 0.65, 3.2);
    fillLight.lookAt(0, 0, 0);
    scene.add(fillLight);

    const rimLight = new THREE.RectAreaLight(0xd7e7ff, 3.1, 3.2, 3.2);
    rimLight.position.set(0.8, 2.7, -4.2);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    if (!mobile) {
      const shadowKey = new THREE.DirectionalLight(0xffffff, 0.72);
      shadowKey.position.set(-3.4, 5.2, 4.1);
      shadowKey.castShadow = true;
      shadowKey.shadow.mapSize.set(512, 512);
      shadowKey.shadow.camera.left = -2.7;
      shadowKey.shadow.camera.right = 2.7;
      shadowKey.shadow.camera.top = 2.7;
      shadowKey.shadow.camera.bottom = -2.7;
      shadowKey.shadow.camera.near = 1;
      shadowKey.shadow.camera.far = 12;
      shadowKey.shadow.bias = -0.00018;
      shadowKey.shadow.normalBias = 0.035;
      shadowKey.shadow.radius = 4;
      scene.add(shadowKey);

      const shadowFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(5.6, 4.8),
        new THREE.ShadowMaterial({ color: 0x263845, opacity: 0.085, transparent: true })
      );
      shadowFloor.name = "Soft studio shadow receiver";
      shadowFloor.rotation.x = -Math.PI / 2;
      shadowFloor.position.set(0, -1.66, -0.08);
      shadowFloor.receiveShadow = true;
      scene.add(shadowFloor);
    }

    const presentationGroup = new THREE.Group();
    presentationGroup.name = "Mathematical glass presentation";
    presentationGroup.position.set(0.08, 0.08, 0);
    scene.add(presentationGroup);

    const sculptureGroup = new THREE.Group();
    sculptureGroup.name = "360 degree nonlinear sculpture";
    sculptureGroup.quaternion.setFromEuler(new THREE.Euler(-0.13, -0.42, 0.08, "YXZ"));
    presentationGroup.add(sculptureGroup);

    const detail = mobile ? 16 : 28;
    const outerGeometry = buildNonlinearGeometry(detail);
    const innerGeometry = outerGeometry.clone();
    const materials = createGlassMaterials(mobile);

    const outerMesh = new THREE.Mesh(outerGeometry, materials.outer);
    outerMesh.name = "Outer physical glass surface";
    outerMesh.renderOrder = 2;
    outerMesh.castShadow = !mobile;
    sculptureGroup.add(outerMesh);

    const innerMesh = new THREE.Mesh(innerGeometry, materials.inner);
    innerMesh.name = "Inner thickness shell";
    innerMesh.scale.setScalar(0.875);
    innerMesh.renderOrder = 1;
    sculptureGroup.add(innerMesh);

    const orbitGroup = new THREE.Group();
    orbitGroup.name = "Level-set reference orbits";
    orbitGroup.position.set(0.02, 0.02, -0.48);
    const orbitA = createOrbit(2.18, 1.04, 0.095);
    orbitA.rotation.set(0.22, -0.36, -0.12);
    orbitGroup.add(orbitA);
    const orbitB = createOrbit(1.78, 1.34, 0.052, 0x234e79);
    orbitB.rotation.set(-0.48, 0.22, 0.62);
    orbitGroup.add(orbitB);
    presentationGroup.add(orbitGroup);

    const state = {
      running: true,
      visible: true,
      contextLost: false,
      dragging: false,
      pointerId: null,
      lastPointerX: 0,
      lastPointerY: 0,
      lastPointerTime: 0,
      pointerX: 0,
      pointerY: 0,
      pointerTargetX: 0,
      pointerTargetY: 0,
      velocityYaw: 0,
      velocityPitch: 0,
      scroll: 0,
      frame: 0,
      lastFrame: performance.now(),
      lastRender: 0,
      lastInteraction: performance.now(),
      elapsed: 0,
      slowFrames: 0,
      measuredFrames: 0,
      ready: false
    };
    let controller = null;
    disposers.push(() => {
      state.running = false;
      cancelAnimationFrame(state.frame);
      state.frame = 0;
      if (state.pointerId !== null && canvas.hasPointerCapture?.(state.pointerId)) {
        canvas.releasePointerCapture(state.pointerId);
      }
      if (window.__NONLINEAR_SPHERE__ === controller) delete window.__NONLINEAR_SPHERE__;
    });

    const fallBack = (reason) => {
      dispose();
      createFallbackController(stage, reason);
    };

    const updateRotationMetadata = () => {
      EULER.setFromQuaternion(sculptureGroup.quaternion, "YXZ");
      stage.dataset.rotationX = THREE.MathUtils.radToDeg(EULER.x).toFixed(1);
      stage.dataset.rotationY = THREE.MathUtils.radToDeg(EULER.y).toFixed(1);
      stage.dataset.rotationZ = THREE.MathUtils.radToDeg(EULER.z).toFixed(1);
    };

    const rotateRadians = (yaw, pitch) => {
      ROTATION_Y.setFromAxisAngle(WORLD_Y, yaw);
      ROTATION_X.setFromAxisAngle(WORLD_X, pitch);
      sculptureGroup.quaternion.premultiply(ROTATION_Y);
      sculptureGroup.quaternion.premultiply(ROTATION_X);
      sculptureGroup.quaternion.normalize();
      updateRotationMetadata();
    };

    const resize = () => {
      if (disposed) return;
      const bounds = stage.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      const aspect = width / height;
      const pixelBudget = mobile ? 520000 : 1100000;
      let pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5);
      const requestedPixels = width * height * pixelRatio * pixelRatio;
      if (requestedPixels > pixelBudget) {
        pixelRatio *= Math.sqrt(pixelBudget / requestedPixels);
      }
      renderer.setPixelRatio(Math.max(0.75, pixelRatio));
      renderer.setSize(width, height, false);
      camera.aspect = aspect;
      camera.position.z = aspect < 0.78 ? 6.65 : aspect < 1.05 ? 6.15 : 5.7;
      camera.updateProjectionMatrix();
      presentationGroup.scale.setScalar(aspect < 0.78 ? 0.94 : 1);
    };

    const onPointerDown = (event) => {
      if (disposed || event.isPrimary === false || state.dragging) return;
      if (event.button !== undefined && event.button !== 0) return;
      state.dragging = true;
      state.pointerId = event.pointerId;
      state.lastPointerX = event.clientX;
      state.lastPointerY = event.clientY;
      state.lastPointerTime = performance.now();
      state.velocityYaw = 0;
      state.velocityPitch = 0;
      state.lastInteraction = performance.now();
      stage.classList.add("is-dragging");
      stage.dataset.dragState = "dragging";
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };

    const onPointerMove = (event) => {
      if (disposed || event.isPrimary === false) return;
      const bounds = canvas.getBoundingClientRect();
      state.pointerTargetX = clamp(((event.clientX - bounds.left) / bounds.width - 0.5) * 2, -1, 1);
      state.pointerTargetY = clamp(((event.clientY - bounds.top) / bounds.height - 0.5) * 2, -1, 1);

      if (!state.dragging) {
        state.lastInteraction = performance.now();
        return;
      }
      if (event.pointerId !== state.pointerId) return;
      const deltaX = event.clientX - state.lastPointerX;
      const deltaY = event.clientY - state.lastPointerY;
      const dragScale = mobile ? 0.0074 : 0.0065;
      const yaw = deltaX * dragScale;
      const pitch = deltaY * dragScale;
      rotateRadians(yaw, pitch);
      const now = performance.now();
      const eventFrames = clamp((now - state.lastPointerTime) / (1000 / 60), 0.5, 4);
      state.velocityYaw = clamp(yaw / eventFrames * 0.48, -0.022, 0.022);
      state.velocityPitch = clamp(pitch / eventFrames * 0.48, -0.022, 0.022);
      state.lastPointerTime = now;
      state.lastPointerX = event.clientX;
      state.lastPointerY = event.clientY;
      state.lastInteraction = performance.now();
      event.preventDefault();
    };

    const endDrag = (event) => {
      if (!state.dragging) return;
      if (event?.pointerId !== undefined && event.pointerId !== state.pointerId) return;
      if (state.pointerId !== null && canvas.hasPointerCapture?.(state.pointerId)) {
        canvas.releasePointerCapture(state.pointerId);
      }
      if (performance.now() - state.lastPointerTime > 100 || event?.type === "pointercancel") {
        state.velocityYaw = 0;
        state.velocityPitch = 0;
      }
      state.dragging = false;
      state.pointerId = null;
      state.lastInteraction = performance.now();
      stage.classList.remove("is-dragging");
      stage.dataset.dragState = "inertia";
    };

    const onPointerEnter = () => {
      state.lastInteraction = performance.now();
      stage.classList.add("is-interacting");
    };

    const onPointerLeave = () => {
      state.pointerTargetX = 0;
      state.pointerTargetY = 0;
      stage.classList.remove("is-interacting");
    };

    const schedule = () => {
      if (!disposed && state.running && state.visible && !document.hidden && !state.frame) {
        state.frame = requestAnimationFrame(render);
      }
    };
    const pause = () => {
      cancelAnimationFrame(state.frame);
      state.frame = 0;
      state.lastFrame = performance.now();
      stage.dataset.animationState = "paused";
    };

    const render = (now) => {
      state.frame = 0;
      if (disposed || !state.running || !state.visible || document.hidden || state.contextLost) return;
      stage.dataset.animationState = "running";

      const targetFrameDuration = mobile ? 1000 / 30 : 1000 / 60;
      if (now - state.lastRender < targetFrameDuration * 0.88) { schedule(); return; }
      state.lastRender = now;

      const frameDuration = now - state.lastFrame;
      const delta = clamp(frameDuration / (1000 / 60), 0.25, 2.2);
      state.lastFrame = now;
      state.elapsed += Math.min(frameDuration, 80) / 1000;
      const elapsed = state.elapsed;
      // Fall back only after sustained < 12 fps, excluding shader warm-up.
      if (elapsed > 5 && !state.dragging) {
        state.measuredFrames += 1;
        if (frameDuration > 85) state.slowFrames += 1;
        if (state.measuredFrames >= 120) {
          if (state.slowFrames > 90) { fallBack("low-performance-poster"); return; }
          state.measuredFrames = 0;
          state.slowFrames = 0;
        }
      }

      state.pointerX += (state.pointerTargetX - state.pointerX) * (mobile ? 0.12 : 0.075);
      state.pointerY += (state.pointerTargetY - state.pointerY) * (mobile ? 0.12 : 0.075);
      presentationGroup.rotation.x += ((mobile ? 0 : -state.pointerY * 0.028) - presentationGroup.rotation.x) * 0.055;
      presentationGroup.rotation.y += ((mobile ? 0 : state.pointerX * 0.036) - presentationGroup.rotation.y) * 0.055;
      presentationGroup.position.y += (0.08 - state.scroll * 0.075 - presentationGroup.position.y) * 0.06;

      if (!state.dragging) {
        const hasInertia = Math.abs(state.velocityYaw) + Math.abs(state.velocityPitch) > 0.000025;
        if (hasInertia) {
          rotateRadians(state.velocityYaw * delta, state.velocityPitch * delta);
          const decay = Math.pow(0.935, delta);
          state.velocityYaw *= decay;
          state.velocityPitch *= decay;
        } else if (now - state.lastInteraction > 2600) {
          rotateRadians(0.00034 * delta, Math.sin(elapsed * 0.17) * 0.000025 * delta);
          stage.dataset.dragState = "idle-rotation";
        } else {
          stage.dataset.dragState = "resting";
        }
      }

      updateSurfaceTime(materials.outer, elapsed);
      updateSurfaceTime(materials.inner, elapsed);
      try {
        renderer.render(scene, camera);
      } catch (error) {
        console.warn("The glass renderer stopped; retaining the poster.", error);
        fallBack("webgl-render-failed-poster");
        return;
      }

      if (!state.ready) {
        state.ready = true;
        stage.classList.remove("is-fallback");
        stage.classList.add("webgl-ready");
        stage.dataset.renderMode = "three-webgl";
        canvas.removeAttribute("aria-hidden");
        canvas.tabIndex = 0;
      }
      schedule();
    };

    const onContextLost = (event) => {
      event.preventDefault();
      state.contextLost = true;
      fallBack("context-lost-poster");
    };

    const onVisibilityChange = () => {
      pause();
      schedule();
    };

    const onKeyDown = (event) => {
      const turns = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] };
      if (!turns[event.key]) return;
      event.preventDefault();
      state.lastInteraction = performance.now();
      state.velocityYaw = 0;
      state.velocityPitch = 0;
      rotateRadians(...turns[event.key]);
    };

    const onReducedMotionChange = (event) => {
      if (!event.matches) return;
      fallBack("reduced-motion-poster");
    };

    canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerenter", onPointerEnter, { passive: true });
    canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    document.addEventListener("visibilitychange", onVisibilityChange, { passive: true });
    reducedMotionQuery.addEventListener?.("change", onReducedMotionChange);

    disposers.push(() => {
      canvas.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("pointerenter", onPointerEnter);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotionQuery.removeEventListener?.("change", onReducedMotionChange);
    });
    const resizeObserver = new ResizeObserver(resize);
    disposers.push(() => resizeObserver.disconnect());
    resizeObserver.observe(stage);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        state.visible = entry.isIntersecting;
        pause();
        schedule();
      },
      { rootMargin: "180px" }
    );
    disposers.push(() => visibilityObserver.disconnect());
    visibilityObserver.observe(stage);

    resize();
    updateRotationMetadata();
    stage.dataset.geometry = `icosahedron-${detail}`;
    stage.dataset.vertexCount = String(outerGeometry.getAttribute("position").count);
    stage.dataset.dragState = "resting";

    try {
      renderer.compile(scene, camera);
      renderer.render(scene, camera);
    } catch (error) {
      console.warn("The physical glass material could not be rendered; showing its poster instead.", error);
      dispose();
      return createFallbackController(stage, "webgl-render-failed-poster");
    }

    schedule();

    controller = {
      setScroll(progress) {
        state.scroll = clamp(progress, 0, 1);
      },
      rotateBy(yawDegrees = 0, pitchDegrees = 0) {
        state.lastInteraction = performance.now();
        rotateRadians(
          THREE.MathUtils.degToRad(yawDegrees),
          THREE.MathUtils.degToRad(pitchDegrees)
        );
      },
      rotateTo(yawDegrees = 0, pitchDegrees = 0, rollDegrees = 0) {
        EULER.set(
          THREE.MathUtils.degToRad(pitchDegrees),
          THREE.MathUtils.degToRad(yawDegrees),
          THREE.MathUtils.degToRad(rollDegrees),
          "YXZ"
        );
        sculptureGroup.quaternion.setFromEuler(EULER);
        state.velocityYaw = 0;
        state.velocityPitch = 0;
        state.lastInteraction = performance.now();
        updateRotationMetadata();
      },
      getState() {
        return {
          renderMode: stage.dataset.renderMode,
          geometry: stage.dataset.geometry,
          vertexCount: Number(stage.dataset.vertexCount),
          rotation: {
            x: Number(stage.dataset.rotationX),
            y: Number(stage.dataset.rotationY),
            z: Number(stage.dataset.rotationZ)
          },
          dragging: state.dragging,
          isThreeDimensional: !disposed
        };
      },
      destroy() {
        dispose();
        createFallbackController(stage, "stopped-poster");
      }
    };

    Object.defineProperty(window, "__NONLINEAR_SPHERE__", {
      value: controller,
      configurable: true
    });

    return controller;
  } catch (error) {
    dispose();
    console.warn("The 3D scene could not initialize; retaining the poster.", error);
    return createFallbackController(stage, "webgl-render-failed-poster");
  }
};
