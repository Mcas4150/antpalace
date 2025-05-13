export class RendererManager {
    constructor(renderer, camera, sceneVideo, videoMesh, sceneTrail, quad) {
      this.renderer   = renderer;
      this.camera     = camera;
      this.sceneVideo = sceneVideo;
      this.videoMesh  = videoMesh;
      this.sceneTrail = sceneTrail;
      this.quad       = quad;
  
      window.addEventListener('resize', () => this.onResize(), { passive:true });
      this.onResize();
      this.animate();
    }
  
    onResize() {
      const w = innerWidth, h = innerHeight;
      this.renderer.setSize(w, h);
      if (!this.videoMesh || !this.quad) return;
      const va = this.videoMesh.material.map.image.width /
                 this.videoMesh.material.map.image.height;
      const sa = w / h;
      const sx = sa > va ? va/sa : 1;
      const sy = sa > va ? 1 : sa/va;
      this.videoMesh.scale.set(sx, sy, 1);
      this.quad.scale.set(sx, sy, 1);
    }
  
    animate() {
      requestAnimationFrame(() => this.animate());
      if (this.sceneVideo.children[0].material.map) 
        this.sceneVideo.children[0].material.map.needsUpdate = true;
      this.renderer.autoClear = false;
      this.renderer.clear();
      // Commented out existing render calls to draw a single pixel
      // this.renderer.render(this.sceneVideo, this.camera);
      // this.renderer.render(this.sceneTrail, this.camera);

      // Create a simple geometry for a single point
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)); // Center of the screen

      // Create a material for the point (white color, size 1 pixel)
      const material = new THREE.PointsMaterial({ color: 0xffffff, size: 10 });

      // Create the Points object
      const pixel = new THREE.Points(geometry, material);

      // Add the pixel to the video scene
      this.sceneVideo.add(pixel);

      // Render the video scene (which now contains the pixel)
      this.renderer.render(this.sceneVideo, this.camera);
      // Keep the trail scene render commented out
      // this.renderer.render(this.sceneTrail, this.camera);
    }
  }
