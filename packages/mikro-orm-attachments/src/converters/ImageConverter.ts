import { fileTypeFromBuffer } from "file-type";
import { Converter, ConverterOptions, ConvertInput, ConvertOutput, ImageConverterOptions } from "../types/converter";
import { use } from "../utils/helpers";

export class ImageConverter implements Converter {
	async supports(input: ConvertInput, options: ConverterOptions): Promise<boolean> {
		return input.mimeType.startsWith("image/");
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
