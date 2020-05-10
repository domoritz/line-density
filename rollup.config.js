import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";

export default {
  input: "build/index.js",
  output: {
    file: "build/line-density.js",
    format: "umd",
    sourcemap: true,
    name: "density",
    exports: "named",
  },
  plugins: [nodeResolve(), commonjs()],
};
