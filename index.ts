import embed from "vega-embed";
import regl_ from "regl";
import ndarray from "ndarray";

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

const NUM_SERIES = 1000;
const NUM_POINTS = 256;

const WIDTH = 64;
const HEIGHT = 32;

console.time("Generate data");
const data = generateData(NUM_SERIES, NUM_POINTS);
console.timeEnd("Generate data");

const values = data
  .slice(0, 5)
  .map((series, group) =>
    [].slice.call(series).map((value, time) => ({ group, time, value }))
  )
  .reduce((acc, val) => acc.concat(val), []);

embed(
  document.getElementById("lines"),
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
    value: regl.prop<any, "values">("values")
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
    for (float j = 0.0; j < ${HEIGHT.toFixed(1)}; j++) {
      float row = j / ${HEIGHT.toFixed(1)};
      vec4 value = texture2D(buffer, vec2(uv.x, row));
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
    gl_FragColor = value / sum;
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
 * Merge rgba into one buffer
 */
const mergeBuffer = regl({
  ...computeBase,
  
  frag: `
  precision mediump float;
  uniform sampler2D buffer;
  varying vec2 uv;

  void main() {
    vec4 color = texture2D(buffer, uv);
    float value = color.r + color.g + color.b + color.a;
    gl_FragColor = vec4(vec3(value), 1.0);
  }`,

  uniforms: {
    buffer: regl.prop<any, "buffer">("buffer")
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

const linesBuffer = regl.framebuffer({
  width: WIDTH,
  height: HEIGHT,
  colorFormat: "rgba",
  colorType: "float"
});

const sumsBuffer = regl.framebuffer({
  width: WIDTH,
  height: 1,
  colorFormat: "rgba",
  colorType: "float"
});

const outBuffer = regl.framebuffer({
  width: WIDTH,
  height: HEIGHT,
  colorFormat: "rgba",
  colorType: "float"
});

const heatBuffer = regl.framebuffer({
  width: WIDTH,
  height: HEIGHT,
  colorFormat: "rgba",
  colorType: "float"
});

function colorMask(i) {
  const mask = [false, false, false, false];
  mask[i % 4] = true;
  return mask;
}

console.time("Compute heatmap");
for (let i = 0; i < data.length; i+=4) {
  drawLine([i, i+1, i+2, i+3].filter(d => d < data.length).map((
    d => ({
      values: data[d],
      times: range(NUM_POINTS),
      maxY: 1,
      maxX: NUM_POINTS,
      colorMask: colorMask(d),
      count: NUM_POINTS,
      out: linesBuffer
    })
  )));

  sum({
    buffer: linesBuffer,
    out: sumsBuffer
  });

  normalize({
    buffer: linesBuffer,
    sums: sumsBuffer,
    out: outBuffer
  });
}

mergeBuffer({
  buffer: outBuffer,
  out: heatBuffer
});
console.timeEnd("Compute heatmap");

drawBuffer({
  buffer: heatBuffer
});


regl({framebuffer: heatBuffer})(() => {
  const arr = regl.read();
  const out = new Float32Array(arr.length / 4);
  for (var i = 0; i < arr.length; i += 4) {
    out[i/4] = arr[i];
  }
  
  const heatmap = ndarray(out, [HEIGHT, WIDTH]);

  const heatmapData = [];
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      heatmapData.push({x,y,value: heatmap.get(y,x)})
    }
  }

  embed(
    document.getElementById("heat"),
    {
      width: 600,
      height: 300,
      data: {
        values: heatmapData
      },
      mark: {
        type: "rect"
      },
      encoding: {
        color: { field: "value", type: "quantitative" },
        x: { field: "x", type: "ordinal", scale: {padding: 0} },
        y: { field: "y", type: "ordinal", scale: {reverse: true, padding: 0} }
      }
    },
    { defaultStyle: true }
  );
});
