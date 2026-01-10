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
