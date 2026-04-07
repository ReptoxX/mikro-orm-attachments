import { defineConfig } from "bunup";

export default defineConfig({
	entry: ["./src/index.ts", "./src/converters/*.ts", "./src/metadata/*.ts"],
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
