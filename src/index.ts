import { bin } from "vega-statistics";
import { compute } from "./compute";
import {
  DEBUG_CANVAS,
  MAXBINS_X,
  MAXBINS_Y,
  NUM_POINTS,
  NUM_SERIES
} from "./constants";
import { generateData } from "./data-gen";
import vegaLinechart from "./vega-linechart";
import vegaHeatmap from "./vega-heatmap";

document.getElementById("count").innerText = `${NUM_SERIES}`;

const data = generateData(NUM_SERIES, NUM_POINTS);

vegaLinechart(data);

let canvas;

document.getElementById("regl").innerText = "";
if (DEBUG_CANVAS) {
  canvas = document.createElement("canvas");
  document.getElementById("regl").appendChild(canvas);
}

const maxY = (data.data as Float32Array).reduce(
  (agg, val) => Math.max(agg, val),
  0
);

// compute nice bin boundaries
const binConfigX = bin({ maxBins: MAXBINS_X, extent: [0, NUM_POINTS - 1] });
const binConfigY = bin({ maxBins: MAXBINS_Y, extent: [0, maxY] });

compute(data, binConfigX, binConfigY, canvas).then(heatmapData => {
  vegaHeatmap(heatmapData, binConfigX, binConfigY);
});
