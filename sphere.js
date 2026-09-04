const VERTEX_SHADER = `
attribute vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform float uPointerActive;
uniform float uScroll;
uniform float uSteps;

#define PI 3.14159265359

mat2 rotate2d(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

vec3 rotateObject(vec3 p) {
  p.xz *= rotate2d(-0.34 - uTime * 0.085 - uPointer.x * 0.12);
  p.yz *= rotate2d(0.18 + sin(uTime * 0.14) * 0.07 + uPointer.y * 0.1);
  p.xy *= rotate2d(-0.08 + uScroll * 0.12);
  return p;
}

float surfaceRadius(vec3 n) {
  float broad = sin(n.x * 5.1 + n.y * 3.0 + n.z * 2.2 + uTime * 0.31) * 0.045;
  float folded = sin(n.z * 7.0 - n.y * 5.2 + n.x * 2.6 - uTime * 0.21) * 0.024;
  float vertical = cos(n.y * 8.0 + n.x * 2.5) * 0.018;
  float breath = sin(uTime * 0.58) * 0.012;

  vec3 pointerDirection = normalize(vec3(uPointer.x * 0.74, -uPointer.y * 0.68, 0.72));
  float pointerLobe = pow(max(dot(n, pointerDirection), 0.0), 7.0) * 0.11 * uPointerActive;
  float oppositeFold = pow(max(dot(n, -pointerDirection), 0.0), 5.0) * -0.028 * uPointerActive;
  float scrollFold = sin(n.y * 4.0 - n.x * 3.5 + n.z * 2.0) * uScroll * 0.025;

  return 0.84 + broad + folded + vertical + breath + pointerLobe + oppositeFold + scrollFold;
}

float sceneDistance(vec3 point) {
  vec3 p = rotateObject(point);
  float radius = length(p);
  vec3 direction = p / max(radius, 0.0001);
  return radius - surfaceRadius(direction);
}

vec3 estimateNormal(vec3 p) {
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(
    sceneDistance(p + e.xyy) - sceneDistance(p - e.xyy),
    sceneDistance(p + e.yxy) - sceneDistance(p - e.yxy),
    sceneDistance(p + e.yyx) - sceneDistance(p - e.yyx)
  ));
}

float softShadow(vec3 ro, vec3 rd) {
  float result = 1.0;
  float distanceAlongRay = 0.04;
  for (int i = 0; i < 18; i++) {
    vec3 p = ro + rd * distanceAlongRay;
    float h = sceneDistance(p);
    result = min(result, 14.0 * h / distanceAlongRay);
    distanceAlongRay += clamp(h, 0.025, 0.14);
    if (h < 0.001 || distanceAlongRay > 3.3) break;
  }
  return clamp(result, 0.0, 1.0);
}

vec3 paper(vec2 uv) {
  float vignette = smoothstep(1.45, 0.1, length(uv * vec2(0.8, 1.0)));
  vec3 warm = vec3(0.953, 0.946, 0.918);
  vec3 cool = vec3(0.918, 0.936, 0.944);
  return mix(warm, cool, 0.12 + vignette * 0.1);
}

float ring(vec2 p, vec2 center, vec2 scale, float radius, float width) {
  vec2 q = (p - center) * scale;
  return 1.0 - smoothstep(width, width + 0.005, abs(length(q) - radius));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (2.0 * frag - uResolution.xy) / min(uResolution.x, uResolution.y);
  uv.x *= 0.96;

  vec3 color = paper(uv);

  float orbitA = ring(uv, vec2(0.03, -0.025), vec2(0.58, 1.0), 0.93, 0.0022);
  float orbitB = ring(uv, vec2(-0.05, 0.025), vec2(1.0, 0.64), 0.92, 0.0018);
  color = mix(color, vec3(0.27, 0.30, 0.31), (orbitA * 0.14 + orbitB * 0.11));

  float groundShadow = exp(-pow(length((uv - vec2(0.08, -0.78)) * vec2(1.2, 4.3)), 2.0) * 3.2);
  color *= 1.0 - groundShadow * 0.105;

  vec3 rayOrigin = vec3(0.0, 0.02, 3.05);
  vec3 rayDirection = normalize(vec3(uv * 0.88, -2.45));
  float travel = 0.0;
  float distanceToSurface = 0.0;
  bool hit = false;

  for (int i = 0; i < 80; i++) {
    if (float(i) >= uSteps) break;
    vec3 point = rayOrigin + rayDirection * travel;
    distanceToSurface = sceneDistance(point);
    if (distanceToSurface < 0.0014) {
      hit = true;
      break;
    }
    travel += distanceToSurface * 0.69;
    if (travel > 5.1) break;
  }

  if (hit) {
    vec3 point = rayOrigin + rayDirection * travel;
    vec3 normal = estimateNormal(point);
    vec3 view = normalize(-rayDirection);
    vec3 lightDirection = normalize(vec3(-0.58, 0.8, 0.68));
    vec3 secondLight = normalize(vec3(0.82, -0.18, 0.48));

    float diffuse = max(dot(normal, lightDirection), 0.0);
    float coolDiffuse = max(dot(normal, secondLight), 0.0);
    float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 2.35);
    float sharpSpecular = pow(max(dot(reflect(-lightDirection, normal), view), 0.0), 78.0);
    float softSpecular = pow(max(dot(reflect(-secondLight, normal), view), 0.0), 19.0);
    float internalBand = 0.5 + 0.5 * sin(
      normal.x * 13.0 + normal.y * 7.0 + normal.z * 9.0 + uTime * 0.36
    );
    float depth = clamp(1.0 - travel / 4.0, 0.0, 1.0);

    vec3 glassBase = mix(vec3(0.72, 0.78, 0.79), vec3(0.10, 0.31, 0.52), fresnel * 0.68);
    glassBase = mix(glassBase, vec3(0.91, 0.94, 0.91), diffuse * 0.38);
    glassBase = mix(glassBase, vec3(0.09, 0.46, 0.68), coolDiffuse * 0.22);
    glassBase += vec3(0.12, 0.18, 0.22) * internalBand * 0.09;

    float cyanEdge = pow(fresnel, 1.35) * (0.42 + internalBand * 0.2);
    float amberEdge = pow(1.0 - max(dot(normal, view), 0.0), 5.0) * max(-normal.x, 0.0);
    vec3 spectral = vec3(0.07, 0.43, 0.7) * cyanEdge + vec3(0.55, 0.24, 0.09) * amberEdge * 0.32;

    float shadow = softShadow(point + normal * 0.015, lightDirection);
    glassBase *= 0.87 + shadow * 0.13;
    glassBase += vec3(0.92, 0.97, 1.0) * sharpSpecular * 0.78;
    glassBase += vec3(0.24, 0.48, 0.68) * softSpecular * 0.34;
    glassBase += spectral;

    float rim = smoothstep(0.05, 0.78, fresnel);
    float transparency = 0.93 - rim * 0.05;
    color = mix(color, glassBase * (0.88 + depth * 0.12), transparency);

    float contour = smoothstep(0.49, 0.5, 0.5 + 0.5 * sin((normal.y + normal.x * 0.23) * 28.0));
    color += vec3(0.08, 0.19, 0.29) * contour * fresnel * 0.055;
  }

  if (uPointerActive > 0.01) {
    vec2 pointerUv = vec2(uPointer.x, -uPointer.y) * 0.44;
    float pointerRing = 1.0 - smoothstep(0.005, 0.012, abs(length(uv - pointerUv) - 0.036));
    color = mix(color, vec3(0.11, 0.27, 0.41), pointerRing * 0.44 * uPointerActive);
  }

  float grain = fract(sin(dot(frag, vec2(12.9898, 78.233))) * 43758.5453);
  color += (grain - 0.5) * 0.008;
  color = pow(max(color, 0.0), vec3(0.96));
  gl_FragColor = vec4(color, 1.0);
}
`;

const compileShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || "Unable to compile WebGL shader.");
  }
  return shader;
};

const createProgram = (gl) => {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(message || "Unable to link WebGL program.");
  }
  return program;
};

export const initNonlinearSphere = (canvas, stage, reducedMotionQuery) => {
  if (!canvas || !stage) return null;

  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true
  });

  if (!gl) return null;

  let program;
  try {
    program = createProgram(gl);
  } catch (error) {
    console.warn("Interactive level-set surface is unavailable.", error);
    return null;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );

  const position = gl.getAttribLocation(program, "aPosition");
  const uniforms = {
    resolution: gl.getUniformLocation(program, "uResolution"),
    time: gl.getUniformLocation(program, "uTime"),
    pointer: gl.getUniformLocation(program, "uPointer"),
    pointerActive: gl.getUniformLocation(program, "uPointerActive"),
    scroll: gl.getUniformLocation(program, "uScroll"),
    steps: gl.getUniformLocation(program, "uSteps")
  };

  gl.useProgram(program);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const finePointer = window.matchMedia("(pointer: fine)");
  const smallScreen = window.matchMedia("(max-width: 760px)");
  const state = {
    pointer: { x: 0, y: 0 },
    pointerTarget: { x: 0, y: 0 },
    pointerActive: 0,
    pointerActiveTarget: 0,
    scroll: 0,
    visible: true,
    running: true,
    frame: 0,
    lastFrame: 0,
    start: performance.now(),
    ready: false
  };

  const resize = () => {
    const bounds = stage.getBoundingClientRect();
    const pixelBudget = smallScreen.matches ? 420000 : 920000;
    let dpr = Math.min(window.devicePixelRatio || 1, smallScreen.matches ? 1.15 : 1.45);
    const requestedPixels = bounds.width * bounds.height * dpr * dpr;
    if (requestedPixels > pixelBudget) dpr *= Math.sqrt(pixelBudget / requestedPixels);
    const width = Math.max(1, Math.round(bounds.width * dpr));
    const height = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };

  const render = (now = performance.now()) => {
    if (!state.running) return;
    state.frame = requestAnimationFrame(render);
    if (!state.visible || document.hidden) return;

    const mobile = smallScreen.matches;
    const minFrameTime = mobile ? 1000 / 30 : 1000 / 60;
    if (now - state.lastFrame < minFrameTime) return;
    state.lastFrame = now;

    resize();
    const smoothing = mobile ? 0.09 : 0.075;
    state.pointer.x += (state.pointerTarget.x - state.pointer.x) * smoothing;
    state.pointer.y += (state.pointerTarget.y - state.pointer.y) * smoothing;
    state.pointerActive += (state.pointerActiveTarget - state.pointerActive) * 0.08;

    const elapsed = reducedMotionQuery.matches ? 0.0 : (now - state.start) / 1000;
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, elapsed);
    gl.uniform2f(uniforms.pointer, state.pointer.x, state.pointer.y);
    gl.uniform1f(uniforms.pointerActive, reducedMotionQuery.matches ? 0 : state.pointerActive);
    gl.uniform1f(uniforms.scroll, state.scroll);
    gl.uniform1f(uniforms.steps, mobile ? 36 : 52);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!state.ready) {
      state.ready = true;
      stage.classList.add("webgl-ready");
    }
  };

  const onPointerMove = (event) => {
    if (!finePointer.matches || reducedMotionQuery.matches) return;
    const bounds = stage.getBoundingClientRect();
    state.pointerTarget.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    state.pointerTarget.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    state.pointerActiveTarget = 1;
  };

  const onPointerLeave = () => {
    state.pointerTarget.x = 0;
    state.pointerTarget.y = 0;
    state.pointerActiveTarget = 0;
  };

  stage.addEventListener("pointermove", onPointerMove, { passive: true });
  stage.addEventListener("pointerleave", onPointerLeave, { passive: true });

  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      state.visible = entry.isIntersecting;
    },
    { rootMargin: "160px" }
  );
  visibilityObserver.observe(stage);

  const onContextLost = (event) => {
    event.preventDefault();
    stage.classList.remove("webgl-ready");
    state.running = false;
    cancelAnimationFrame(state.frame);
  };
  canvas.addEventListener("webglcontextlost", onContextLost, false);

  render();

  return {
    setScroll(progress) {
      state.scroll = Math.max(0, Math.min(progress, 1));
    },
    destroy() {
      state.running = false;
      cancelAnimationFrame(state.frame);
      visibilityObserver.disconnect();
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    }
  };
};
