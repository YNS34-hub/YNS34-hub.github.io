const VERTEX_SHADER = `
attribute vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D uPoster;
uniform vec2 uResolution;
uniform vec2 uPosterResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform float uPointerActive;
uniform float uScroll;

#define PI 3.14159265359

vec2 containedPosterUv(vec2 screenUv, out float inside) {
  float stageAspect = uResolution.x / max(uResolution.y, 1.0);
  float posterAspect = uPosterResolution.x / max(uPosterResolution.y, 1.0);
  vec2 uv = screenUv;
  inside = 1.0;

  if (stageAspect < posterAspect) {
    float occupiedHeight = stageAspect / posterAspect;
    uv.y = screenUv.y / occupiedHeight;
    inside = step(screenUv.y, occupiedHeight);
  } else {
    float occupiedWidth = posterAspect / stageAspect;
    float left = (1.0 - occupiedWidth) * 0.5;
    uv.x = (screenUv.x - left) / occupiedWidth;
    inside = step(left, screenUv.x) * step(screenUv.x, left + occupiedWidth);
  }

  return uv;
}

void main() {
  vec2 screenUv = vec2(
    gl_FragCoord.x / uResolution.x,
    1.0 - gl_FragCoord.y / uResolution.y
  );

  float inside;
  vec2 posterUv = containedPosterUv(screenUv, inside);
  if (inside < 0.5) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 sphereCenter = vec2(0.493, 0.515);
  vec2 sphereShape = (posterUv - sphereCenter) / vec2(0.405, 0.49);
  float sphereDistance = length(sphereShape);
  float sphereMask = 1.0 - smoothstep(0.78, 1.08, sphereDistance);

  vec2 radial = normalize(sphereShape + vec2(0.0001));
  float fluidPhase = sin(
    sphereShape.x * 5.2 + sphereShape.y * 4.1 + uTime * 0.72
  );
  float breath = sin(uTime * 0.53) * 0.00125;
  posterUv += radial * (breath + fluidPhase * 0.00075) * sphereMask;

  vec2 scrollFold = vec2(
    sin((sphereShape.y + 0.25) * PI * 2.2),
    cos((sphereShape.x - 0.12) * PI * 1.8)
  );
  posterUv += scrollFold * uScroll * 0.0028 * sphereMask;

  vec2 pointerUv = uPointer * 0.5 + 0.5;
  float pointerInside;
  vec2 pointerPosterUv = containedPosterUv(pointerUv, pointerInside);
  float pointerDistance = distance(screenUv, pointerUv);
  float pointerField = exp(-pointerDistance * pointerDistance * 82.0) * uPointerActive;
  vec2 pointerDirection = (screenUv - pointerUv) / max(pointerDistance, 0.004);
  float ripple = 0.72 + 0.28 * sin(pointerDistance * 92.0 - uTime * 3.2);
  vec2 pointerOffset = pointerDirection * pointerField * ripple * 0.0105 * sphereMask;
  posterUv += pointerOffset;

  posterUv = clamp(posterUv, vec2(0.001), vec2(0.999));
  vec4 base = texture2D(uPoster, posterUv);

  vec2 spectrumOffset = pointerDirection * pointerField * 0.0032 * sphereMask;
  vec3 color = base.rgb;
  color.r = texture2D(uPoster, clamp(posterUv + spectrumOffset, 0.001, 0.999)).r;
  color.b = texture2D(uPoster, clamp(posterUv - spectrumOffset, 0.001, 0.999)).b;

  vec2 lightDirection = normalize(
    (pointerPosterUv - sphereCenter) / vec2(0.405, 0.49) + vec2(0.0001)
  );
  float rimZone = smoothstep(0.34, 0.88, sphereDistance) * sphereMask;
  float litRim = pow(max(dot(radial, lightDirection), 0.0), 5.0) * rimZone;
  float shadedRim = pow(max(dot(radial, -lightDirection), 0.0), 4.0) * rimZone;
  color += vec3(0.73, 0.84, 1.0) * litRim * 0.075 * uPointerActive * pointerInside;
  color *= 1.0 - shadedRim * 0.028 * uPointerActive * pointerInside;

  float movingSheen = pow(
    max(0.0, 1.0 - abs(sphereShape.x * 0.8 + sphereShape.y * 0.58 - sin(uTime * 0.24) * 0.34)),
    18.0
  ) * sphereMask;
  color += vec3(0.84, 0.92, 1.0) * movingSheen * 0.035;

  float pointerRing = 1.0 - smoothstep(
    0.006,
    0.012,
    abs(pointerDistance - 0.047)
  );
  color = mix(color, vec3(0.08, 0.33, 0.92), pointerRing * 0.5 * uPointerActive);

  gl_FragColor = vec4(color, base.a);
}
`;

const compileShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || "Unable to compile the sphere shader.");
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
    throw new Error(message || "Unable to link the sphere shader.");
  }
  return program;
};

