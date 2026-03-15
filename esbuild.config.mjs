import esbuild from "esbuild";

const production = process.argv[2] === "production";

const buildOptions = {
  entryPoints: ["main.ts"],
  bundle: true,
  outfile: "main.js",
  format: "cjs",
  target: "es2018",
  platform: "node",
  external: ["obsidian"],
  sourcemap: production ? false : "inline",
  minify: production,
  treeShaking: true
};

if (production) {
  await esbuild.build(buildOptions);
} else {
  const context = await esbuild.context(buildOptions);
  await context.watch();
  console.log("Watching... (press Ctrl+C to stop)");
}
