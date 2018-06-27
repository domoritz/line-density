import { CHART_WIDTH } from "./constants";
import embed from "vega-embed";
import ndarray from "ndarray";

export default function(data: ndarray) {
  const values = [];

  const n = 10;

  for (let i = 0; i < n && i < data.shape[0]; i++) {
    for (let j = 0; j < data.shape[1]; j++) {
      values.push({ group: i, time: j, value: data.get(i, j) });
    }
  }

  const encoding: any = {
    color: { field: "group", type: "nominal", title: "Series" },
    x: { field: "time", type: "quantitative", title: "Time" },
    y: { field: "value", type: "quantitative", title: "Value" }
  };

  embed(
    document.getElementById("lines"),
    {
      title: `Sample of the first ${n} time series`,
      width: CHART_WIDTH,
      data: {
        values: values
      },
      mark: {
        type: "line",
        orient: "vertical"
      },
      encoding: {
        ...encoding,
        tooltip: Object.keys(encoding).map(k => encoding[k])
      }
    },
    { defaultStyle: true }
  );
}
