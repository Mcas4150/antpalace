import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';

// Import necessary modules
import { initJanus } from './modules/janusClient.js';
import { initPingPong } from './modules/pingpong.js';
import { connectAntWebSocket } from './modules/websocket.js';


//— Janus streaming parameters
// STREAM_ID: The ID of the video stream to watch via Janus.
// JANUS_SERVER: The URL of the Janus server.
const STREAM_ID    = 42;
const JANUS_SERVER = `${location.protocol}//${location.host}/janus`;

//— DOM references
// Get references to key HTML elements.
const startBtn = document.getElementById('startBtn'); // Button to start the experience.
const videoEl  = document.getElementById('remoteVideo'); // Video element to display the stream.
const heatbox  = document.getElementById('heatToggle'); // Checkbox to toggle heatmap visualization.

//— Three.js scenes, camera, renderer
// Set up Three.js for rendering.
const sceneVideo = new THREE.Scene(); // Scene for rendering the video background.
const sceneTrail = new THREE.Scene(); // Scene for rendering the ant trails simulation.
const camera     = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); // Orthographic camera for 2D rendering.
// Get the existing canvas element from index.html.
const canvasEl = document.getElementById('threeCanvas');
// Create a WebGL renderer, attaching it to the existing canvas.
const renderer   = new THREE.WebGLRenderer({ antialias: true, canvas: canvasEl }); // Pass the canvas element here
renderer.setPixelRatio(devicePixelRatio);

//— Global variables for Three.js and simulation state
let videoTexture, videoMesh; // Three.js texture and mesh for the video.
let rtA, rtB, maskTex; // Render targets (rtA, rtB) for ping-pong simulation and mask texture (maskTex) for ant positions.
let width, height; // Dimensions of the simulation/render targets.
let simMat, trailMat, quad; // Materials (simMat for simulation, trailMat for drawing) and a quad geometry for rendering.
let ping = true; // State variable for ping-pong rendering.

//— start Janus on button click
// Add an event listener to the start button.
startBtn.addEventListener('click', () => {
    // Hide the start button.
    startBtn.style.display = 'none';
    // Make the video element visible (helps with mobile autoplay).
    videoEl.style.display = 'block';
    // Initialize the Janus client.
    initJanus(JANUS_SERVER, STREAM_ID, {
      onRemoteTrack: handleRemoteTrack // Callback when a remote media track is received.
    });
  });

//— Janus Callbacks
// handleRemoteTrack: Called when a remote media track (audio or video) is received.
function handleRemoteTrack(track, mid, on) {
  // Only process if the track is active and it's a video track.
  if (!on || track.kind !== 'video') return;
  // Create a MediaStream from the received track.
  const stream = new MediaStream([ track ]);
  // Set the video element's source to the stream.
  videoEl.srcObject = stream;
  // Attempt to play the video. Catch and log any autoplay errors.
  videoEl.play().catch(console.error);
  // When the video starts playing, initialize the Three.js scene and rendering.
  videoEl.addEventListener('playing', initThree, { once: true });
}

//— Three.js Initialization
// initThree: Initializes the Three.js scene, sets up video texture, ping-pong buffers, and starts the animation loop.
function initThree() {
  //— video background
  // Create a Three.js texture from the video element.
  videoTexture = new THREE.VideoTexture(videoEl);
  // Set texture filtering options.
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  // Create a material using the video texture.
  const vidMat = new THREE.MeshBasicMaterial({ map: videoTexture });
  // Create a 2x2 plane geometry.
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  // Create a mesh for the video background and add it to the video scene.
  videoMesh = new THREE.Mesh(quadGeo, vidMat);
  sceneVideo.add(videoMesh);

  // Get the video dimensions.
  const w = videoEl.videoWidth;
  const h = videoEl.videoHeight;

  // initialize ping–pong once
  // Initialize ping-pong render targets, mask texture, and simulation/trail materials.
  const pingPongResources = initPingPong(renderer, sceneTrail, heatbox, w, h);
  // Assign the returned resources to global variables.
  rtA = pingPongResources.rtA;
  rtB = pingPongResources.rtB;
  maskTex = pingPongResources.maskTex;
  simMat = pingPongResources.simMat;
  trailMat = pingPongResources.trailMat;
  quad = pingPongResources.quad;
  width = pingPongResources.width;
  height = pingPongResources.height;

  // Setup the WebSocket connection for receiving ant positions.
  setupWebSocket();
  // Perform initial resize setup.
  onResize();
  window.addEventListener('resize', onResize, { passive: true });
  // Start the animation loop.
  animate();
}

