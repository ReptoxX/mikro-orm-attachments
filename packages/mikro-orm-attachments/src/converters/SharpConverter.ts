import { fileTypeFromBuffer } from "file-type";
import type * as Sharp from "sharp";

import type { ConvertInput, ConvertOutput } from "../types/converter";
import { use } from "../utils/helpers";
import { BaseConverter } from "./BaseConverter";

type SharpFormat = "jpg" | "jpeg" | "png" | "webp" | "avif" | "gif" | "tiff" | "heic" | "heif";

interface SharpConverterOptions {
	resize?: Sharp.ResizeOptions;
	autoOrient?: boolean;
	format?:
		| SharpFormat
		| {
				format: SharpFormat;
				options: Sharp.PngOptions | Sharp.JpegOptions | Sharp.WebpOptions | Sharp.AvifOptions | Sharp.GifOptions | Sharp.TiffOptions | Sharp.HeifOptions;
		  };
}

export class SharpConverter extends BaseConverter<ConvertInput, ConvertOutput> {
	constructor(private readonly options?: SharpConverterOptions) {
		super();
	}

	async supports(input: ConvertInput): Promise<boolean> {
		return input.mimeType.startsWith("image/");
	}

	async handle(input: ConvertInput): Promise<ConvertOutput> {
		const sharp = await use("sharp");
		const resize = this.options?.resize || {};
		let format = this.options?.format || "webp";
		const autoOrient = this.options?.autoOrient || true;
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
