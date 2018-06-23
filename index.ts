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

const canvas = document.getElementById("regl") as HTMLCanvasElement;

const regl = regl_({
  canvas: canvas,
  extensions: ["OES_texture_float"],
  attributes: {
    preserveDrawingBuffer: true,
    antialias: true
  }
});

regl.clear({
  color: [0, 0, 0, 0]
});

const buffer = regl.framebuffer({
  width: 512,
  height: 256,
  colorFormat: "rgba",
  colorType: "uint8",
  stencil: true
});

const output = regl.framebuffer({
  width: 512,
  height: 256,
  colorFormat: "rgba",
  colorType: "float",
  stencil: true
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
    gl_FragColor = vec4(1.0, 0.0, 0.0, 0.0);
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
  
  framebuffer: buffer
});

// mult + norm + add
const normalize = regl({
  vert: `
  precision mediump float;
  attribute vec2 position;
  uniform sampler2D buffer;
  varying vec2 uv;
  void main() {
    uv = 0.5 * (position + 1.0);
    gl_Position = vec4(position, 0, 1);

    // buffer
  }`,
  
  frag: `
  precision mediump float;
  uniform sampler2D buffer;
  varying vec2 uv;
  void main() {
    float r = texture2D(buffer, uv).r;
    gl_FragColor = vec4(r, 0, 0, 1);
  }`,
  
  attributes: {
    position: [-4, -4, 4, -4, 0, 4]
  },
  
  uniforms: {
    buffer: regl.prop<any, "buffer">("buffer")
  },
  
  count: 3,
  
  // framebuffer: output
});

const drawBuffer = regl({
  vert: `
  precision mediump float;
  attribute vec2 position;
  varying vec2 uv;
  void main() {
    uv = 0.5 * (position + 1.0);
    gl_Position = vec4(position, 0, 1);
  }`,
  
  frag: `
  precision mediump float;
  uniform sampler2D buffer;
  varying vec2 uv;
  void main() {
    gl_FragColor = texture2D(buffer, uv);
  }`,
  
  attributes: {
    position: [-4, -4, 4, -4, 0, 4]
  },
  
  uniforms: {
    buffer: regl.prop<any, "buffer">("buffer")
  },
  
  count: 3
});

drawLine({
  data: data[0],
  times: range(NUM_POINTS),
  maxY: 1,
  maxX: NUM_POINTS,
  count: NUM_POINTS
})

normalize({
  buffer: buffer
});

drawBuffer({
  buffer: output
});
