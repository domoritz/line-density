import { bin } from "vega-statistics";
import compute, { heatmap, lineChart } from "./src";
import { MAXBINS_X, MAXBINS_Y, NUM_POINTS, NUM_SERIES } from "./src/constants";
import { generateData } from "./src/data-gen";

document.getElementById("count").innerText = `${NUM_SERIES}`;

const data = generateData(NUM_SERIES, NUM_POINTS);

lineChart(data);

let canvas;

document.getElementById("regl").innerText = "";
canvas = document.createElement("canvas");
document.getElementById("regl").appendChild(canvas);

const maxY = (data.data as Float32Array).reduce(
  (agg, val) => Math.max(agg, val),
  0
);

// compute nice bin boundaries
const binConfigX = bin({ maxBins: MAXBINS_X, extent: [0, NUM_POINTS - 1] });
const binConfigY = bin({ maxBins: MAXBINS_Y, extent: [0, maxY] });

compute(data, binConfigX, binConfigY, canvas).then(heatmapData => {
  heatmap(heatmapData, binConfigX, binConfigY);
});
