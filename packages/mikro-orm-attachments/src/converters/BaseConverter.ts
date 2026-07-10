import type { ConvertInput, ConvertOutput } from "../types/converter";

export abstract class BaseConverter<TInput extends ConvertInput, TOutput extends ConvertOutput> {
	abstract supports(input: TInput): Promise<boolean>;
	abstract handle(input: TInput): Promise<TOutput>;

	/**
	 * Fingerprint of this converter's configuration, used to detect whether a
	 * previously generated variant is still up to date with the current config.
	 * Override if the converter holds non-serializable options.
	 */
	configFingerprint(): string {
		return JSON.stringify(this);
	}
}
