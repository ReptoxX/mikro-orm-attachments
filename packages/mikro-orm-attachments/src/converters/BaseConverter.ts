import type { ConvertInput, ConvertOutput } from "../types/converter";

export abstract class BaseConverter<TInput extends ConvertInput, TOutput extends ConvertOutput> {
	abstract supports(input: TInput): Promise<boolean>;
	abstract handle(input: TInput): Promise<TOutput>;
}
