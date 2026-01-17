import { describe, it, expect, beforeEach } from "bun:test";
import { AttachmentType } from "../DatabaseType";
import { Attachment } from "../Attachment";
import { ATTACHMENT_FN_SAVE, ATTACHMENT_FN_LOAD } from "../symbols";
import type { AttachmentBase } from "../typings";

describe("AttachmentType", () => {
	let attachmentType: AttachmentType;
	let attachmentData: AttachmentBase;

	beforeEach(() => {
		attachmentType = new AttachmentType(undefined);
		attachmentData = {
			drive: "local",
			name: "test",
			extname: "txt",
			size: 100,
			mimeType: "text/plain",
			path: "test/test.txt",
			originalName: "test.txt",
			variants: [],
		};
	});

	describe("constructor", () => {
		it("should create instance with default options", () => {
			const type = new AttachmentType(undefined);
			expect(type).toBeInstanceOf(AttachmentType);
		});

		it("should create instance with custom options", () => {
			const options = {
				folder: "custom",
				blurhash: false,
			};
			const type = new AttachmentType(options);
			expect(type).toBeInstanceOf(AttachmentType);
		});
	});

	describe("convertToDatabaseValue", () => {
		it("should convert attachment to database value", () => {
			const attachment = new Attachment(attachmentData);
			const dbValue = attachmentType.convertToDatabaseValue(attachment);
			expect(dbValue).toEqual(attachmentData);
		});

		it("should return empty object for unprocessed attachment", () => {
			const file = new File(["test"], "test.txt");
			const attachment = new Attachment(file);
			const dbValue = attachmentType.convertToDatabaseValue(attachment);
			expect(dbValue).toEqual({});
		});
	});

	describe("convertToJSValue", () => {
		it("should convert JSON string to attachment", () => {
			const jsonString = JSON.stringify(attachmentData);
			const attachment = attachmentType.convertToJSValue(jsonString);
			expect(attachment).toBeInstanceOf(Attachment);
		});

		it("should convert object to attachment", () => {
			const attachment = attachmentType.convertToJSValue(attachmentData);
			expect(attachment).toBeInstanceOf(Attachment);
		});

		it("should throw error for invalid data", () => {
			expect(() => {
				attachmentType.convertToJSValue("invalid json {");
			}).toThrow("Invalid attachment data");
		});

		it("should handle invalid object data", () => {
			expect(() => {
				attachmentType.convertToJSValue({ invalid: "data" });
			}).toThrow("Invalid attachment data");
		});
	});

	describe("getColumnType", () => {
		it("should return json column type", () => {
			expect(attachmentType.getColumnType()).toBe("json");
		});
	});
});
