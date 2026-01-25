import type { Converter, ConvertInput, ConverterOptions, ConvertOutput } from "mikro-orm-attachments";

export class PdfConverter implements Converter {
	async supports(input: ConvertInput, options: ConverterOptions): Promise<boolean> {
		return input.mimeType === "application/pdf";
	}

	async handle(input: ConvertInput, options: ConverterOptions): Promise<ConvertOutput> {
		return {
			buffer: input.buffer,
			mimeType: input.mimeType,
			extname: input.extname,
		};
	}
}