const setStageMotion = (stage, pointer, scroll, reducedMotion) => {
  const still = reducedMotion.matches;
  const x = still ? 0 : pointer.x;
  const y = still ? 0 : pointer.y;
  const progress = still ? 0 : scroll;

  stage.style.setProperty("--sphere-tilt-x", `${(-y * 3.6).toFixed(3)}deg`);
  stage.style.setProperty("--sphere-tilt-y", `${(x * 4.8).toFixed(3)}deg`);
  stage.style.setProperty("--sphere-shift-x", `${(x * 9.5).toFixed(3)}px`);
  stage.style.setProperty("--sphere-shift-y", `${(y * 7 - progress * 8).toFixed(3)}px`);
  stage.style.setProperty(
    "--sphere-scale",
    (1.006 + pointer.active * 0.01 - progress * 0.014).toFixed(4)
  );
  stage.style.setProperty("--light-x", `${(50 + x * 13).toFixed(2)}%`);
  stage.style.setProperty("--light-y", `${(43 + y * 10).toFixed(2)}%`);
};

export const initNonlinearSphere = (canvas, stage, reducedMotionQuery) => {
  if (!canvas || !stage) return null;

  const poster = stage.querySelector(".sphere-poster");
  if (!poster) return null;

  const finePointer = window.matchMedia("(pointer: fine)");
  const smallScreen = window.matchMedia("(max-width: 760px)");
  const state = {
    pointer: { x: 0, y: 0, active: 0 },
    pointerTarget: { x: 0, y: 0 },
    pointerActive: 0,
    pointerActiveTarget: 0,
    scroll: 0,
    visible: true,
    running: true,
    frame: 0,
    lastFrame: 0,
    start: performance.now(),
    textureReady: false,
    canvasReady: false
  };

  let gl = null;
  let program = null;
  let buffer = null;
  let texture = null;
  let uniforms = null;

  try {
    gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false
    });

    if (gl) {
      program = createProgram(gl);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW
      );

      const position = gl.getAttribLocation(program, "aPosition");
      uniforms = {
        poster: gl.getUniformLocation(program, "uPoster"),
        resolution: gl.getUniformLocation(program, "uResolution"),
        posterResolution: gl.getUniformLocation(program, "uPosterResolution"),
        time: gl.getUniformLocation(program, "uTime"),
        pointer: gl.getUniformLocation(program, "uPointer"),
        pointerActive: gl.getUniformLocation(program, "uPointerActive"),
        scroll: gl.getUniformLocation(program, "uScroll")
      };

      gl.useProgram(program);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.clearColor(0, 0, 0, 0);

      texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(uniforms.poster, 0);
    }
  } catch (error) {
    console.warn("Interactive sphere enhancement is unavailable.", error);
    gl = null;
  }

  const uploadPoster = () => {
    if (!gl || !texture || !poster.naturalWidth || !poster.naturalHeight) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, poster);
    state.textureReady = true;
  };

  if (poster.complete && poster.naturalWidth) uploadPoster();
  else poster.addEventListener("load", uploadPoster, { once: true });

  if (!gl) stage.classList.add("is-fallback");

  const resize = () => {
    if (!gl) return;
    const bounds = canvas.getBoundingClientRect();
    const pixelBudget = smallScreen.matches ? 360000 : 820000;
    let dpr = Math.min(window.devicePixelRatio || 1, smallScreen.matches ? 1.1 : 1.35);
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

    const smoothing = mobile ? 0.105 : 0.082;
    state.pointer.x += (state.pointerTarget.x - state.pointer.x) * smoothing;
    state.pointer.y += (state.pointerTarget.y - state.pointer.y) * smoothing;
    state.pointerActive += (state.pointerActiveTarget - state.pointerActive) * 0.075;
    state.pointer.active = state.pointerActive;
    setStageMotion(stage, state.pointer, state.scroll, reducedMotionQuery);

    if (!gl || !program || !uniforms || !state.textureReady) return;

    resize();
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const elapsed = reducedMotionQuery.matches ? 0 : (now - state.start) / 1000;
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.posterResolution, poster.naturalWidth, poster.naturalHeight);
    gl.uniform1f(uniforms.time, elapsed);
    gl.uniform2f(uniforms.pointer, state.pointer.x, state.pointer.y);
    gl.uniform1f(
      uniforms.pointerActive,
      reducedMotionQuery.matches ? 0 : state.pointerActive
    );
    gl.uniform1f(uniforms.scroll, reducedMotionQuery.matches ? 0 : state.scroll);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!state.canvasReady) {
      state.canvasReady = true;
      stage.classList.add("webgl-ready");
    }
  };

  const onPointerMove = (event) => {
    if (!finePointer.matches || reducedMotionQuery.matches) return;
    const bounds = canvas.getBoundingClientRect();
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
    stage.classList.add("is-fallback");
    gl = null;
  };
  canvas.addEventListener("webglcontextlost", onContextLost, false);

  setStageMotion(stage, state.pointer, state.scroll, reducedMotionQuery);
  render();

  return {
    setScroll(progress) {
      state.scroll = Math.max(0, Math.min(progress, 1));
    },
    destroy() {
      state.running = false;
      cancelAnimationFrame(state.frame);
      visibilityObserver.disconnect();
      poster.removeEventListener("load", uploadPoster);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      if (gl && buffer) gl.deleteBuffer(buffer);
      if (gl && texture) gl.deleteTexture(texture);
      if (gl && program) gl.deleteProgram(program);
    }
  };
};
