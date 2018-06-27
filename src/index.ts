import ndarray from "ndarray";
import regl_ from "regl";
import {
  HEIGHT,
  NUM_POINTS,
  NUM_SERIES,
  WIDTH,
  MAX_REPEATS
} from "./constants";
import { generateData } from "./data-gen";
import vegaHeatmap from "./vega-heatmap";
import vegaLinechart from "./vega-linechart";
import { float as f, range } from "./utils";

document.getElementById("count").innerText = `${NUM_SERIES}`;

console.time("Generate data");
const data = generateData(NUM_SERIES, NUM_POINTS);
console.timeEnd("Generate data");

vegaLinechart(data);

const canvas = document.getElementById("regl") as HTMLCanvasElement;
// const canvas = document.createElement("canvas");

const regl = regl_({
  canvas: canvas,
  extensions: ["OES_texture_float"]
});

const maxRenderbufferSize = regl.limits.maxRenderbufferSize;

const maxRepeats = Math.floor(maxRenderbufferSize / WIDTH);
const repeats = Math.min(maxRepeats, Math.floor(NUM_SERIES / 4), MAX_REPEATS);

console.log(`Can repeat ${maxRepeats} times. Repeating ${repeats} times.`);

const reshapedWidth = WIDTH * repeats;

const drawLine = regl({
  vert: `
  precision mediump float;

  attribute float time;
  attribute float value;

  uniform float maxX;
  uniform float maxY;
  uniform float offset;

  void main() {
    float repeats = ${f(repeats)};

    // time and value start at 0 so we can simplify the scaling
    float x = offset / repeats + time / (maxX * repeats);
    float y = value / maxY;

    // squeeze y by 0.3 pixels so that the line is guaranteed to be drawn
    float yStretch = 2.0 - 0.6 / ${f(HEIGHT)};

    // scale to [-1, 1]
    gl_Position = vec4(
      2.0 * (x - 0.5),
      yStretch * (y - 0.5),
      0, 1);
  }`,

  frag: `
  precision mediump float;

  void main() {
    // we will control the color with the color mask
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
  }`,

  uniforms: {
    maxX: regl.prop<any, "maxX">("maxX"),
    maxY: regl.prop<any, "maxY">("maxY"),
    offset: regl.prop<any, "offset">("offset")
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
    for (float j = 0.0; j < ${f(HEIGHT)}; j++) {
      float row = (j + 0.5) / ${f(HEIGHT)};
      vec4 value = texture2D(buffer, vec2(uv.x, row));
      sum += value;
    }

    // sum should be at least 1, prevents problems with empty buffers
    gl_FragColor = max(vec4(1), sum);
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
  uniform sampler2D inbuffer;
  varying vec2 uv;

  void main() {
    vec4 value = texture2D(buffer, uv);
    vec4 sum = texture2D(sums, vec2(uv.x, 0.5));

    gl_FragColor = value / sum;
  }`,

  uniforms: {
    sums: regl.prop<any, "sums">("sums"),
    buffer: regl.prop<any, "buffer">("buffer")
  },

  // additive blending
  blend: {
    enable: true,
    func: {
      srcRGB: "one",
      srcAlpha: 1,
      dstRGB: "one",
      dstAlpha: 1
    },
    equation: {
      rgb: "add",
      alpha: "add"
    },
    color: [0, 0, 0, 0]
  },

  framebuffer: regl.prop<any, "out">("out")
});

/**
 * Merge rgba from the wide buffer into one heatmap buffer
 */
const mergeBuffer = regl({
  ...computeBase,

  frag: `
  precision mediump float;

  uniform sampler2D buffer;

  varying vec2 uv;

  void main() {
    vec4 color = vec4(0);

    // collect all columns
    for (float i = 0.0; i < ${f(repeats)}; i++) {
      float x = (i + uv.x) / ${f(repeats)};
      color += texture2D(buffer, vec2(x, uv.y));
    }

    float value = color.r + color.g + color.b + color.a;
    gl_FragColor = vec4(vec3(value), 1.0);
  }`,

  uniforms: {
    buffer: regl.prop<any, "buffer">("buffer")
  },

  framebuffer: regl.prop<any, "out">("out")
});

/**
 * Helper function to draw a the texture in a buffer.
 */
const drawTexture = regl({
  ...computeBase,

  frag: `
  precision mediump float;

  uniform sampler2D buffer;
  
  varying vec2 uv;
  
  void main() {
    // get r and draw it
    vec3 value = texture2D(buffer, uv).rgb;
    gl_FragColor = vec4(value, 1.0);
  }`,

  uniforms: {
    buffer: regl.prop<any, "buffer">("buffer")
  }
});

const linesBuffer = regl.framebuffer({
  width: reshapedWidth,
  height: HEIGHT,
  colorFormat: "rgba",
  colorType: "float"
});

const sumsBuffer = regl.framebuffer({
  width: reshapedWidth,
  height: 1,
  colorFormat: "rgba",
  colorType: "float"
});

const resultBuffer = regl.framebuffer({
  width: reshapedWidth,
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

// For now, assume that all time series get the same time points
const times = range(NUM_POINTS);

console.time("Compute heatmap");

// batches of 4 * repeats
const batchSize = 4 * repeats;
let lines = new Array(batchSize);

for (let b = 0; b < NUM_SERIES; b += batchSize) {
  // clear the lines buffer before the next batch
  regl.clear({
    color: [0, 0, 0, 0],
    framebuffer: linesBuffer
  });

  // offset within the batch
  for (let o = 0; o < batchSize; o++) {
    // the actual series id
    const s = b + o;

    if (s >= NUM_SERIES) {
      // slice off batches that we don't need anymore
      lines = lines.slice(0, o);
      continue;
    }

    lines[o] = {
      values: data.pick(s, null),
      times: times,
      maxY: 1,
      maxX: NUM_POINTS,
      offset: Math.floor(o / 4),
      colorMask: colorMask(o),
      count: NUM_POINTS,
      out: linesBuffer
    };
  }

  drawLine(lines);

  sum({
    buffer: linesBuffer,
    out: sumsBuffer
  });

  normalize({
    buffer: linesBuffer,
    sums: sumsBuffer,
    out: resultBuffer
  });
}

mergeBuffer({
  buffer: resultBuffer,
  out: heatBuffer
});

console.timeEnd("Compute heatmap");

drawTexture({
  buffer: resultBuffer
});

regl({ framebuffer: heatBuffer })(() => {
  const arr = regl.read();
  const out = new Float32Array(arr.length / 4);

  for (let i = 0; i < arr.length; i += 4) {
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
