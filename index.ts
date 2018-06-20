import embed from "vega-embed";

function generateData(n: number, m: number) {
  const arr = new Array(n);

  for (let i = 0; i < n; ++i) {
    const d = (arr[i] = new Float64Array(m));
    for (let j = 0, v = 0; j < m; ++j) {
      d[j] = v = walk(v);
    }
  }

  function walk(v) {
    return Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.05));
  }

  return arr;
}

const data = generateData(10, 200);

const values = data
  .slice(0, 5)
  .map((series, group) =>
    [].slice.call(series).map((value, time) => ({ group, time, value }))
  )
  .reduce((acc, val) => acc.concat(val), []);

embed(
  document.getElementById("vis"),
  {
    width: 600,
    data: {
      values: values
    },
    mark: {
      type: "line",
      orient: "vertical"
    },
    encoding: {
      color: { field: "group", type: "nominal" },
      x: { field: "time", type: "quantitative" },
      y: { field: "value", type: "quantitative" }
    }
  },
  { defaultStyle: true }
);
