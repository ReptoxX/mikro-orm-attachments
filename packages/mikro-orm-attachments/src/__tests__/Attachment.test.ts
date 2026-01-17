import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Attachment } from "../Attachment";
import { ATTACHMENT_LOADED, ATTACHMENT_FILE, ATTACHMENT_DISK, ATTACHMENT_FN_SAVE, ATTACHMENT_FN_LOAD, ATTACHMENT_FN_PROCESS } from "../symbols";
import type { AttachmentBase, ImageAttachment } from "../typings";
import type { Disk } from "flydrive";

describe("Attachment", () => {
	let mockDisk: Disk;
	let mockFile: File;

	beforeEach(() => {
		mockDisk = {
			getUrl: mock((path: string) => Promise.resolve(`https://example.com/${path}`)),
			getSignedUrl: mock((path: string) => Promise.resolve(`https://example.com/signed/${path}`)),
			getBytes: mock((path: string) => Promise.resolve(new Uint8Array([1, 2, 3, 4]))),
			getStream: mock((path: string) => Promise.resolve(new ReadableStream())),
		} as unknown as Disk;

		mockFile = new File(["test content"], "test.txt", { type: "text/plain" });
	});

	describe("constructor", () => {
		it("should create attachment from File", () => {
			const att = new Attachment(mockFile);
			expect(att[ATTACHMENT_FILE]).toBe(mockFile);
			expect(att[ATTACHMENT_LOADED]).toBe(false);
		});

		it("should create attachment from AttachmentBase", () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: 100,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};
			const att = new Attachment(data);
			expect(att[ATTACHMENT_LOADED]).toBe(true);
		});
	});

	describe("fromFile", () => {
		it("should create attachment from file", () => {
			const att = Attachment.fromFile(mockFile);
			expect(att[ATTACHMENT_FILE]).toBe(mockFile);
			expect(att[ATTACHMENT_LOADED]).toBe(false);
		});
	});

	describe("ATTACHMENT_FN_LOAD", () => {
		it("should load attachment from data", () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: 100,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};
			const att = Attachment[ATTACHMENT_FN_LOAD](data);
			expect(att[ATTACHMENT_LOADED]).toBe(true);
		});
	});

	describe("ATTACHMENT_FN_SAVE", () => {
		it("should return data when loaded", () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: 100,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};
			const att = new Attachment(data);
			expect(att[ATTACHMENT_FN_SAVE]()).toEqual(data);
		});

		it("should return empty object when not loaded", () => {
			const att = new Attachment(mockFile);
			expect(att[ATTACHMENT_FN_SAVE]()).toEqual({});
		});
	});

	describe("ATTACHMENT_FN_PROCESS", () => {
		it("should process attachment data", () => {
			const att = new Attachment(mockFile);
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: 100,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};
			att[ATTACHMENT_FN_PROCESS](data);
			expect(att[ATTACHMENT_LOADED]).toBe(true);
		});

		it("should not process if already loaded", () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: 100,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};
			const att = new Attachment(data);
			const newData: AttachmentBase = {
				...data,
				name: "new",
			};
			att[ATTACHMENT_FN_PROCESS](newData);
			expect(att[ATTACHMENT_FN_SAVE]().name).toBe("test");
		});
	});

	describe("url", () => {
		it("should return URL for image attachment", () => {
			const data: ImageAttachment = {
				drive: "local",
				name: "test",
				extname: "jpg",
				size: 100,
				mimeType: "image/jpeg",
				path: "test/test.jpg",
				originalName: "test.jpg",
				variants: [],
				url: "https://example.com/test.jpg",
			};
			const att = new Attachment(data);
			att[ATTACHMENT_DISK] = mockDisk;
			expect(att.url()).toBe("https://example.com/test.jpg");
		});

		it("should return URL for variant", async () => {
			const data: ImageAttachment = {
				drive: "local",
				name: "test",
				extname: "jpg",
				size: 100,
				mimeType: "image/jpeg",
				path: "test/test.jpg",
				originalName: "test.jpg",
				variants: [
					{
						name: "thumbnail",
						extname: "webp",
						size: 50,
						mimeType: "image/webp",
						path: "test/thumbnail.webp",
					},
				],
				url: "https://example.com/test.jpg",
			};
			const att = new Attachment(data);
			att[ATTACHMENT_DISK] = mockDisk;
			const url = att.url("thumbnail");
			expect(mockDisk.getUrl).toHaveBeenCalledWith("test/thumbnail.webp");
		});

		it("should throw error if not loaded", () => {
			const att = new Attachment(mockFile);
			expect(() => att.url()).toThrow("Attachment is not processed");
		});
	});

	describe("preSignedUrl", () => {
		it("should return pre-signed URL for attachment", async () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: 100,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};
			const att = new Attachment(data);
			att[ATTACHMENT_DISK] = mockDisk;
			const url = await att.preSignedUrl();
			expect(mockDisk.getSignedUrl).toHaveBeenCalledWith("test/test.txt", undefined);
		});

		it("should return pre-signed URL for variant", async () => {
			const data: ImageAttachment = {
				drive: "local",
				name: "test",
				extname: "jpg",
				size: 100,
				mimeType: "image/jpeg",
				path: "test/test.jpg",
				originalName: "test.jpg",
				variants: [
					{
						name: "thumbnail",
						extname: "webp",
						size: 50,
						mimeType: "image/webp",
						path: "test/thumbnail.webp",
					},
				],
				url: "https://example.com/test.jpg",
			};
			const att = new Attachment(data);
			att[ATTACHMENT_DISK] = mockDisk;
			const options = { expiresIn: 3600 };
			await att.preSignedUrl("thumbnail", options);
			expect(mockDisk.getSignedUrl).toHaveBeenCalledWith("test/thumbnail.webp", options);
		});

		it("should throw error if variant not found", () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: 100,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};
			const att = new Attachment(data);
			att[ATTACHMENT_DISK] = mockDisk;
			expect(() => att.preSignedUrl("nonexistent" as any)).toThrow("Variant 'nonexistent' not found");
		});
	});

	describe("blurhash", () => {
		it("should return blurhash for image attachment", () => {
			const data: ImageAttachment = {
				drive: "local",
				name: "test",
				extname: "jpg",
				size: 100,
				mimeType: "image/jpeg",
				path: "test/test.jpg",
				originalName: "test.jpg",
				variants: [],
				url: "https://example.com/test.jpg",
				blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6.",
			};
			const att = new Attachment(data);
			expect(att.blurhash()).toBe("LGF5]+Yk^6#M@-5c,1J5@[or[Q6.");
		});

		it("should return undefined for non-image attachment", () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: 100,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};
			const att = new Attachment(data);
			expect(att.blurhash()).toBeUndefined();
		});
	});

	describe("getDisk", () => {
		it("should return disk instance", () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: 100,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};
			const att = new Attachment(data);
			att[ATTACHMENT_DISK] = mockDisk;
			expect(att.getDisk()).toBe(mockDisk);
		});
	});

	describe("getDrive", () => {
		it("should return drive name", () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: 100,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};
			const att = new Attachment(data);
			expect(att.getDrive()).toBe("local");
		});
	});

	describe("getBytes", () => {
		it("should return bytes for attachment", async () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: 100,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};
			const att = new Attachment(data);
			att[ATTACHMENT_DISK] = mockDisk;
			const bytes = await att.getBytes();
			expect(mockDisk.getBytes).toHaveBeenCalledWith("test/test.txt");
			expect(bytes).toBeInstanceOf(Uint8Array);
		});

		it("should return bytes for variant", async () => {
			const data: ImageAttachment = {
				drive: "local",
				name: "test",
				extname: "jpg",
				size: 100,
				mimeType: "image/jpeg",
				path: "test/test.jpg",
				originalName: "test.jpg",
				variants: [
					{
						name: "thumbnail",
						extname: "webp",
						size: 50,
						mimeType: "image/webp",
						path: "test/thumbnail.webp",
					},
				],
				url: "https://example.com/test.jpg",
			};
			const att = new Attachment(data);
			att[ATTACHMENT_DISK] = mockDisk;
			await att.getBytes("thumbnail" as any);
			expect(mockDisk.getBytes).toHaveBeenCalledWith("test/thumbnail.webp");
		});
	});

	describe("getBuffer", () => {
		it("should return buffer for attachment", async () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: 100,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};
			const att = new Attachment(data);
			att[ATTACHMENT_DISK] = mockDisk;
			const buffer = await att.getBuffer();
			expect(buffer).toBeInstanceOf(Buffer);
		});
	});

	describe("getStream", () => {
		it("should return stream for attachment", async () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: 100,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};
			const att = new Attachment(data);
			att[ATTACHMENT_DISK] = mockDisk;
			const stream = await att.getStream();
			expect(mockDisk.getStream).toHaveBeenCalledWith("test/test.txt");
			expect(stream).toBeInstanceOf(ReadableStream);
		});
	});

	describe("getMimeType", () => {
		it("should return mime type for attachment", () => {
			const data: AttachmentBase = {
				drive: "local",
				name: "test",
				extname: "txt",
				size: 100,
				mimeType: "text/plain",
				path: "test/test.txt",
				originalName: "test.txt",
				variants: [],
			};
			const att = new Attachment(data);
			expect(att.getMimeType()).toBe("text/plain");
		});

		it("should return mime type for variant", () => {
			const data: ImageAttachment = {
				drive: "local",
				name: "test",
				extname: "jpg",
				size: 100,
				mimeType: "image/jpeg",
				path: "test/test.jpg",
				originalName: "test.jpg",
				variants: [
					{
						name: "thumbnail",
						extname: "webp",
						size: 50,
						mimeType: "image/webp",
						path: "test/thumbnail.webp",
					},
				],
				url: "https://example.com/test.jpg",
			};
			const att = new Attachment(data);
			expect(att.getMimeType("thumbnail" as any)).toBe("image/webp");
		});
	});

	describe("toJSON", () => {
		it("should return JSON representation", () => {
			const data: ImageAttachment = {
				drive: "local",
				name: "test",
				extname: "jpg",
				size: 100,
				mimeType: "image/jpeg",
				path: "test/test.jpg",
				originalName: "test.jpg",
				variants: [],
				url: "https://example.com/test.jpg",
				blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6.",
			};
			const att = new Attachment(data);
			att[ATTACHMENT_DISK] = mockDisk;
			const json = att.toJSON();
			expect(json).toEqual({
				url: "https://example.com/test.jpg",
				blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6.",
			});
		});
	});
});