//— Resize Handling
// onResize: Handles window resizing to update renderer size and mesh scaling.
function onResize() {
  // Get current window dimensions.
  const w = window.innerWidth, h = window.innerHeight;
  // Update the renderer size.
  renderer.setSize(w, h);

  console.log("w", w, "h", h, "width", width, "height", height);
  

  // Update shader resolution uniform to match the new canvas size (in pixels).
  if (simMat) simMat.uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  if (trailMat) trailMat.uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());

  // If videoMesh or quad are not yet initialized, return.
  if (!videoMesh || !quad) return;
  // Calculate aspect ratios.
  const va = videoEl.videoWidth / videoEl.videoHeight; // Video aspect ratio.
  const sa = w / h; // Screen aspect ratio.
  let sx = 1, sy = 1;
  // Calculate scale factors to maintain video aspect ratio within the screen.
  if (sa > va) sx = va / sa;
  else sy = sa / va;
  // Apply scaling to the video mesh.
  videoMesh.scale.set(sx, sy, 1);
  // Apply scaling to the trail quad, flipping the Y-axis to match video texture orientation.
  quad.scale.set(sx, -sy, 1); // Flip Y-scale for the quad
}

//— Animation Loop
// animate: The main rendering loop, called via requestAnimationFrame.
function animate() {
  // Request the next frame.
  requestAnimationFrame(animate);
  // Indicate that the video texture needs to be updated if the video frame has changed.
  if (videoTexture) videoTexture.needsUpdate = true;

  // Clear the renderer's buffers.
  renderer.autoClear = false;
  renderer.clear();
  // Render the video scene.
  renderer.render(sceneVideo, camera);

  // If the trail quad is initialized, perform simulation and render trails.
  if (quad) {
    //— simulation pass (bypassed for single persistent draw)
    /*
    quad.material = simMat;
    simMat.uniforms.uPrev.value = ping ? rtA.texture : rtB.texture;
    renderer.setRenderTarget(ping ? rtB : rtA);
    renderer.render(sceneTrail, camera); // Renders simulation to render target
    renderer.setRenderTarget(null);

    ping = !ping; // Flips the ping-pong state
    */

    //— draw trails overlay
    // Use maskTex directly for single persistent draw
    trailMat.uniforms.uState.value = maskTex; // Use maskTex instead of simulation output
    // Set the quad's material to the trail drawing shader.
    quad.material = trailMat;

    // Render the trail overlay scene to the screen.
    renderer.render(sceneTrail, camera);
  }
}

//— WebSocket Setup
// setupWebSocket: Establishes the WebSocket connection and handles incoming ant position data.
function setupWebSocket() {
    // Connect to the Ant WebSocket server.
    connectAntWebSocket(({ objects }) => {

      //— mark ant pixels in mask
      // For each ant object received, mark its position in the mask texture.
      // DO NOT clear the mask texture data to make dots persist.
      for (const { x, y } of objects) {
       
        // Ensure coordinates are within bounds (optional but good practice).
        if (x >= 0 && x < width && y >= 0 && y < height) {
           maskTex.image.data[y * width + x] = 1.0;
        }
      }
      // Indicate that the mask texture needs to be updated on the GPU.
      maskTex.needsUpdate = true;
      // Simulation and rendering now happen in the animate loop, using the updated maskTex.
    });
  }
