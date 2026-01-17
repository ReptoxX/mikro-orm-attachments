import { describe, it, expect, beforeEach, mock } from "bun:test";
import { ImageConverter } from "../converters/ImageConverter";
import type { ConvertInput, ConvertOutput, ImageConverterOptions } from "../types/converter";

describe("ImageConverter", () => {
	let converter: ImageConverter;
	let mockSharp: any;

	beforeEach(() => {
		converter = new ImageConverter();
		mockSharp = {
			withMetadata: mock(() => mockSharp),
			autoOrient: mock(() => mockSharp),
			resize: mock(() => mockSharp),
			toFormat: mock(() => mockSharp),
			toBuffer: mock(() => Promise.resolve(Buffer.from("converted image"))),
		};
	});

	describe("supports", () => {
		it("should support image mime types", async () => {
			const input: ConvertInput = {
				buffer: Buffer.from("test"),
				size: 100,
				mimeType: "image/png",
				variantName: "thumbnail",
				variant: {},
				extname: "png",
			};
			const result = await converter.supports(input, {});
			expect(result).toBe(true);
		});

		it("should not support non-image mime types", async () => {
			const input: ConvertInput = {
				buffer: Buffer.from("test"),
				size: 100,
				mimeType: "text/plain",
				variantName: "thumbnail",
				variant: {},
				extname: "txt",
			};
			const result = await converter.supports(input, {});
			expect(result).toBe(false);
		});

		it("should support various image formats", async () => {
			const formats = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
			for (const mimeType of formats) {
				const input: ConvertInput = {
					buffer: Buffer.from("test"),
					size: 100,
					mimeType,
					variantName: "thumbnail",
					variant: {},
					extname: "jpg",
				};
				const result = await converter.supports(input, {});
				expect(result).toBe(true);
			}
		});
	});

	describe("handle", () => {
		it("should convert image with default options", async () => {
			const input: ConvertInput = {
				buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
				size: 100,
				mimeType: "image/png",
				variantName: "thumbnail",
				variant: {},
				extname: "png",
			};
			const options: ImageConverterOptions = {};
			const result = await converter.handle(input, options);
			expect(result).toHaveProperty("buffer");
			expect(result).toHaveProperty("mimeType");
			expect(result).toHaveProperty("extname");
		});

		it("should convert image with resize options", async () => {
			const input: ConvertInput = {
				buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
				size: 100,
				mimeType: "image/png",
				variantName: "thumbnail",
				variant: {},
				extname: "png",
			};
			const options: ImageConverterOptions = {
				resize: { width: 200, height: 200 },
			};
			const result = await converter.handle(input, options);
			expect(result).toHaveProperty("buffer");
		});

		it("should convert image with format option", async () => {
			const input: ConvertInput = {
				buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
				size: 100,
				mimeType: "image/png",
				variantName: "thumbnail",
				variant: {},
				extname: "png",
			};
			const options: ImageConverterOptions = {
				format: "webp",
			};
			const result = await converter.handle(input, options);
			expect(result).toHaveProperty("buffer");
		});

		it("should convert image with format object", async () => {
			const input: ConvertInput = {
				buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
				size: 100,
				mimeType: "image/png",
				variantName: "thumbnail",
				variant: {},
				extname: "png",
			};
			const options: ImageConverterOptions = {
				format: {
					format: "jpeg",
					options: { quality: 80 },
				} as any,
			};
			const result = await converter.handle(input, options);
			expect(result).toHaveProperty("buffer");
		});

		it("should handle autoOrient option", async () => {
			const input: ConvertInput = {
				buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
				size: 100,
				mimeType: "image/png",
				variantName: "thumbnail",
				variant: {},
				extname: "png",
			};
			const options: ImageConverterOptions = {
				autoOrient: true,
			};
			const result = await converter.handle(input, options);
			expect(result).toHaveProperty("buffer");
		});

		it("should handle autoOrient disabled", async () => {
			const input: ConvertInput = {
				buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
				size: 100,
				mimeType: "image/png",
				variantName: "thumbnail",
				variant: {},
				extname: "png",
			};
			const options: ImageConverterOptions = {
				autoOrient: false,
			};
			const result = await converter.handle(input, options);
			expect(result).toHaveProperty("buffer");
		});

		it("should handle numeric resize", async () => {
			const input: ConvertInput = {
				buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
				size: 100,
				mimeType: "image/png",
				variantName: "thumbnail",
				variant: {},
				extname: "png",
			};
			const options: ImageConverterOptions = {
				resize: 200,
			};
			const result = await converter.handle(input, options);
			expect(result).toHaveProperty("buffer");
		});

		it("should preserve mime type when file type detection fails", async () => {
			const input: ConvertInput = {
				buffer: Buffer.from("invalid"),
				size: 100,
				mimeType: "image/png",
				variantName: "thumbnail",
				variant: {},
				extname: "png",
			};
			const options: ImageConverterOptions = {};
			const result = await converter.handle(input, options);
			expect(result.mimeType).toBeDefined();
		});
	});
});
