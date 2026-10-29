// ---------------------------------------------------------------------------
// Shared GLSL: hashes, value noise, fbm, colour helpers, aerial perspective.
// ---------------------------------------------------------------------------

float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }

float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p3){
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 hash33(vec3 p3){
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i + vec3(0,0,0)), n100 = hash13(i + vec3(1,0,0));
  float n010 = hash13(i + vec3(0,1,0)), n110 = hash13(i + vec3(1,1,0));
  float n001 = hash13(i + vec3(0,0,1)), n101 = hash13(i + vec3(1,0,1));
  float n011 = hash13(i + vec3(0,1,1)), n111 = hash13(i + vec3(1,1,1));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

float vnoise2(vec2 x){
  vec2 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1,0)), c = hash12(i + vec2(0,1)), d = hash12(i + vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}

float fbm(vec3 p, int oct){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    s += a * vnoise(p);
    n += a;
    p *= 2.02;
    a *= 0.5;
  }
  return s / max(n, 1e-5);
}

float fbm2(vec2 p, int oct){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    s += a * vnoise2(p);
    n += a;
    p *= 2.03;
    a *= 0.5;
  }
  return s / max(n, 1e-5);
}

// ridged noise - used for tree bark, stone, gravel
float ridge(vec3 p, int oct){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    s += a * (1.0 - abs(vnoise(p) * 2.0 - 1.0));
    n += a; p *= 2.07; a *= 0.5;
  }
  return s / max(n, 1e-5);
}

// ACES filmic approximation (Narkowicz) - cheap, keeps highlights filmic
vec3 acesFilm(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

// exponential height/distance fog matched to the sky palette
vec3 applyAerial(vec3 col, vec3 fogCol, float dist, float density){
  float f = 1.0 - exp(-dist * density);
  return mix(col, fogCol, clamp(f, 0.0, 1.0));
}

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
