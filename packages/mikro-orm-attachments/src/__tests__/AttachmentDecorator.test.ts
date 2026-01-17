import { describe, it, expect, beforeEach } from "bun:test";
import { AttachmentDecorator, getAttachmentProps, createAttachmentDecorator } from "../decorators/AttachmentDecorator";
import { AttachmentSubscriber } from "../subscribers/AttachmentSubscriber";
import type { DriverContract } from "flydrive/types";

describe("AttachmentDecorator", () => {
	let subscriber: AttachmentSubscriber<any, any>;
	let mockDriver: DriverContract;

	beforeEach(() => {
		mockDriver = {} as DriverContract;
		subscriber = new AttachmentSubscriber({
			drivers: { local: mockDriver },
			defaultDriver: "local",
		});
	});

	describe("AttachmentDecorator", () => {
		it("should create decorator", () => {
			const decorator = AttachmentDecorator<typeof subscriber>();
			expect(typeof decorator).toBe("function");
		});

		it("should apply decorator to property", () => {
			class TestEntity {
				@AttachmentDecorator<typeof subscriber>({ folder: "test" })
				file: any;
			}
			const props = getAttachmentProps(new TestEntity());
			expect(props.file).toBeDefined();
			expect(props.file.folder).toBe("test");
		});

		it("should merge default options", () => {
			class TestEntity {
				@AttachmentDecorator<typeof subscriber>()
				file: any;
			}
			const props = getAttachmentProps(new TestEntity());
			expect(props.file).toBeDefined();
			expect(props.file.blurhash).toBe(true);
		});

		it("should handle mikro-orm property options", () => {
			class TestEntity {
				@AttachmentDecorator<typeof subscriber>({ nullable: true, folder: "test" })
				file: any;
			}
			const props = getAttachmentProps(new TestEntity());
			expect(props.file).toBeDefined();
			expect(props.file.folder).toBe("test");
		});
	});

	describe("createAttachmentDecorator", () => {
		it("should create decorator", () => {
			const decorator = createAttachmentDecorator<typeof subscriber>();
			expect(typeof decorator).toBe("function");
		});

		it("should create decorator with options", () => {
			const decorator = createAttachmentDecorator<typeof subscriber>({ folder: "custom" });
			expect(typeof decorator).toBe("function");
		});
	});

	describe("getAttachmentProps", () => {
		it("should get attachment properties from entity", () => {
			class TestEntity {
				@AttachmentDecorator<typeof subscriber>({ folder: "test1" })
				file1: any;

				@AttachmentDecorator<typeof subscriber>({ folder: "test2" })
				file2: any;
			}
			const props = getAttachmentProps(new TestEntity());
			expect(props.file1).toBeDefined();
			expect(props.file2).toBeDefined();
			expect(props.file1.folder).toBe("test1");
			expect(props.file2.folder).toBe("test2");
		});

		it("should return empty object for entity without attachment properties", () => {
			class TestEntity {
				prop: string;
			}
			const props = getAttachmentProps(new TestEntity());
			expect(props).toEqual({});
		});
	});
});
