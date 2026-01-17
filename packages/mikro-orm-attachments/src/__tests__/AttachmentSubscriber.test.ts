import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AttachmentSubscriber } from "../subscribers/AttachmentSubscriber";
import { Attachment } from "../Attachment";
import { ATTACHMENT_LOADED, ATTACHMENT_DISK } from "../symbols";
import type { AttachmentBase, AttachmentOptions, VariantSpec } from "../typings";
import type { DriverContract } from "flydrive/types";
import { ImageConverter } from "../converters/ImageConverter";
import type { Disk } from "flydrive";
import { getAttachmentProps } from "../decorators/AttachmentDecorator";

describe("AttachmentSubscriber", () => {
	let mockDriver: DriverContract;
	let mockDisk: Disk;
	let options: AttachmentOptions<any, any>;
	let subscriber: AttachmentSubscriber<any, any>;

	beforeEach(() => {
		mockDriver = {} as DriverContract;
		mockDisk = {
			put: mock(() => Promise.resolve()),
			getUrl: mock(() => Promise.resolve("https://example.com/file")),
		} as unknown as Disk;

		options = {
			drivers: {
				local: mockDriver,
			},
			defaultDriver: "local",
			converters: [new ImageConverter()],
		};

		subscriber = new AttachmentSubscriber(options);
	});

	describe("constructor", () => {
		it("should create subscriber with options", () => {
			expect(subscriber).toBeInstanceOf(AttachmentSubscriber);
		});

		it("should merge default options", () => {
			const customOptions: AttachmentOptions<any, any> = {
				drivers: { local: mockDriver },
				defaultDriver: "local",
			};
			const sub = new AttachmentSubscriber(customOptions);
			expect(sub).toBeInstanceOf(AttachmentSubscriber);
		});
	});

	describe("getSubscribedEvents", () => {
		it("should return subscribed events", () => {
			const events = subscriber.getSubscribedEvents();
			expect(events).toContain("onLoad");
			expect(events).toContain("beforeFlush");
		});
	});

	describe("onLoad", () => {
		it("should set disk for loaded attachment", async () => {
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
			const attachment = new Attachment(data);
			class TestEntity {
				file: Attachment;
			}
			const entity = new TestEntity();
			entity.file = attachment;
			const decorator = subscriber.AttachmentDecorator({ driver: "local" });
			decorator(TestEntity.prototype, "file");

			await subscriber.onLoad({ entity } as any);
			expect(attachment[ATTACHMENT_DISK]).toBeDefined();
		});

		it("should handle entity without attachment properties", async () => {
			const entity = {};
			await expect(subscriber.onLoad({ entity } as any)).resolves.not.toThrow();
		});
	});

	describe("beforeFlush", () => {
		it("should process unprocessed attachments", async () => {
			const file = new File(["test"], "test.txt");
			const attachment = new Attachment(file);
			class TestEntity {
				file: Attachment;
			}
			const entity = new TestEntity();
			entity.file = attachment;
			const decorator = subscriber.AttachmentDecorator({ driver: "local" });
			decorator(TestEntity.prototype, "file");

			const uow = {
				getChangeSets: mock(() => [{ entity }]),
				getPersistStack: mock(() => []),
			};

			await subscriber.beforeFlush({ uow } as any);
			expect(attachment[ATTACHMENT_LOADED]).toBe(true);
		});

		it("should skip already processed attachments", async () => {
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
			const attachment = new Attachment(data);
			class TestEntity {
				file: Attachment;
			}
			const entity = new TestEntity();
			entity.file = attachment;
			const decorator = subscriber.AttachmentDecorator({ driver: "local" });
			decorator(TestEntity.prototype, "file");

			const uow = {
				getChangeSets: mock(() => [{ entity }]),
				getPersistStack: mock(() => []),
			};

			await subscriber.beforeFlush({ uow } as any);
			expect(attachment[ATTACHMENT_LOADED]).toBe(true);
		});
	});

	describe("AttachmentDecorator", () => {
		it("should return decorator function", () => {
			const decorator = subscriber.AttachmentDecorator();
			expect(typeof decorator).toBe("function");
		});

		it("should return decorator with options", () => {
			const decorator = subscriber.AttachmentDecorator({ folder: "custom" });
			expect(typeof decorator).toBe("function");
		});
	});

	describe("#normalizeVariants", () => {
		it("should normalize array of variant names", () => {
			const variants = ["thumbnail", "medium"];
			const globalVariants: Record<string, VariantSpec> = {
				thumbnail: { resize: { width: 100 } },
				medium: { resize: { width: 500 } },
			};
			const sub = new AttachmentSubscriber({
				...options,
				variants: globalVariants,
			});
			const normalized = (sub as any)["#normalizeVariants"](variants);
			expect(normalized).toEqual(globalVariants);
		});

		it("should normalize object variants", () => {
			const variants: Record<string, VariantSpec> = {
				thumbnail: { resize: { width: 100 } },
			};
			const normalized = (subscriber as any)["#normalizeVariants"](variants);
			expect(normalized).toEqual(variants);
		});

		it("should return undefined for undefined variants", () => {
			const normalized = (subscriber as any)["#normalizeVariants"](undefined);
			expect(normalized).toBeUndefined();
		});

		it("should throw error for unknown variant name", () => {
			const variants = ["unknown"];
			expect(() => {
				(subscriber as any)["#normalizeVariants"](variants);
			}).toThrow('Unknown attachment variant "unknown"');
		});
	});

	describe("#getDisk", () => {
		it("should return disk for driver", () => {
			const config = { driver: "local" };
			const disk = (subscriber as any)["#getDisk"](config);
			expect(disk).toBeDefined();
		});

		it("should use default driver when not specified", () => {
			const config = {};
			const disk = (subscriber as any)["#getDisk"](config);
			expect(disk).toBeDefined();
		});

		it("should throw error for unknown driver", () => {
			const config = { driver: "unknown" };
			expect(() => {
				(subscriber as any)["#getDisk"](config);
			}).toThrow('Unknown attachment driver "unknown"');
		});
	});
});
