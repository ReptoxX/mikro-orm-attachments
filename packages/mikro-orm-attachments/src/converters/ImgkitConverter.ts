import { fileTypeFromBuffer } from "file-type";
import { type TransformOptions, transform } from "imgkit";

import type { ConvertInput, ConvertOutput } from "../types/converter";
import { BaseConverter } from "./BaseConverter";

interface ImgkitConverterOptions extends TransformOptions {}

export class ImgkitConverter extends BaseConverter<ConvertInput, ConvertOutput> {
	constructor(private readonly options?: ImgkitConverterOptions) {
		super();
	}
	async supports(input: ConvertInput): Promise<boolean> {
		return input.mimeType.startsWith("image/");
	}

	async handle(input: ConvertInput): Promise<ConvertOutput> {
		const image = await transform(input.buffer, this.options ?? {});
		const fileType = await fileTypeFromBuffer(new Uint8Array(image.buffer));

		return {
			buffer: image,
			mimeType: fileType?.mime ?? input.mimeType,
			extname: fileType?.ext ?? input.extname,
		};
	}
}
