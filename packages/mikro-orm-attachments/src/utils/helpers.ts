import { createRequire } from "module";
const require = createRequire(import.meta.url);
import { encode } from "blurhash";
import { BlurhashOptions } from "../types/converter";

export async function use(module: string) {
	try {
		const result = await import(module);

		if (result.default) {
			return result.default;
		}

		return result;
	} catch (err) {
		throw new Error(`Module ${module} not found, please install it first.`);
	}
}

export function resolveModule<T>(candidates: string[]): T {
	for (const candidate of candidates) {
		try {
			return require(candidate) as T;
		} catch {
			continue;
		}
	}

	throw new Error(`Could not resolve any of the following modules: ${candidates.join(", ")}`);
}

export function imageToBlurhash(input: Buffer, options?: BlurhashOptions): Promise<string> {
	const { componentX, componentY } = options ?? { enabled: true, componentX: 4, componentY: 4 };

	return new Promise(async (resolve, reject) => {
		try {
			const sharp = await use("sharp");
			const { data: pixels, info: metadata } = await sharp(input).raw().ensureAlpha().toBuffer({ resolveWithObject: true });

			const blurhash = encode(new Uint8ClampedArray(pixels), metadata.width, metadata.height, componentX, componentY);

			return resolve(blurhash);
		} catch (error) {
			return reject(error);
		}
	});
}
