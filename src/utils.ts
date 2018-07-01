export function range(n: number) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = i;
  }
  return out;
}

/**
 * Convert integer to float for shaders.
 */
export function float(i: number) {
  return i.toFixed(1);
}

/**
 * Seeded pseudo random number genrator.
 */
export function random(seed) {
  return function() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
}
