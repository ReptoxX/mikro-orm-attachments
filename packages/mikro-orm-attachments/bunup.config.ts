import { defineConfig } from "bunup";
import { copy } from "bunup/plugins";
export default defineConfig({
	entry: "./src/index.ts",
	format: "esm",
	plugins: [copy(["../../README.md", "CHANGELOG.md"])],
	exports: true,
	unused: true,
	clean: true,
	minify: true,
	dts: {
		inferTypes: true,
		tsgo: true,
	},
});
