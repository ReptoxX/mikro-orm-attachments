import Sharp from "sharp";

import type { ConvertInput } from "../types/converter";
import { BaseMetadata } from "./BaseMetadata";

class SharpMetadata<T extends Sharp.Metadata> extends BaseMetadata<T> {
	async metadata(input: ConvertInput): Promise<T> {
		const image = Sharp(input.buffer);
		const metadata = await image.metadata();
		return metadata as T;
	}
}
