import { type ImageMetadata, metadata } from "imgkit";

import type { ConvertInput } from "../types/converter";
import { BaseMetadata } from "./BaseMetadata";

export class ImgkitMetadata<T extends ImageMetadata> extends BaseMetadata<T> {
	async metadata(input: ConvertInput): Promise<T> {
		if (input.mimeType.startsWith("image/")) {
			const meta = await metadata(input.buffer);
			return meta as T;
		} else {
			return {} as T;
		}
	}
}
