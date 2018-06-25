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
const NUM_POINTS = 300;

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
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
  }`,
  
  uniforms: {
    maxX: regl.prop<any, "maxX">("maxX"),
    maxY: regl.prop<any, "maxY">("maxY")
  },
  
  attributes: {
    time: regl.prop<any, "times">("times"),
    value: regl.prop<any, "data">("data")
  },

  colorMask: regl.prop<any, "colorMask">("colorMask"),

  depth: {enable: false},
  
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

  depth: {enable: false},

  count: 3
}

/**
 * Compute the sums of each column and put it into a framebuffer
 */
const sum = regl({
  ...computeBase,
  
  frag: `
  precision mediump float;
  uniform sampler2D buffer;
  varying vec2 uv;

  void main() {
    // normalize by the column
    vec4 sum = vec4(0.0);
    for (int j = 0; j <= ${HEIGHT}; j++) {
      vec2 pos = uv + vec2(0.0, 2.0 * float(j) / float(${HEIGHT}) - 1.0);
      vec4 value = texture2D(buffer, pos);
      sum += value;
    }

    gl_FragColor = sum;
  }`,
  
  uniforms: {
    buffer: regl.prop<any, "buffer">("buffer")
  },
  
  framebuffer: regl.prop<any, "out">("out")
});

/**
 * Normalize the pixels in the buffer by the sums computed before.
 * Alpha blends the outputs.
 */
const normalize = regl({
  ...computeBase,
  
  frag: `
  precision mediump float;
  uniform sampler2D buffer;
  uniform sampler2D sums;
  varying vec2 uv;

  void main() {
    vec4 value = texture2D(buffer, uv);
    vec4 sum = texture2D(sums, vec2(uv.x, 0));

    gl_FragColor = vec4(value / sum);
  }`,
  
  uniforms: {
    sums: regl.prop<any, "sums">("sums"),
    buffer: regl.prop<any, "buffer">("buffer")
  },

  // alpha blending
  blend: {
    enable: true,
    equation: {
      rgb: 'add',
      alpha: 'add'
    }
  },
  
  framebuffer: regl.prop<any, "out">("out")
});

/**
 * Helper function to draw a bufer.
 */
const drawBuffer = regl({
  ...computeBase,
  
  frag: `
  precision mediump float;
  uniform sampler2D buffer;
  varying vec2 uv;

  void main() {
    // only draw rgb
    vec3 color = texture2D(buffer, uv).rgb;
    gl_FragColor = vec4(color, 1.0);
  }`,

  uniforms: {
    buffer: regl.prop<any, "buffer">("buffer")
  }
});

/**
 * Helper function to print the r component of a buffer.
 */
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

const buffer = regl.framebuffer({
  width: WIDTH,
  height: HEIGHT,
  colorFormat: "rgba",
  colorType: "float"
});

const sums = regl.framebuffer({
  width: WIDTH,
  height: 1,
  colorFormat: "rgba",
  colorType: "float"
});

const output = regl.framebuffer({
  width: WIDTH,
  height: HEIGHT,
  colorFormat: "rgba",
  colorType: "float"
});

// Should draw the normalized lines into the same buffer but currently only draws the first line.
drawLine({
  data: data[0],
  times: range(NUM_POINTS),
  maxY: 1,
  maxX: NUM_POINTS,
  colorMask: [true, false, false, false],
  count: NUM_POINTS,
  out: buffer
})
drawLine({
  data: data[1],
  times: range(NUM_POINTS),
  maxY: 1,
  maxX: NUM_POINTS,
  colorMask: [false, true, false, false],
  count: NUM_POINTS,
  out: buffer
})
drawLine({
  data: data[2],
  times: range(NUM_POINTS),
  maxY: 1,
  maxX: NUM_POINTS,
  colorMask: [false, false, true, false],
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
