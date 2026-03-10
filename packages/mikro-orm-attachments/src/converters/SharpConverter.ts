import { fileTypeFromBuffer } from "file-type";

import type { Converter, ConverterOptions, ConvertInput, ConvertMetadata, ConvertOutput, ImageConverterOptions } from "../types/converter";
import { use } from "../utils/helpers";

export class SharpConverter implements Converter {
	async supports(input: ConvertInput, _options: ConverterOptions): Promise<boolean> {
		return input.mimeType.startsWith("image/");
	}

	async metadata(input: ConvertInput, _options: ConverterOptions): Promise<ConvertMetadata> {
		const sharp = await use("sharp");
		const image = sharp(input.buffer);
		const metadata = await image.metadata();
		return {
			dimension: {
				width: metadata.width,
				height: metadata.height,
			},
		};
	}

	async handle(input: ConvertInput, options?: ImageConverterOptions): Promise<ConvertOutput> {
		const sharp = await use("sharp");
		const resize = options?.resize || {};
		let format = options?.format || "webp";
		const autoOrient = options?.autoOrient || true;
		let formatOptions: unknown = {};

		if (typeof format !== "string") {
			formatOptions = format?.options;
			format = format.format;
		}

		const image = sharp(input.buffer).withMetadata();

		if (autoOrient) {
			image.autoOrient();
		}

		const buffer = await image.resize(resize).toFormat(format, formatOptions).toBuffer();

		const fileType = await fileTypeFromBuffer(buffer);

		return {
			buffer: buffer,
			mimeType: fileType?.mime ?? input.mimeType,
			extname: fileType?.ext ?? input.extname,
		};
	}
}
