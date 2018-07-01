import { bin } from "vega-statistics";
import compute from "../src";
import { generateData } from "./data-gen";
import { lineChart } from "./vega-linechart";
import { heatmap } from "./vega-heatmap";

const NUM_SERIES = 1000;
const NUM_POINTS = 51;

const MAXBINS_X = 30;
const MAXBINS_Y = 10;

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
