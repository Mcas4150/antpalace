precision highp float;
uniform sampler2D uPrev, uMask;
uniform vec2 uRes;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float a = texture(uPrev, uv).r;
  float m = texture(uMask, uv).r;
  gl_FragColor = vec4(max(a, m), 0.0, 0.0, 1.0);
}
