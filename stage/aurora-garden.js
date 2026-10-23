(() => {
  const canvas = document.querySelector("#aurora-stage");
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

  mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
  float hash21(vec2 p) { p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 19.19); return fract(p.x * p.y); }
  float cappedCylinder(vec3 p, float h, float r) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
  }
  float torus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
  float ellipsoid(vec3 p, vec3 r) { return (length(p / r) - 1.0) * min(min(r.x, r.y), r.z); }

  float flower(vec3 p, vec3 center, float scale) {
    vec3 q = p - center;
    float stem = cappedCylinder(q + vec3(0.0, 0.24 * scale, 0.0), 0.3 * scale, 0.024 * scale);
    float petals = 99.0;
    q.y -= 0.30 * scale;
    for (int i = 0; i < 7; i++) {
      float a = float(i) * 0.8975979 + u_time * 0.08;
      vec3 r = q;
      r.xz *= rot(a);
      r.yz *= rot(0.48);
      r.x -= 0.18 * scale;
      petals = min(petals, ellipsoid(r, vec3(0.12, 0.31, 0.065) * scale));
    }
    return min(stem, petals);
  }

  vec2 mapScene(vec3 p) {
    vec2 hit = vec2(p.y + 1.28, 0.0);
    vec3 q = p;
    q.y += 1.06;
    float dais = cappedCylinder(q, 0.16, 1.54);
    if (dais < hit.x) hit = vec2(dais, 1.0);
    vec3 portal = vec3(p.x, p.z + 0.24, p.y - 0.10);
    float arch = torus(portal, vec2(1.35, 0.045));
    if (arch < hit.x) hit = vec2(arch, 2.0);
    float f1 = flower(p, vec3(-1.25, -0.76, 0.18), 0.9);
    float f2 = flower(p, vec3(1.24, -0.80, 0.04), 0.82);
    float f3 = flower(p, vec3(-2.02, -0.96, -0.65), 0.68);
    float f4 = flower(p, vec3(2.04, -0.97, -0.58), 0.7);
    float bloom = min(min(f1, f2), min(f3, f4));
    if (bloom < hit.x) hit = vec2(bloom, 3.0);
    return hit;
  }

  vec3 normalAt(vec3 p) {
    vec2 e = vec2(0.0016, 0.0);
    float d = mapScene(p).x;
    return normalize(vec3(mapScene(p + e.xyy).x - d, mapScene(p + e.yxy).x - d, mapScene(p + e.yyx).x - d));
  }
  mat3 camera(vec3 ro, vec3 target) {
    vec3 f = normalize(target - ro);
    vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0)));
    return mat3(r, cross(r, f), -f);
  }
  float fireflies(vec2 uv) {
    vec2 grid = uv * vec2(66.0, 116.0);
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    float light = step(0.992, hash21(cell));
    float wobble = sin(u_time * (0.9 + hash21(cell) * 1.5) + hash21(cell) * 9.0) * 0.09;
    return light * smoothstep(0.048, 0.0, length(local + vec2(wobble, 0.0)));
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / u_resolution.y;
    vec3 ro = vec3(u_pointer.x * 0.22, -0.06 + u_pointer.y * 0.1, 4.7);
    vec3 target = vec3(u_pointer.x * 0.06, -0.34, -0.10);
    vec3 rd = camera(ro, target) * normalize(vec3(uv, -1.78));
    float travel = 0.0;
    float material = 0.0;
    vec3 p = ro;
    for (int i = 0; i < 88; i++) {
      p = ro + rd * travel;
      vec2 hit = mapScene(p);
      material = hit.y;
      if (hit.x < 0.0015 || travel > 14.0) break;
      travel += hit.x * 0.73;
    }

    float auroraA = exp(-abs(uv.x - 0.24 * sin(uv.y * 3.6 + u_time * 0.24)) * 7.0);
    float auroraB = exp(-abs(uv.x + 0.34 * sin(uv.y * 4.1 - u_time * 0.18)) * 9.0);
    float skyFade = smoothstep(-1.0, 0.65, uv.y);
    vec3 sky = vec3(0.002, 0.018, 0.054);
    sky += auroraA * skyFade * vec3(0.02, 0.54, 0.47);
    sky += auroraB * skyFade * vec3(0.06, 0.20, 0.60);
    float sparks = fireflies(uv + vec2(0.0, u_time * 0.006));
    sky += sparks * vec3(1.0, 0.72, 0.28);
    vec3 color = sky;

    if (travel < 14.0) {
      vec3 n = normalAt(p);
      vec3 lightDir = normalize(vec3(-0.42, 0.82, 0.55));
      float diffuse = max(dot(n, lightDir), 0.0);
      float rim = pow(1.0 - max(dot(n, -rd), 0.0), 3.2);
      vec3 surface = material < 0.5 ? vec3(0.008, 0.028, 0.05) : vec3(0.02, 0.12, 0.16);
      if (material > 1.5 && material < 2.5) surface = vec3(0.24, 0.88, 0.78);
      if (material > 2.5) surface = vec3(0.38, 0.86, 0.88);
      color = surface * (0.15 + 0.72 * diffuse) + rim * vec3(0.28, 0.96, 0.84) * 0.72;
      if (material > 1.5) color += surface * (0.28 + 0.16 * sin(u_time * 2.4));
      if (material < 0.5) color += sky * 0.45;
    }
    float reflection = exp(-abs(uv.y + 0.60) * 11.0) * (auroraA + auroraB) * 0.22;
    color += reflection * vec3(0.04, 0.60, 0.58);
    color *= smoothstep(1.38, 0.34, length(uv * vec2(0.78, 1.0)));
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

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
    return shader;
  }
  function initialise() {
    gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "high-performance" });
    if (!gl) return false;
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return false;
    program = gl.createProgram();
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
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
    canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height);
  }
  function render(now) {
    if (!active) return;
    resize(); gl.useProgram(program);
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
    event.preventDefault(); active = false; failed = true; cancelAnimationFrame(rafId); failureHandler?.();
  });
  addEventListener("pointermove", onPointer, { passive: true });
  addEventListener("resize", () => { if (active) resize(); });

  window.AuroraGarden = {
    start(onFailure) {
      failureHandler = onFailure;
      if (failed) return false;
      if (!program && !initialise()) { failed = true; return false; }
      active = true; cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render); return true;
    },
    stop() { active = false; cancelAnimationFrame(rafId); }
  };
})();
