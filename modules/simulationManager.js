import { initPingPong } from './pingpong.js';

export class SimulationManager {
  constructor(renderer, sceneTrail, heatbox, videoEl) {
    // once video is playing:
    const w = videoEl.videoWidth, h = videoEl.videoHeight;
    Object.assign(this,
      initPingPong(renderer, sceneTrail, heatbox, w, h),
      { renderer, sceneTrail, ping: true }
    );
  }

  handleData(objects) {
    //— reset mask
    this.maskTex.image.data.fill(0);
    for (let { x, y } of objects) {
      this.maskTex.image.data[y * this.width + x] = 1;
    }
    this.maskTex.needsUpdate = true;

    //— sim pass
    const prev = this.ping ? this.rtA : this.rtB;
    const next = this.ping ? this.rtB : this.rtA;
    this.simMat.uniforms.uPrev.value = prev.texture;
    this.renderer.setRenderTarget(next);
    this.renderer.render(this.sceneTrail, this.camera);
    this.renderer.setRenderTarget(null);

    //— draw pass
    this.trailMat.uniforms.uState.value = next.texture;
    this.quad.material = this.trailMat;
    this.renderer.render(this.sceneTrail, this.camera);

    this.ping = !this.ping;
  }
}
