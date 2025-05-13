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
      this.renderer.render(this.sceneVideo, this.camera);
      this.renderer.render(this.sceneTrail, this.camera);
    }
  }
  