import ndarray from "ndarray";
import regl_ from "regl";
import {
  HEIGHT,
  NUM_POINTS,
  NUM_SERIES,
  WIDTH,
  MAX_REPEATS_X,
  MAX_REPEATS_Y,
  DEBUG_CANVAS
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

let canvas = document.createElement("canvas");

if (DEBUG_CANVAS) {
  document.getElementById("regl").appendChild(canvas);
} else {
  document.getElementById("regl").innerText = "";
}

const regl = regl_({
  canvas: canvas,
  extensions: ["OES_texture_float"]
});

const maxRenderbufferSize = regl.limits.maxRenderbufferSize;

const maxRepeatsX = Math.floor(maxRenderbufferSize / WIDTH);
const maxRepeatsY = Math.floor(maxRenderbufferSize / HEIGHT);
const repeatsX = Math.min(
  maxRepeatsX,
  Math.floor(NUM_SERIES / 4),
  MAX_REPEATS_X
);
const repeatsY = Math.min(
  maxRepeatsY,
  Math.ceil(NUM_SERIES / (repeatsX * 4)),
  MAX_REPEATS_Y
);

console.log(
  `Can repeat ${maxRepeatsX}x${maxRepeatsY} times. Repeating ${repeatsX}x${repeatsY} times.`
);

const reshapedWidth = WIDTH * repeatsX;
const reshapedHeight = HEIGHT * repeatsY;

console.log(`Canvas size ${reshapedWidth}x${reshapedHeight}.`);

const drawLine = regl({
  vert: `
  precision mediump float;

  attribute float time;
  attribute float value;

  uniform float maxX;
  uniform float maxY;
  uniform float column;
  uniform float row;

  void main() {
    float repeatsX = ${f(repeatsX)};
    float repeatsY = ${f(repeatsY)};

    // time and value start at 0 so we can simplify the scaling
    float x = column / repeatsX + time / (maxX * repeatsX);
    
    // move up by 0.3 pixels so that the line is guaranteed to be drawn
    float yOffset = row / repeatsY + 0.3 / ${f(reshapedHeight)};
    // squeeze by 0.6 pixels
    float squeeze = 1.0 - 0.6 / ${f(HEIGHT)};
    float yValue = value / (maxY * repeatsY) * squeeze;
    float y = yOffset + yValue;

    // squeeze y by 0.3 pixels so that the line is guaranteed to be drawn
    float yStretch = 2.0 - 0.6 / ${f(reshapedHeight)};

    // scale to [-1, 1]
    gl_Position = vec4(
      2.0 * (x - 0.5),
      2.0 * (y - 0.5),
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
    column: regl.prop<any, "column">("column"),
    row: regl.prop<any, "row">("row")
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
    float texelRowStart = floor(uv.y * ${f(repeatsY)}) / ${f(repeatsY)};

    // normalize by the column
    vec4 sum = vec4(0.0);
    for (float j = 0.0; j < ${f(HEIGHT)}; j++) {
      float texelRow = texelRowStart + (j + 0.5) / ${f(reshapedHeight)};
      vec4 value = texture2D(buffer, vec2(uv.x, texelRow));
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
  varying vec2 uv;

  void main() {
    vec4 value = texture2D(buffer, uv);
    vec4 sum = texture2D(sums, uv);

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
const mergeBufferHorizontally = regl({
  ...computeBase,

  frag: `
  precision mediump float;

  uniform sampler2D buffer;

  varying vec2 uv;

  void main() {
    vec4 color = vec4(0);

    // collect all columns
    for (float i = 0.0; i < ${f(repeatsX)}; i++) {
      float x = (i + uv.x) / ${f(repeatsX)};
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
const mergeBufferVertically = regl({
  ...computeBase,

  frag: `
  precision mediump float;

  uniform sampler2D buffer;

  varying vec2 uv;

  void main() {
    vec4 color = vec4(0);

    // collect all rows
    for (float i = 0.0; i < ${f(repeatsY)}; i++) {
      float y = (i + uv.y) / ${f(repeatsY)};
      color += texture2D(buffer, vec2(uv.x, y));
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

  colorMask: regl.prop<any, "colorMask">("colorMask"),

  uniforms: {
    buffer: regl.prop<any, "buffer">("buffer")
  }
});

const linesBuffer = regl.framebuffer({
  width: reshapedWidth,
  height: reshapedHeight,
  colorFormat: "rgba",
  colorType: "uint8"
});

const sumsBuffer = regl.framebuffer({
  width: reshapedWidth,
  height: repeatsY,
  colorFormat: "rgba",
  colorType: "float"
});

const resultBuffer = regl.framebuffer({
  width: reshapedWidth,
  height: reshapedHeight,
  colorFormat: "rgba",
  colorType: "float"
});

const preMergedBuffer = regl.framebuffer({
  width: WIDTH,
  height: reshapedHeight,
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
const batchSize = 4 * repeatsX * repeatsY;

// index of series
let series = 0;
// how many series have already been drawn
let finishedSeries = 0;

console.time("Prepare Batch");
for (let b = 0; b < NUM_SERIES; b += batchSize) {
  // array to hold the lines that should be rendered
  let lines = new Array(Math.min(batchSize, NUM_SERIES - series));

  // clear the lines buffer before the next batch
  regl.clear({
    color: [0, 0, 0, 0],
    framebuffer: linesBuffer
  });

  loop: for (let row = 0; row < repeatsY; row++) {
    for (let i = 0; i < 4 * repeatsX; i++) {
      if (series >= NUM_SERIES) {
        break loop;
      }

      // console.log(series, Math.floor(i / 4), row);

      lines[series - finishedSeries] = {
        values: data.pick(series, null),
        times: times,
        maxY: 0.6,
        maxX: NUM_POINTS,
        column: Math.floor(i / 4),
        row: row,
        colorMask: colorMask(i),
        count: NUM_POINTS,
        out: linesBuffer
      };

      series++;
    }
  }
  console.timeEnd("Prepare Batch");

  console.log(`Drawing ${lines.length} lines.`);

  console.time("regl: drawLine");
  drawLine(lines);
  console.timeEnd("regl: drawLine");

  finishedSeries += lines.length;

  console.time("regl: sum");
  sum({
    buffer: linesBuffer,
    out: sumsBuffer
  });
  console.timeEnd("regl: sum");

  console.time("regl: normalize");
  normalize({
    buffer: linesBuffer,
    sums: sumsBuffer,
    out: resultBuffer
  });
  console.timeEnd("regl: normalize");
}

console.time("regl: merge");
mergeBufferHorizontally({
  buffer: resultBuffer,
  out: preMergedBuffer
});

mergeBufferVertically({
  buffer: preMergedBuffer,
  out: heatBuffer
});
console.timeEnd("regl: merge");

console.timeEnd("Compute heatmap");

if (DEBUG_CANVAS) {
  drawTexture({
    buffer: resultBuffer,
    colorMask: [true, true, true, true]
  });
}

// print buffer values
// regl({ framebuffer: sumsBuffer })(() => {
//   const arr = regl.read();
//   const out = new Float32Array(arr.length / 4);
//   for (let i = 0; i < arr.length; i += 4) {
//     out[i / 4] = arr[i];
//   }
//   console.log(out);
// });

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
