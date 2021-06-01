import nodeResolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import babel from "@rollup/plugin-babel";
import { terser } from "rollup-plugin-terser";

import { name } from "./package.json";

export default [
  {
    input: "build/index.js",
    output: [
      {
        exports: "named",
        file: `esm/${name}.esm.js`,
        format: "esm",
      },
      {
        exports: "named",
        file: `lib/${name}.cjs.js`,
        format: "cjs",
      },
    ],
    external: (id) => id.includes("@babel/runtime"),
    plugins: [
      nodeResolve({
        mainFields: ["module", "main"],
      }),
      commonjs({
        include: "node_modules/**",
      }),
      babel({
        exclude: "node_modules/**",
        babelHelpers: "runtime",
        extensions: [".js", ".ts", ".jsx", "tsx"],
      }),
      terser(),
    ],
  },
];
