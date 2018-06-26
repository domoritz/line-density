import { CHART_WIDTH } from "./constants";
import embed from "vega-embed";

export default function(data) {
  const values = data
    .slice(0, 5)
    .map((series, group) =>
      [].slice.call(series).map((value, time) => ({ group, time, value }))
    )
    .reduce((acc, val) => acc.concat(val), []);

  const encoding: any = {
    color: { field: "group", type: "nominal", title: "Series" },
    x: { field: "time", type: "quantitative", title: "Time" },
    y: { field: "value", type: "quantitative", title: "Value" }
  };

  embed(
    document.getElementById("lines"),
    {
      title: "Sample of the first 5 time series",
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
