import { describe, it, expect, beforeEach } from "bun:test";
import { Attachment } from "../Attachment";
import { AttachmentSubscriber } from "../subscribers/AttachmentSubscriber";
import { ImageConverter } from "../converters/ImageConverter";
import { ATTACHMENT_FN_PROCESS, ATTACHMENT_DISK } from "../symbols";
import type { DriverContract } from "flydrive/types";
import type { AttachmentBase } from "../typings";

describe("Integration Tests", () => {
	let subscriber: AttachmentSubscriber<any, any>;
	let mockDriver: DriverContract;

	beforeEach(() => {
		mockDriver = {
			put: async () => {},
			getUrl: async (path: string) => `https://example.com/${path}`,
		} as unknown as DriverContract;

		subscriber = new AttachmentSubscriber({
			drivers: {
				local: mockDriver,
			},
			defaultDriver: "local",
			converters: [new ImageConverter()],
			variants: {
				thumbnail: {
					resize: { width: 100, height: 100 },
					format: "webp",
				},
				medium: {
					resize: { width: 500, height: 500 },
					format: "webp",
				},
			},
		});
	});

	describe("Full attachment lifecycle", () => {
		it("should create attachment from file and process it", async () => {
			const file = new File(["test content"], "test.txt", { type: "text/plain" });
			const attachment = Attachment.fromFile(file);
			expect(attachment).toBeInstanceOf(Attachment);

			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: file.size,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};

			attachment[ATTACHMENT_FN_PROCESS](data);
			expect(attachment.getDrive()).toBe("local");
			expect(attachment.getMimeType()).toBe("text/plain");
		});

		it("should handle attachment with variants", () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "jpg",
				size: 1000,
				mimeType: "image/jpeg",
				path: "test/test.jpg",
				originalName: "test.jpg",
				variants: [
					{
						name: "thumbnail",
						extname: "webp",
						size: 100,
						mimeType: "image/webp",
						path: "test/thumbnail.webp",
					},
					{
						name: "medium",
						extname: "webp",
						size: 500,
						mimeType: "image/webp",
						path: "test/medium.webp",
					},
				],
			};

			const attachment = new Attachment(data);
			expect(attachment.getMimeType()).toBe("image/jpeg");
			expect(attachment.getMimeType("thumbnail" as any)).toBe("image/webp");
			expect(attachment.getMimeType("medium" as any)).toBe("image/webp");
		});

		it("should serialize attachment to JSON", () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "jpg",
				size: 1000,
				mimeType: "image/jpeg",
				path: "test/test.jpg",
				originalName: "test.jpg",
				variants: [],
			};

			const attachment = new Attachment(data);
			attachment[ATTACHMENT_DISK] = {
				getUrl: () => Promise.resolve("https://example.com/test.jpg"),
			} as any;

			const json = attachment.toJSON();
			expect(json).toHaveProperty("url");
		});
	});

	describe("AttachmentSubscriber integration", () => {
		it("should provide AttachmentDecorator method", () => {
			const decorator = subscriber.AttachmentDecorator();
			expect(typeof decorator).toBe("function");
		});

		it("should handle variant normalization", () => {
			const variants = ["thumbnail", "medium"];
			const normalized = (subscriber as any)["#normalizeVariants"](variants);
			expect(normalized).toBeDefined();
			expect(normalized.thumbnail).toBeDefined();
			expect(normalized.medium).toBeDefined();
		});
	});
});
