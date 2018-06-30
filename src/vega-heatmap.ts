import embed from "vega-embed";
import { CHART_WIDTH, CHART_HEIGHT } from "./constants";
import { DEFAULT_REQUIRED_CHANNEL_MAP } from "vega-lite/build/src/validate";

export default function(heatmapData) {
  embed(
    document.getElementById("heat"),
    {
      $schema: "https://vega.github.io/schema/vega/v4.json",
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      padding: 5,

      title: {
        text: "Line Heatmap",
        anchor: "middle",
        fontSize: 16,
        frame: "group",
        offset: 4
      },

      signals: [
        {
          name: "palette",
          value: "Viridis",
          bind: {
            input: "select",
            options: [
              "Viridis",
              "Magma",
              "Inferno",
              "Plasma",
              "Blues",
              "Greens",
              "Greys",
              "Purples",
              "Reds",
              "Oranges",
              "BlueOrange",
              "BrownBlueGreen",
              "PurpleGreen",
              "PinkYellowGreen",
              "PurpleOrange",
              "RedBlue",
              "RedGrey",
              "RedYellowBlue",
              "RedYellowGreen",
              "BlueGreen",
              "BluePurple",
              "GreenBlue",
              "OrangeRed",
              "PurpleBlueGreen",
              "PurpleBlue",
              "PurpleRed",
              "RedPurple",
              "YellowGreenBlue",
              "YellowGreen",
              "YellowOrangeBrown",
              "YellowOrangeRed"
            ]
          }
        },
        {
          name: "reverse",
          value: false,
          bind: { input: "checkbox" }
        }
      ],

      data: [
        {
          name: "table",
          values: heatmapData
        }
      ],

      scales: [
        {
          name: "x",
          type: "band",
          domain: { data: "table", field: "x" },
          range: "width"
        },
        {
          name: "y",
          type: "band",
          domain: { data: "table", field: "y" },
          range: "height",
          reverse: true
        },
        {
          name: "color",
          type: "sequential",
          range: { scheme: { signal: "palette" } },
          domain: { data: "table", field: "value" },
          reverse: { signal: "reverse" },
          zero: false,
          nice: true
        }
      ],

      axes: [
        {
          orient: "bottom",
          scale: "x",
          domain: false,
          title: "Time",
          labelOverlap: true
        },
        { orient: "left", scale: "y", domain: false, title: "Value" }
      ],

      legends: [
        {
          fill: "color",
          type: "gradient",
          title: "Density",
          titleFontSize: 12,
          gradientLength: { signal: "height - 16" }
        }
      ],

      marks: [
        {
          type: "rect",
          from: { data: "table" },
          encode: {
            enter: {
              x: { scale: "x", field: "x" },
              y: { scale: "y", field: "y" },
              width: { scale: "x", band: 1 },
              height: { scale: "y", band: 1 },
              tooltip: { signal: "datum" }
            },
            update: {
              fill: { scale: "color", field: "value" }
            }
          }
        }
      ]
    },
    { defaultStyle: true }
  );
}
