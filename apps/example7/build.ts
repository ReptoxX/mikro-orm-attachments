await Bun.build({
	entrypoints: ["./src/index.ts"],
	compile: true,
	outdir: "./dist",
	format: "esm",
	minify: {
		syntax: true,
		whitespace: true,
	},
	external: [
		"tedious",
		"mariadb/callback",
		"better-sqlite3",
		"libsql",
		"pg-query-stream",
		"mysql2",
		"mysql",
		"oracledb",
	],
});
