import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';

import { initJanus } from './modules/janusClient.js';
import { initPingPong } from './modules/pingpong.js';
import { connectAntWebSocket } from './modules/websocket.js';


//— Janus streaming parameters
const STREAM_ID    = 42;
const JANUS_SERVER = `${location.protocol}//${location.host}/janus`;

//— DOM references
const startBtn = document.getElementById('startBtn');
const videoEl  = document.getElementById('remoteVideo');
const heatbox  = document.getElementById('heatToggle');

//— Three.js scenes, camera, renderer
const sceneVideo = new THREE.Scene();
const sceneTrail = new THREE.Scene();
const camera     = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
// Get the existing canvas element
const canvasEl = document.getElementById('threeCanvas');
const renderer   = new THREE.WebGLRenderer({ antialias: true, canvas: canvasEl }); // Pass the canvas element here
renderer.setPixelRatio(devicePixelRatio);

let plugin;
let videoTexture, videoMesh;
let rtA, rtB, maskTex;
let width, height; // Declare width and height here
let simMat, trailMat, quad;
let ping = true;

//— start Janus on button click
startBtn.addEventListener('click', () => {
    startBtn.style.display = 'none';
    videoEl.style.display = 'block'; // Make video element visible
    initJanus(JANUS_SERVER, STREAM_ID, {
      onAttach:      handleAttach,
      onMessage:     handleMessage,
      onRemoteTrack: handleRemoteTrack
    });
  });


function handleAttach(handle) {
  plugin = handle;
  plugin.send({ message: { request: 'watch', id: STREAM_ID } });
}

function handleMessage(msg, jsep) {
  if (!jsep) return;
  plugin.createAnswer({
    jsep,
    media: { audioSend: false, videoSend: false },
    success: answer => plugin.send({ message: { request: 'start' }, jsep: answer }),
    error: console.error
  });
}

function handleRemoteTrack(track, mid, on) {
  if (!on || track.kind !== 'video') return;
  const stream = new MediaStream([ track ]);
  videoEl.srcObject = stream;
  videoEl.play().catch(console.error);
  videoEl.addEventListener('playing', initThree, { once: true });
}

function initThree() {
  //— video background
  videoTexture = new THREE.VideoTexture(videoEl);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  const vidMat = new THREE.MeshBasicMaterial({ map: videoTexture });
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  videoMesh = new THREE.Mesh(quadGeo, vidMat);
  sceneVideo.add(videoMesh);

    const w = videoEl.videoWidth;
  const h = videoEl.videoHeight;

  // initialize ping–pong once
  const pingPongResources = initPingPong(renderer, sceneTrail, heatbox, w, h);
  rtA = pingPongResources.rtA;
  rtB = pingPongResources.rtB;
  maskTex = pingPongResources.maskTex;
  simMat = pingPongResources.simMat;
  trailMat = pingPongResources.trailMat;
  quad = pingPongResources.quad;
  width = pingPongResources.width;
  height = pingPongResources.height;

  setupWebSocket();
  onResize();
  window.addEventListener('resize', onResize, { passive: true });
  animate();
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);

  // Update shader resolution uniform
  if (simMat) simMat.uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  if (trailMat) trailMat.uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());

  if (!videoMesh || !quad) return;
  const va = videoEl.videoWidth / videoEl.videoHeight;
  const sa = w / h;
  let sx = 1, sy = 1;
  if (sa > va) sx = va / sa;
  else sy = sa / va;
  videoMesh.scale.set(sx, sy, 1);
  quad.scale.set(sx, -sy, 1); // Flip Y-scale for the quad
}

function animate() {
  requestAnimationFrame(animate);
  if (videoTexture) videoTexture.needsUpdate = true;

  renderer.autoClear = false;
  renderer.clear();
  renderer.render(sceneVideo, camera);

  if (quad) {
    //— simulation pass
    quad.material = simMat;
    simMat.uniforms.uPrev.value = ping ? rtA.texture : rtB.texture;
    renderer.setRenderTarget(ping ? rtB : rtA);
    renderer.render(sceneTrail, camera); // Renders simulation to render target
    renderer.setRenderTarget(null);

    //— draw trails overlay
    trailMat.uniforms.uState.value = ping ? rtB.texture : rtA.texture; // Uses the *output* of the simulation
    quad.material = trailMat;

    ping = !ping; // Flips the ping-pong state

    renderer.render(sceneTrail, camera); // Render the trail overlay to the screen
  }
}

function setupWebSocket() {
    connectAntWebSocket(({ objects }) => {
      //— clear mask and mark ant pixels
      maskTex.image.data.fill(0);
      for (const { x, y } of objects) {
        maskTex.image.data[y * width + x] = 1.0;
      }
      maskTex.needsUpdate = true;
      // Simulation and rendering now happen in the animate loop
    });
  }
