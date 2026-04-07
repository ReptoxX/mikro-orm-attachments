import type * as ImgKit from "imgkit";

import type { ConvertInput } from "../types/converter";
import { use } from "../utils/helpers";
import { BaseMetadata } from "./BaseMetadata";

export class ImgkitMetadata<T extends ImgKit.ImageMetadata> extends BaseMetadata<T> {
	async metadata(input: ConvertInput): Promise<T> {
		const imgkit: typeof ImgKit = await use("imgkit");
		const metadata: ImgKit.ImageMetadata = await imgkit.metadata(input.buffer);
		return metadata as T;
	}
}
