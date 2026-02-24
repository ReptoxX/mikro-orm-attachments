import { $ } from "bun";
import { existsSync } from "fs";
import { rm } from "fs/promises";

const outDir = "./dist";

if (existsSync(outDir)) {
	await rm(outDir, { recursive: true });
}

await $`bun build ./src/index.ts --outdir ${outDir} --format esm --target node --minify --sourcemap --external @mikro-orm/core --external @mikro-orm/decorators --external sharp --external blurhash --external flydrive --external file-type --external uuid --outfile ${outDir}/index.js`;

await $`bunx tsc --emitDeclarationOnly --declaration --declarationMap --outDir ${outDir}`;

console.log("Build completed successfully!");
