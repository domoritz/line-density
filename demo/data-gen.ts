import ndarray from "ndarray";
import { USE_REAL_RANDOM } from "./constants";

/**
 * Seeded pseudo random number genrator.
 */
export function random(seed) {
  return function() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
}

/**
 * Generate test time series with a random walk.
 * @param numSeries Number of series.
 * @param numDataPoints Number of data points per series.
 */
export function generateData(
  numSeries: number,
  numDataPoints: number
): ndarray {
  console.time("Generate data");

  const arr = ndarray(new Float32Array(numSeries * numDataPoints), [
    numSeries,
    numDataPoints
  ]);

  const rand = USE_REAL_RANDOM ? Math.random : random(42);

  for (let i = 0; i < numSeries; ++i) {
    for (let j = 0, v = 0; j < numDataPoints; ++j) {
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

  console.timeEnd("Generate data");

  return arr;
}
