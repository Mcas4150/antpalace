import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';

/**
 * Initializes ping–pong render targets, mask, and shaders.
 * @param {WebGLRenderer} renderer
 * @param {THREE.Scene} sceneTrail
 * @param {HTMLElement} heatbox
 * @param {number} width
 * @param {number} height
 * @returns {object} ping–pong resources
 */
export function initPingPong(renderer, sceneTrail, heatbox, width, height) {
  const pr = renderer.getPixelRatio();

  // create render targets
  const opts = {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format:    THREE.RedFormat,
    type:      THREE.FloatType
  };
  const rtA = new THREE.WebGLRenderTarget(width * pr, height * pr, opts);
  const rtB = rtA.clone();

  // mask texture
  const maskTex = new THREE.DataTexture(
    new Float32Array(width * height * pr * pr),
    width * pr, height * pr,
    THREE.RedFormat, THREE.FloatType
  );
  maskTex.needsUpdate = true;

  // Viridis colormap → texture
  const cmap = document.createElement('canvas');
  cmap.width = 256; cmap.height = 1;
  const ctx = cmap.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0,  '#440154');
  grad.addColorStop(0.25, '#21918c');
  grad.addColorStop(0.5,  '#5ece4f');
  grad.addColorStop(0.75, '#fde725');
  grad.addColorStop(1.0,  '#fde725');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  const colMap = new THREE.CanvasTexture(cmap);
  colMap.minFilter = colMap.magFilter = THREE.LinearFilter;

  // simulation shader
  const simFrag = `
    precision highp float;
    uniform sampler2D uPrev, uMask;
    uniform vec2 uRes;
    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      float a = texture(uPrev, uv).r;
      float m = texture(uMask, uv).r;
      gl_FragColor = vec4(max(a, m), 0.0, 0.0, 1.0);
    }
  `;
  const simMat = new THREE.ShaderMaterial({
    fragmentShader: simFrag,
    uniforms: {
      uPrev: { value: rtA.texture },
      uMask: { value: maskTex },
      uRes:  { value: new THREE.Vector2(width * pr, height * pr) }
    }
  });

  // trail shader
  const trailFrag = `
    precision highp float;
    uniform sampler2D uState, uCM;
    uniform vec2 uRes;
    uniform bool uHeat;
    float dens(vec2 uv) {
      vec2 o = 1.0 / uRes;
      float s = 0.0;
      s += texture(uState, uv + vec2( o.x,  0.0)).r;
      s += texture(uState, uv + vec2(-o.x,  0.0)).r;
      s += texture(uState, uv + vec2( 0.0,   o.y)).r;
      s += texture(uState, uv + vec2( 0.0,  -o.y)).r;
      s += texture(uState, uv + vec2( o.x,  o.y)).r;
      s += texture(uState, uv + vec2(-o.x,  o.y)).r;
      s += texture(uState, uv + vec2( o.x, -o.y)).r;
      s += texture(uState, uv + vec2(-o.x, -o.y)).r;
      return clamp(s / 8.0, 0.0, 1.0);
    }
    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      float v = texture(uState, uv).r;
      if (uHeat) {
        float t = dens(uv);
        vec3 c = texture(uCM, vec2(t, 0.5)).rgb;
        gl_FragColor = vec4(c, v);
      } else {
        gl_FragColor = vec4(vec3(0.0), v);
      }
    }
  `;
  const trailMat = new THREE.ShaderMaterial({
    transparent:  true,
    depthWrite:   false,
    blending:     THREE.NormalBlending,
    fragmentShader: trailFrag,
    uniforms: {
      uState: { value: rtA.texture },
      uCM:    { value: colMap },
      uRes:   { value: new THREE.Vector2(width * pr, height * pr) },
      uHeat:  { value: false }
    }
  });

  // quad mesh
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMat);
  sceneTrail.add(quad);

  // clear initial
  renderer.setRenderTarget(rtA);
  renderer.clear();
  renderer.setRenderTarget(rtB); // Clear rtB as well
  renderer.clear();
  renderer.setRenderTarget(null);

  heatbox.addEventListener('change', e => {
    trailMat.uniforms.uHeat.value = e.target.checked;
  });

  return { rtA, rtB, maskTex, simMat, trailMat, quad, width, height };
}
