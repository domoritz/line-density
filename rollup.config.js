import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";

export default {
  input: "build/index.js",
  output: {
    file: "build/line-density.js",
    format: "umd",
    sourcemap: true,
    name: "density",
    exports: "named"
  },
  plugins: [resolve(), commonjs()]
};
