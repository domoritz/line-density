import ndarray from "ndarray";
import regl_ from "regl";
import { HEIGHT, NUM_POINTS, NUM_SERIES, WIDTH } from "./constants";
import { generateData, range } from "./data-gen";
import vegaHeatmap from "./vega-heatmap";
import vegaLinechart from "./vega-linechart";

document.getElementById("count").innerText = `${NUM_SERIES}`;

console.time("Generate data");
const data = generateData(NUM_SERIES, NUM_POINTS);
console.timeEnd("Generate data");

vegaLinechart(data);

// const canvas = document.getElementById("#regl") as HTMLCanvasElement;
const canvas = document.createElement("canvas");

const regl = regl_({
  canvas: canvas,
  extensions: ["OES_texture_float"]
});

// console.log("limits", regl.limits);

// regl.clear({
//   color: [0, 0, 0, 1],
//   depth: 1
// });

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

  depth: { enable: false, mask: false },

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

  depth: { enable: false, mask: false },

  count: 3
};

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
      rgb: "add",
      alpha: "add"
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
  
  vec4 viridis(float x) {
    const float e0 = 0.0;
    const vec4 v0 = vec4(0.26666666666666666,0.00392156862745098,0.32941176470588235,1);
    const float e1 = 0.13;
    const vec4 v1 = vec4(0.2784313725490196,0.17254901960784313,0.47843137254901963,1);
    const float e2 = 0.25;
    const vec4 v2 = vec4(0.23137254901960785,0.3176470588235294,0.5450980392156862,1);
    const float e3 = 0.38;
    const vec4 v3 = vec4(0.17254901960784313,0.44313725490196076,0.5568627450980392,1);
    const float e4 = 0.5;
    const vec4 v4 = vec4(0.12941176470588237,0.5647058823529412,0.5529411764705883,1);
    const float e5 = 0.63;
    const vec4 v5 = vec4(0.15294117647058825,0.6784313725490196,0.5058823529411764,1);
    const float e6 = 0.75;
    const vec4 v6 = vec4(0.3607843137254902,0.7843137254901961,0.38823529411764707,1);
    const float e7 = 0.88;
    const vec4 v7 = vec4(0.6666666666666666,0.8627450980392157,0.19607843137254902,1);
    const float e8 = 1.0;
    const vec4 v8 = vec4(0.9921568627450981,0.9058823529411765,0.1450980392156863,1);
    float a0 = smoothstep(e0,e1,x);
    float a1 = smoothstep(e1,e2,x);
    float a2 = smoothstep(e2,e3,x);
    float a3 = smoothstep(e3,e4,x);
    float a4 = smoothstep(e4,e5,x);
    float a5 = smoothstep(e5,e6,x);
    float a6 = smoothstep(e6,e7,x);
    float a7 = smoothstep(e7,e8,x);
    return max(mix(v0,v1,a0)*step(e0,x)*step(x,e1),
      max(mix(v1,v2,a1)*step(e1,x)*step(x,e2),
      max(mix(v2,v3,a2)*step(e2,x)*step(x,e3),
      max(mix(v3,v4,a3)*step(e3,x)*step(x,e4),
      max(mix(v4,v5,a4)*step(e4,x)*step(x,e5),
      max(mix(v5,v6,a5)*step(e5,x)*step(x,e6),
      max(mix(v6,v7,a6)*step(e6,x)*step(x,e7),mix(v7,v8,a7)*step(e7,x)*step(x,e8)
    )))))));
  }
  
  void main() {
    // inefficient: get maximum value in buffer
    float maxValue = 0.0;
    for (float i = 0.0; i < ${WIDTH.toFixed(1)}; i++) {
      float col = i / ${WIDTH.toFixed(1)};
      for (float j = 0.0; j < ${HEIGHT.toFixed(1)}; j++) {
        float row = j / ${HEIGHT.toFixed(1)};
        maxValue = max(maxValue, texture2D(buffer, vec2(row, col)).r);
      }
    }

    // get r and draw it with viridis
    float value = texture2D(buffer, uv).r / maxValue;
    gl_FragColor = viridis(value);
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

const times = range(NUM_POINTS);

const repeats = Math.floor(regl.limits.maxRenderbufferSize / WIDTH);
console.log(`can repeat ${repeats} times`);

console.time("Compute heatmap");
for (let i = 0; i < data.shape[0]; i += 4) {
  drawLine(
    [i, i + 1, i + 2, i + 3].filter(d => d < data.shape[0]).map(d => ({
      values: data.pick(i, null),
      times: times,
      maxY: 1,
      maxX: NUM_POINTS,
      colorMask: colorMask(d),
      count: NUM_POINTS,
      out: linesBuffer
    }))
  );

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

// console.time("Render output");
// drawBuffer({
//   buffer: heatBuffer
// });
// console.timeEnd("Render output");

regl({ framebuffer: heatBuffer })(() => {
  const arr = regl.read();
  const out = new Float32Array(arr.length / 4);
  for (var i = 0; i < arr.length; i += 4) {
    out[i / 4] = arr[i];
  }

  const heatmap = ndarray(out, [HEIGHT, WIDTH]);

  const heatmapData = [];
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      heatmapData.push({ x, y, value: heatmap.get(y, x) });
    }
  }

  vegaHeatmap(heatmapData);
});
