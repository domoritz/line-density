export function generateData(n: number, m: number) {
  const arr = new Array(n);

  for (let i = 0; i < n; ++i) {
    const d = (arr[i] = new Float32Array(m));
    for (let j = 0, v = 0; j < m; ++j) {
      d[j] = v = walk(v);
    }
  }

  function walk(v) {
    return Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.05));
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