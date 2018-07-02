# Fast density heatmaps for time series with WebGL

**Try the demo at https://domoritz.github.io/line-heatmap.**

This implementation renders as many lines a possible into a single framebuffer and computes the sums and normalization entirely on the GPU. The multiple heatmaps are eventually collected into a single output buffer. We can then render the buffer with the tool of our choice (e.g. Vega).

<a href="https://domoritz.github.io/line-heatmap">
    <img src="https://raw.githubusercontent.com/domoritz/line-density/master/screenshot.png" width="600"></img>
</a>

## Installation

This module is [available on npm](https://www.npmjs.com/package/line-density) and can be installed with `yarn add line-density`.

## Usage

```ts
import density from "line-density";
import ndarray from "ndarray";

const data = ndarray([1, 2, 3, 2, 1, 2], [2, 3]);

const lineDensity = await density(
  // the time series data
  data,
  // x binning
  { start: 0, stop: 3, step: 1 },
  // y binning
  { start: 0, stop: 3, step: 1 }
);
```

The density function takes an optional canvas as the fourth parameter (for use with https://github.com/Automattic/node-canvas).

## Related Repositories

https://github.com/domoritz/line-density-rust for a parallel Rust implementation.

## Resources

- http://regl.party/api
- https://github.com/Erkaman/regl-cnn/blob/gh-pages/src/gpu.js
- https://github.com/realazthat/glsl-sat
- https://github.com/regl-project/regl/blob/gh-pages/example/graph.js
- https://beta.observablehq.com/@tmcw/game-of-life-with-regl
