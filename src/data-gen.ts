import ndarray from "ndarray";
import { NON_TYPE_DOMAIN_RANGE_VEGA_SCALE_PROPERTIES } from "vega-lite/build/src/scale";

export function generateData(n: number, m: number) {
  const arr = ndarray(new Float32Array(n * m), [n, m]);

  for (let i = 0; i < n; ++i) {
    for (let j = 0, v = 0; j < m; ++j) {
      arr.set(i, j, (v = walk(v)));
    }
  }

  function walk(v) {
    const value = v + (Math.random() - 0.5) * 0.05;
    if (value < 0) {
      return 0;
    }
    if (value > 1) {
      return 1;
    }
    return value;
  }

  return arr;
}

export function range(n: number) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = i;
  }
  return out;
}
