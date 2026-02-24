import { defineConfig } from "bunup";

export default defineConfig({
	entry: "./src/index.ts",
	format: "esm",
	plugins: [],
	exports: true,
	unused: true,
	clean: true,
	minify: true,
	dts: {
		inferTypes: true,
		tsgo: true,
	},
});
