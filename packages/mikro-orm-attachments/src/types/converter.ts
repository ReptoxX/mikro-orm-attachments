import type { VariantSpec } from "../typings";

export type BlurhashOptions = {
	enabled: boolean;
	componentX: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
	componentY: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
};

export interface ConvertInput {
	buffer: Buffer;
	size: number;
	mimeType: string;
	variantName?: string;
	variant?: VariantSpec;
	extname: string;
}

export interface ConvertOutput {
	buffer: Buffer;
	mimeType: string;
	extname: string;
}

export interface ConvertMetadata {
	dimension: {
		width: number;
		height: number;
	};
}
