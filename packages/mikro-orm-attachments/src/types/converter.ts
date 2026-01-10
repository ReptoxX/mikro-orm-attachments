import { VariantSpec } from "../typings";

export interface Converter {
	supports(input: ConvertInput, options: ConverterOptions): Promise<boolean>;
	handle(input: ConvertInput, options: ConverterOptions): Promise<ConvertOutput>;
}

export type BlurhashOptions = {
	enabled: boolean;
	componentX: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
	componentY: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
};

export interface ImageConverterOptions extends ConverterOptions {}

export interface ConvertInput {
	buffer: Buffer;
	size: number;
	mimeType: string;
	variantName: string;
	variant: VariantSpec;
	extname: string;
}

export interface ConvertOutput {
	buffer: Buffer;
	mimeType: string;
	extname: string;
}

type jpeg = {
	format: "jpeg";
	options?: {
		quality?: number;
		progressive?: boolean;
		chromaSubsampling?: string;
		optimiseCoding?: boolean;
		optimizeCoding?: boolean;
		mozjpeg?: boolean;
		trellisQuantisation?: boolean;
		overshootDeringing?: boolean;
		optimiseScans?: boolean;
		optimizeScans?: boolean;
		quantisationTable?: number;
		quantizationTable?: number;
		force?: boolean;
	};
};

type png = {
	format: "png";
	options?: {
		quality?: number;
		progressive?: boolean;
		compressionLevel?: number;
		adaptiveFiltering?: boolean;
		palette?: boolean;
		effort?: number;
		colours?: number;
		colors?: number;
		dither?: number;
		force?: boolean;
	};
};

type gif = {
	format: "gif";
	options?: {
		reuse?: boolean;
		progressive?: boolean;
		colours?: number;
		colors?: number;
		effort?: number;
		dither?: number;
		interFrameMaxError?: number;
		interPaletteMaxError?: number;
		loop?: number;
		delay?: number | number[];
		force?: boolean;
	};
};

type webp = {
	format: "webp";
	options?: {
		quality?: number;
		alphaQuality?: number;
		lossless?: boolean;
		nearLossless?: boolean;
		smartSubsample?: boolean;
		preset?: string;
		effort?: number;
		loop?: number;
		delay?: number | number[];
		minSize?: boolean;
		mixed?: boolean;
		force?: boolean;
	};
};

type avif = {
	format: "avif";
	options?: {
		quality?: number;
		lossless?: boolean;
		effort?: number;
		chromaSubsampling?: string;
		bitdepth?: number;
	};
};

type heif = {
	format: "heif";
	options?: {
		compression?: string;
		quality?: number;
		lossless?: boolean;
		effort?: number;
		chromaSubsampling?: string;
		bitdepth?: number;
	};
};

export type ConverterOptions = {
	resize?:
		| number
		| {
				width?: number;
				height?: number;
				fit?: "contain" | "cover" | "fill" | "inside" | "outside";
				position?: string;
				background?:
					| string
					| {
							r: number;
							g: number;
							b: number;
							alpha: number;
					  };
				kernel?: string;
				withoutEnlargement?: boolean;
				withoutReduction?: boolean;
				fastShrinkOnLoad?: boolean;
		  };
	format?: "jpeg" | "jpg" | "png" | "gif" | "webp" | "avif" | "heif" | "tiff" | "raw" | jpeg | png | gif | webp | avif | heif;
	autoOrient?: boolean;
	blurhash?: boolean | BlurhashOptions;
	startTime?: number;
	startPage?: number;
};
