(() => {
  const canvas = document.querySelector("#signal-stage");
  if (!canvas) return;

  const vertexSource = `#version 300 es
  in vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

  const fragmentSource = `#version 300 es
  precision highp float;
  out vec4 outColor;
  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform float u_time;

  mat2 rotate2(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
  float cappedCylinder(vec3 p, float h, float r) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
  }
  float torus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }

  vec2 mapScene(vec3 p) {
    float ground = p.y + 1.34;
    vec3 q = p;
    q.y += 0.78;
    float base = cappedCylinder(q, 0.16, 1.08);
    q = p - vec3(0.0, -0.34, 0.0);
    float mast = cappedCylinder(q, 0.72, 0.105);
    q = p - vec3(0.0, 0.47, 0.0);
    float core = length(q) - 0.39;
    q.xz *= rotate2(u_time * 0.36);
    float ring = torus(q, vec2(0.72, 0.032));
    q = p - vec3(0.0, 0.47, 0.0);
    q.yz *= rotate2(-u_time * 0.28);
    float orbit = torus(q, vec2(0.56, 0.018));
    vec2 hit = vec2(ground, 0.0);
    if (base < hit.x) hit = vec2(base, 1.0);
    if (mast < hit.x) hit = vec2(mast, 1.0);
    if (core < hit.x) hit = vec2(core, 2.0);
    if (ring < hit.x) hit = vec2(ring, 3.0);
    if (orbit < hit.x) hit = vec2(orbit, 3.0);
    return hit;
  }

  vec3 normalAt(vec3 p) {
    vec2 e = vec2(0.0015, 0.0);
    float d = mapScene(p).x;
    return normalize(vec3(mapScene(p + e.xyy).x - d, mapScene(p + e.yxy).x - d, mapScene(p + e.yyx).x - d));
  }
  mat3 lookAt(vec3 ro, vec3 target) {
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    return mat3(right, cross(right, forward), -forward);
  }

  float signalDust(vec2 uv) {
    vec2 grid = uv * vec2(80.0, 132.0);
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    float spark = step(0.987, hash21(cell));
    float drift = sin(u_time * (0.7 + hash21(cell) * 1.7) + hash21(cell) * 6.283) * 0.08;
    return spark * smoothstep(0.055, 0.0, length(local + vec2(drift, 0.0)));
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
    float aspect = u_resolution.x / u_resolution.y;
    vec3 ro = vec3(u_pointer.x * 0.28, -0.02 + u_pointer.y * 0.12, 4.65);
    vec3 target = vec3(u_pointer.x * 0.08, -0.28, 0.0);
    vec3 rd = lookAt(ro, target) * normalize(vec3(uv, -1.72));
    float travel = 0.0;
    float material = 0.0;
    vec3 p = ro;
    for (int i = 0; i < 92; i++) {
      p = ro + rd * travel;
      vec2 hit = mapScene(p);
      material = hit.y;
      if (hit.x < 0.0014 || travel > 14.0) break;
      travel += hit.x * 0.72;
    }

    vec3 sky = vec3(0.008, 0.004, 0.024);
    sky += vec3(0.11, 0.018, 0.002) * exp(-3.1 * length(uv - vec2(0.0, 0.2)));
    float dust = signalDust(uv + vec2(u_time * 0.006, 0.0));
    sky += dust * vec3(1.0, 0.20, 0.035);
    vec3 color = sky;

    if (travel < 14.0) {
      vec3 n = normalAt(p);
      vec3 lightDir = normalize(vec3(-0.45, 0.8, 0.7));
      float diffuse = max(dot(n, lightDir), 0.0);
      float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
      vec3 surface = material < 0.5 ? vec3(0.015, 0.005, 0.028) : vec3(0.14, 0.018, 0.012);
      if (material > 1.5 && material < 2.5) surface = vec3(1.0, 0.10, 0.012);
      if (material > 2.5) surface = vec3(1.0, 0.35, 0.025);
      color = surface * (0.16 + diffuse * 0.7) + rim * vec3(1.0, 0.09, 0.01) * 0.8;
      if (material > 1.5) color += surface * (0.45 + 0.35 * sin(u_time * 3.0));
    }

    float beam = exp(-abs(uv.x - u_pointer.x * 0.035) * 17.0) * smoothstep(-0.95, 0.22, uv.y);
    color += beam * vec3(0.32, 0.025, 0.005) * (0.42 + 0.25 * sin(u_time * 4.0));
    float vignette = smoothstep(1.32, 0.34, length(uv * vec2(0.76, 1.0)));
    color *= vignette;
    outColor = vec4(color, 1.0);
  }`;

  let gl;
  let program;
  let rafId = 0;
  let active = false;
  let failed = false;
  let failureHandler = null;
  let pointer = { x: 0, y: 0 };
  const maxPixels = 5_000_000;

  function shader(type, source) {
    const compiled = gl.createShader(type);
    gl.shaderSource(compiled, source);
    gl.compileShader(compiled);
    if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) {
      gl.deleteShader(compiled);
      return null;
    }
    return compiled;
  }

  function initialise() {
    gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "high-performance" });
    if (!gl) return false;
    const vertex = shader(gl.VERTEX_SHADER, vertexSource);
    const fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return false;
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    return true;
  }

  function resize() {
    const cssWidth = Math.max(1, canvas.clientWidth || innerWidth);
    const cssHeight = Math.max(1, canvas.clientHeight || innerHeight);
    let scale = Math.min(devicePixelRatio || 1, 1.5);
    scale = Math.min(scale, Math.sqrt(maxPixels / (cssWidth * cssHeight)));
    const width = Math.max(1, Math.round(cssWidth * scale));
    const height = Math.max(1, Math.round(cssHeight * scale));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }

  function render(now) {
    if (!active) return;
    resize();
    gl.useProgram(program);
    gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), canvas.width, canvas.height);
    gl.uniform2f(gl.getUniformLocation(program, "u_pointer"), pointer.x, pointer.y);
    gl.uniform1f(gl.getUniformLocation(program, "u_time"), now * 0.001);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    rafId = requestAnimationFrame(render);
  }

  function onPointer(event) {
    if (!active) return;
    pointer.x = Math.max(-1, Math.min(1, event.clientX / innerWidth * 2 - 1));
    pointer.y = Math.max(-1, Math.min(1, 1 - event.clientY / innerHeight * 2));
  }

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    active = false;
    failed = true;
    cancelAnimationFrame(rafId);
    failureHandler?.();
  });
  addEventListener("pointermove", onPointer, { passive: true });
  addEventListener("resize", () => { if (active) resize(); });

  window.HauntedSignal = {
    start(onFailure) {
      failureHandler = onFailure;
      if (failed) return false;
      if (!program && !initialise()) {
        failed = true;
        return false;
      }
      active = true;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(render);
      return true;
    },
    stop() {
      active = false;
      cancelAnimationFrame(rafId);
    }
  };
})();
