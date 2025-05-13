precision highp float;
uniform sampler2D uState, uCM;
uniform vec2 uRes;
uniform bool uHeat;

float dens(vec2 uv) {
  vec2 o = 1.0 / uRes;
  float s = 0.0;
  s += texture(uState, uv + vec2( o.x,  0.0)).r;
  s += texture(uState, uv + vec2(-o.x,  0.0)).r;
  s += texture(uState, uv + vec2( 0.0,  o.y)).r;
  s += texture(uState, uv + vec2( 0.0, -o.y)).r;
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
