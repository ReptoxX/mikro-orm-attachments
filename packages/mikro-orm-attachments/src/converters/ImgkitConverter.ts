import { fileTypeFromBuffer } from "file-type";
import type * as ImgKit from "imgkit";

import type { Converter, ConverterOptions, ConvertInput, ConvertMetadata, ConvertOutput, ImageConverterOptions } from "../types/converter";
import { use } from "../utils/helpers";

export class ImgkitConverter implements Converter {
	async supports(input: ConvertInput, _options: ConverterOptions): Promise<boolean> {
		return input.mimeType.startsWith("image/");
	}

	async metadata(input: ConvertInput, _options: ConverterOptions): Promise<ConvertMetadata> {
		const imgkit = await use("imgkit");
		const metadata: ImgKit.ImageMetadata = await imgkit.metadata(input.buffer);
		return {
			dimension: {
				width: metadata.width,
				height: metadata.height,
			},
		};
	}

	async handle(input: ConvertInput, options?: ImageConverterOptions): Promise<ConvertOutput> {
		const imgkit: typeof ImgKit = await use("imgkit");
		const resize = options?.resize || {};
		let format = options?.format || "webp";
		const autoOrient = options?.autoOrient || true;
		let formatOptions: unknown = {};

		if (typeof format !== "string") {
			formatOptions = format?.options;
			format = format.format;
		}

		const transformOptions: ImgKit.TransformOptions = {};
		if (options?.resize) {
			transformOptions.resize =
				typeof options.resize === "number"
					? { width: options.resize }
					: {
							width: options.resize.width,
							height: options.resize.height,
							fit: options.resize.fit,
						};
		}
		if (options?.format) {
			transformOptions.output = { format: options.format === "jpg" ? "jpeg" : options.format };
		}

		const image = imgkit.transform(input.buffer, transformOptions);

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
