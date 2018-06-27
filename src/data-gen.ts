import ndarray from "ndarray";
import { random } from "./utils";
import { USE_REAL_RANDOM } from "./constants";

export function generateData(n: number, m: number): ndarray {
  const arr = ndarray(new Float32Array(n * m), [n, m]);

  const rand = USE_REAL_RANDOM ? Math.random : random(42);

  for (let i = 0; i < n; ++i) {
    for (let j = 0, v = 0; j < m; ++j) {
      arr.set(i, j, (v = walk(v)));
    }
  }

  function walk(v) {
    const value = v + (rand() - 0.5) * 0.05;
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
