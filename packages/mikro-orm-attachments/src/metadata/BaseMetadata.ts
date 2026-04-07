import type { ConvertInput } from "../types/converter";

export abstract class BaseMetadata<TMetadata> {
	abstract metadata(input: ConvertInput): Promise<TMetadata>;
}
