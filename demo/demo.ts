import { bin } from "vega-statistics";
import compute from "../src";
import { generateData } from "./data-gen";
import { lineChart } from "./vega-linechart";
import { heatmap } from "./vega-heatmap";

const config: Partial<{
  series: number;
  points: number;
  binsx: number;
  binsy: number;
}> = {};

document
  .querySelectorAll(".input-form input")
  .forEach((el: HTMLInputElement) => {
    const update = () => {
      let value = +el.value;

      config[el.name] = value;
      const print = document.getElementById(`${el.name}-show`);
      if (print) {
        print.innerText = String(value);
      }
    };
    el.oninput = update;
    update();
  });

(document.getElementById("run") as HTMLButtonElement).onclick = event => {
  run();
  event.preventDefault();
};

function run() {
  const { series, points, binsx, binsy } = config;

  let start = Date.now();
  const data = generateData(series, points);
  document.getElementById("datatime").innerText = `${(Date.now() - start) /
    1000} seconds`;

  lineChart(data);

  let canvas;
  document.getElementById("regl").innerText = "";
  if ((document.getElementById("debug") as HTMLInputElement).checked) {
    canvas = document.createElement("canvas");
    document.getElementById("regl").appendChild(canvas);
  }

  const maxY = (data.data as Float32Array).reduce(
    (agg, val) => Math.max(agg, val),
    0
  );

  // compute nice bin boundaries
  const binConfigX = bin({ maxbins: binsx, extent: [0, points - 1] });
  const binConfigY = bin({ maxbins: binsy, extent: [0, maxY] });

  start = Date.now();
  compute(data, binConfigX, binConfigY, canvas).then(heatmapData => {
    document.getElementById("computetime").innerText = `${(Date.now() - start) /
      1000} seconds`;
    heatmap(heatmapData, binConfigX, binConfigY);
  });
}

run();
