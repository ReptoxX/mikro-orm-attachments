import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AttachmentConverter } from "../converters/AttachmentConverter";
import { Attachment } from "../Attachment";
import { ATTACHMENT_LOADED, ATTACHMENT_FILE, ATTACHMENT_FN_PROCESS } from "../symbols";
import type { AttachmentBase, AttachmentOptions, VariantSpec } from "../typings";
import type { Disk } from "flydrive";
import type { DriverContract } from "flydrive/types";
import { ImageConverter } from "../converters/ImageConverter";

describe("AttachmentConverter", () => {
	let mockDisk: Disk;
	let mockFile: File;
	let attachment: Attachment;
	let entity: any;
	let config: AttachmentOptions<any, any>;
	let modelOptions: any;

	beforeEach(() => {
		mockDisk = {
			put: mock((key: string, buffer: Buffer) => Promise.resolve()),
			getUrl: mock((path: string) => Promise.resolve(`https://example.com/${path}`)),
		} as unknown as Disk;

		mockFile = new File(["test content"], "test.txt", { type: "text/plain" });
		attachment = new Attachment(mockFile);
		entity = { id: 1, name: "TestEntity" };
		config = {
			drivers: {},
			defaultDriver: "local",
			converters: [new ImageConverter()],
		};
		modelOptions = {
			folder: "attachments",
		};
	});

	describe("constructor", () => {
		it("should create converter with file attachment", () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: modelOptions,
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
			expect(converter).toBeInstanceOf(AttachmentConverter);
		});

		it("should throw error if attachment is already processed", () => {
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
			const processedAtt = new Attachment(data);
			expect(() => {
				new AttachmentConverter(processedAtt, {
					disk: mockDisk,
					options: modelOptions,
					config,
					entity,
					columnName: "file",
					diskName: "local",
				});
			}).toThrow("Attachment already processed");
		});
	});

	describe("done", () => {
		it("should process attachment data", () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: modelOptions,
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
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
			converter.done(data);
			expect(attachment[ATTACHMENT_LOADED]).toBe(true);
		});
	});

	describe("generateKey", () => {
		it("should generate key with folder", () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: { folder: "uploads" },
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
			const key = converter.generateKey("test", "file.txt");
			expect(key).toContain("uploads");
			expect(key).toContain("test");
			expect(key).toContain("file.txt");
		});

		it("should replace placeholders in folder path", () => {
			entity.id = 123;
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: { folder: "uploads/:id" },
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
			const key = converter.generateKey("test", "file.txt");
			expect(key).toContain("123");
		});

		it("should throw error if placeholder value is missing", () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: { folder: "uploads/:missing" },
				config,
				entity: {},
				columnName: "file",
				diskName: "local",
			});
			expect(() => converter.generateKey("test", "file.txt")).toThrow("Missing value for Attachment path");
		});
	});

	describe("normalizeFileName", () => {
		it("should normalize file name", () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: modelOptions,
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
			const normalized = converter.normalizeFileName("Test File (1).txt");
			expect(normalized).toBe("test_file__1_.txt");
		});

		it("should encode special characters", () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: modelOptions,
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
			const normalized = converter.normalizeFileName("файл.txt");
			expect(normalized).toContain("%");
		});
	});

	describe("fileToBuffer", () => {
		it("should convert file to buffer", async () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: modelOptions,
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
			const buffer = await converter.fileToBuffer();
			expect(buffer).toBeInstanceOf(Buffer);
			expect(buffer.length).toBeGreaterThan(0);
		});

		it("should cache buffer", async () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: modelOptions,
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
			const buffer1 = await converter.fileToBuffer();
			const buffer2 = await converter.fileToBuffer();
			expect(buffer1).toBe(buffer2);
		});
	});

	describe("getFileName", () => {
		it("should return normalized original name when rename is false", () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: modelOptions,
				config: { ...config, rename: false },
				entity,
				columnName: "file",
				diskName: "local",
			});
			const fileName = converter.getFileName();
			expect(fileName).toBe("test.txt");
		});

		it("should return UUID when rename is true", () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: modelOptions,
				config: { ...config, rename: true },
				entity,
				columnName: "file",
				diskName: "local",
			});
			const fileName = converter.getFileName();
			expect(fileName).toMatch(/^[0-9a-f-]+$/i);
		});

		it("should use custom rename function", () => {
			const customRename = mock((file: File, columnName: string, entity: any) => "custom-name");
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: modelOptions,
				config: { ...config, rename: customRename },
				entity,
				columnName: "file",
				diskName: "local",
			});
			const fileName = converter.getFileName();
			expect(customRename).toHaveBeenCalledWith(mockFile, "file", entity);
			expect(fileName).toBe("custom-name");
		});
	});

	describe("getFileType", () => {
		it("should detect file type", async () => {
			const imageFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "test.png", { type: "image/png" });
			const imageAtt = new Attachment(imageFile);
			const converter = new AttachmentConverter(imageAtt, {
				disk: mockDisk,
				options: modelOptions,
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
			const fileType = await converter.getFileType();
			expect(fileType).toBeDefined();
		});
	});

	describe("analyseFile", () => {
		it("should analyze file and set fileInfo", async () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: modelOptions,
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
			await converter.analyseFile();
		});
	});

	describe("uploadFile", () => {
		it("should upload file to disk", async () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: modelOptions,
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
			const buffer = Buffer.from("test content");
			await converter.uploadFile("test/file.txt", buffer);
			expect(mockDisk.put).toHaveBeenCalledWith("test/file.txt", buffer);
		});
	});

	describe("pickConverter", () => {
		it("should pick converter that supports file", async () => {
			const imageFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "test.png", { type: "image/png" });
			const imageAtt = new Attachment(imageFile);
			const converter = new AttachmentConverter(imageAtt, {
				disk: mockDisk,
				options: modelOptions,
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
			await converter.analyseFile();
			const variant: VariantSpec = {};
			const picked = await converter.pickConverter("thumbnail", variant);
			expect(picked).toBeInstanceOf(ImageConverter);
		});

		it("should return null if no converter supports file", async () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: modelOptions,
				config: { ...config, converters: [] },
				entity,
				columnName: "file",
				diskName: "local",
			});
			await converter.analyseFile();
			const variant: VariantSpec = {};
			const picked = await converter.pickConverter("thumbnail", variant);
			expect(picked).toBeNull();
		});

		it("should throw error if file info not found", async () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: modelOptions,
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
			const variant: VariantSpec = {};
			await expect(converter.pickConverter("thumbnail", variant)).rejects.toThrow("File info not found");
		});
	});

	describe("process", () => {
		it("should process attachment without variants", async () => {
			const converter = new AttachmentConverter(attachment, {
				disk: mockDisk,
				options: modelOptions,
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
			await converter.process();
			expect(attachment[ATTACHMENT_LOADED]).toBe(true);
			expect(mockDisk.put).toHaveBeenCalled();
		});

		it("should process attachment with variants", async () => {
			const imageFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "test.png", { type: "image/png" });
			const imageAtt = new Attachment(imageFile);
			const converter = new AttachmentConverter(imageAtt, {
				disk: mockDisk,
				options: {
					...modelOptions,
					variants: {
						thumbnail: { resize: { width: 100, height: 100 } },
					},
				},
				config,
				entity,
				columnName: "file",
				diskName: "local",
			});
			await converter.process();
			expect(attachment[ATTACHMENT_LOADED]).toBe(true);
		});
	});
});
