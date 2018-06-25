import embed from "vega-embed";
import regl_ from "regl";

function generateData(n: number, m: number) {
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

function range(n: number) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = i;
  }
  return out;
}

const NUM_SERIES = 10;
const NUM_POINTS = 200;

const WIDTH = 64;
const HEIGHT = 32;

const data = generateData(NUM_SERIES, NUM_POINTS);

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

const regl = regl_({
  canvas: "#regl",
  extensions: ["OES_texture_float"]
});

// console.log("limits", regl.limits);

regl.clear({
  color: [0, 0, 0, 1],
  depth: 1
});

const drawLine = regl({
  vert: `
  precision mediump float;

  attribute float time;
  attribute float value;

  uniform float maxX;
  uniform float maxY;

  void main() {
    // time and value start at 0
    float x = time / maxX;
    float y = value / maxY;

    // scale to [-1, 1]
    gl_Position = vec4(
      2.0 * (x - 0.5),
      2.0 * (y - 0.5),
      0, 1);
  }`,

  frag: `
  precision mediump float;

  void main() {
    // write to the red channel
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
  }`,
  
  uniforms: {
    maxX: regl.prop<any, "maxX">("maxX"),
    maxY: regl.prop<any, "maxY">("maxY")
  },
  
  attributes: {
    time: regl.prop<any, "times">("times"),
    value: regl.prop<any, "data">("data")
  },
  
  count: regl.prop<any, "count">("count"),
  
  primitive: "line strip",
  lineWidth: () => 1,
  
  framebuffer: regl.prop<any, "out">("out")
});

const computeBase = {
  vert: `
  precision mediump float;
  attribute vec2 position;
  varying vec2 uv;
  void main() {
    uv = 0.5 * (position + 1.0);
    gl_Position = vec4(position, 0, 1);
  }`,
  
  attributes: {
    position: [-4, -4, 4, -4, 0, 4]
  },

  count: 3
}

/**
 * Compute the sums of each column and puts it into a framebuffer
 */
const sum = regl({
  ...computeBase,
  
  frag: `
  precision mediump float;
  uniform sampler2D buffer;
  varying vec2 uv;
  void main() {
    // normalize by the column
    float sum = 1.0;
    for (int j = 0; j <= ${HEIGHT}; j++) {
      vec2 pos = uv + vec2(0.0, 2.0 * float(j) / float(${HEIGHT}) - 1.0);
      float value = texture2D(buffer, pos).r;
      sum += value;
    }

    gl_FragColor = vec4(sum, 0, 0, 1);
  }`,
  
  
  uniforms: {
    buffer: regl.prop<any, "buffer">("buffer")
  },
  
  framebuffer: regl.prop<any, "out">("out")
});

const normalize = regl({
  ...computeBase,
  
  frag: `
  precision mediump float;
  uniform sampler2D buffer;
  uniform sampler2D sums;
  varying vec2 uv;
  void main() {
    float r = texture2D(buffer, uv).r;
    float s = texture2D(sums, vec2(uv.x, 0)).r;

    gl_FragColor = vec4(r / s, 0, 0, 1);
  }`,
  
  uniforms: {
    sums: regl.prop<any, "sums">("sums"),
    buffer: regl.prop<any, "buffer">("buffer")
  },
  
  framebuffer: regl.prop<any, "out">("out")
});

const drawBuffer = regl({
  ...computeBase,
  
  frag: `
  precision mediump float;
  uniform sampler2D buffer;
  varying vec2 uv;
  void main() {
    gl_FragColor = texture2D(buffer, uv);
  }`,

  uniforms: {
    buffer: regl.prop<any, "buffer">("buffer")
  }
});

const buffer = regl.framebuffer({
  width: WIDTH,
  height: HEIGHT,
  colorFormat: "rgba",
  colorType: "float",
  stencil: true
});

const sums = regl.framebuffer({
  width: WIDTH,
  height: 1,
  colorFormat: "rgba",
  colorType: "float",
  stencil: true
});

const output = regl.framebuffer({
  width: WIDTH,
  height: HEIGHT,
  colorFormat: "rgba",
  colorType: "float",
  stencil: true
});

function printBuffer(b) {
  regl({framebuffer: b})(() => {
    const arr = regl.read();
    const out = [];
    for (var i = 0; i < arr.length; i += 4) {
      out.push(arr[i]);
    }
    console.log(out);
  })
}

drawLine({
  data: data[0],
  times: range(NUM_POINTS),
  maxY: data[0].reduce((acc, val) => Math.max(acc, val), 0),
  maxX: NUM_POINTS,
  count: NUM_POINTS,
  out: buffer
})

sum({
  buffer: buffer,
  out: sums
});

normalize({
  buffer: buffer,
  sums: sums,
  out: output
});

drawBuffer({
  buffer: output
});

printBuffer(sums);
