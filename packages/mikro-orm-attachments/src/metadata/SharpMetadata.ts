import type * as Sharp from "sharp";

import type { ConvertInput } from "../types/converter";
import { use } from "../utils/helpers";
import { BaseMetadata } from "./BaseMetadata";

class SharpMetadata<T extends Sharp.Metadata> extends BaseMetadata<T> {
	async metadata(input: ConvertInput): Promise<T> {
		const sharp: typeof Sharp.default = await use("sharp");
		const image = sharp(input.buffer);
		const metadata = await image.metadata();
		return metadata as T;
	}
}
