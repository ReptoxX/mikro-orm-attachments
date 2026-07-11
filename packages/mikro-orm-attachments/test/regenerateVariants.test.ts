import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Disk } from "flydrive";
import { FSDriver } from "flydrive/drivers/fs";

import { Attachment } from "../src/Attachment";
import { BaseConverter } from "../src/converters/BaseConverter";
import { AttachmentSubscriber } from "../src/subscribers/AttachmentSubscriber";
import type { ConvertInput, ConvertOutput } from "../src/types/converter";

class TagConverter extends BaseConverter<ConvertInput, ConvertOutput> {
	constructor(private readonly tag: string) {
		super();
	}
	async supports() {
		return true;
	}
	async handle(input: ConvertInput): Promise<ConvertOutput> {
		return {
			buffer: Buffer.from(`${this.tag}:${input.buffer.toString()}`),
			mimeType: "text/plain",
			extname: "txt",
		};
	}
}

function makeSubscriber(dir: string, variants: Record<string, BaseConverter<ConvertInput, ConvertOutput>>) {
	return new AttachmentSubscriber({
		drivers: { fs: new FSDriver({ location: dir }) },
		defaultDriver: "fs",
		variants,
	});
}

function makeEntity(subscriber: AttachmentSubscriber<any, any>, variantNames: string[] = ["thumb"]) {
	class TestEntity {
		id = 1;
		avatar: any;
	}
	subscriber.AttachmentDecorator({ variants: variantNames })(TestEntity.prototype, "avatar");
	return new TestEntity();
}

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "attach-test-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

async function seedOriginal() {
	const disk = new Disk(new FSDriver({ location: dir }));
	await disk.put("orig.txt", Buffer.from("hello"));
	return new Attachment({
		drive: "fs",
		name: "orig",
		extname: "txt",
		size: 5,
		mimeType: "text/plain",
		path: "orig.txt",
		originalName: "orig.txt",
		variants: [],
	});
}

describe("BaseConverter#configFingerprint", () => {
	test("is stable for identical options and differs for different options", () => {
		const a = new TagConverter("v1");
		const b = new TagConverter("v1");
		const c = new TagConverter("v2");

		expect(a.configFingerprint()).toBe(b.configFingerprint());
		expect(a.configFingerprint()).not.toBe(c.configFingerprint());
	});
});

describe("AttachmentSubscriber#regenerateVariants", () => {
	test("throws for a property that isn't attachment-decorated", async () => {
		const subscriber = makeSubscriber(dir, { thumb: new TagConverter("v1") });
		const entity = { avatar: await seedOriginal() };

		await expect(subscriber.regenerateVariants(entity, "avatar")).rejects.toThrow(/No attachment property/);
	});

	test("throws when the attachment property isn't loaded yet", async () => {
		const subscriber = makeSubscriber(dir, { thumb: new TagConverter("v1") });
		const entity = makeEntity(subscriber);
		entity.avatar = Attachment.fromFile(new File([Buffer.from("hi")], "hi.txt"));

		await expect(subscriber.regenerateVariants(entity, "avatar")).rejects.toThrow(/must be loaded/);
	});

	test("generates a declared variant that doesn't exist yet and stamps a configHash", async () => {
		const subscriber = makeSubscriber(dir, { thumb: new TagConverter("v1") });
		const entity = makeEntity(subscriber);
		entity.avatar = await seedOriginal();

		await subscriber.regenerateVariants(entity, "avatar");

		expect(entity.avatar.key("thumb")).toBe("orig/thumb.txt");
		expect(await entity.avatar.getBuffer("thumb")).toEqual(Buffer.from("v1:hello"));
	});

	test("never touches the original file", async () => {
		const subscriber = makeSubscriber(dir, { thumb: new TagConverter("v1") });
		const entity = makeEntity(subscriber);
		entity.avatar = await seedOriginal();

		await subscriber.regenerateVariants(entity, "avatar");

		expect(await entity.avatar.getBuffer()).toEqual(Buffer.from("hello"));
	});

	test("is a full no-op (zero disk reads/writes) when the config is unchanged", async () => {
		const driver = new FSDriver({ location: dir });
		const subscriber = new AttachmentSubscriber({
			drivers: { fs: driver },
			defaultDriver: "fs",
			variants: { thumb: new TagConverter("v1") },
		});
		const entity = makeEntity(subscriber);
		entity.avatar = await seedOriginal();

		await subscriber.regenerateVariants(entity, "avatar");

		const putSpy = spyOn(driver, "put");
		const getSpy = spyOn(driver, "getBytes");

		await subscriber.regenerateVariants(entity, "avatar");

		expect(putSpy).not.toHaveBeenCalled();
		expect(getSpy).not.toHaveBeenCalled();
	});

	test("regenerates a variant whose config changed, leaving others untouched", async () => {
		let subscriber = makeSubscriber(dir, {
			thumb: new TagConverter("v1"),
			other: new TagConverter("other"),
		});
		const entity = makeEntity(subscriber, ["thumb", "other"]);
		entity.avatar = await seedOriginal();
		await subscriber.regenerateVariants(entity, "avatar");

		const otherPathBefore = entity.avatar.key("other");

		subscriber = makeSubscriber(dir, {
			thumb: new TagConverter("v2-changed"),
			other: new TagConverter("other"),
		});
		subscriber.AttachmentDecorator({ variants: ["thumb", "other"] })(Object.getPrototypeOf(entity), "avatar");

		await subscriber.regenerateVariants(entity, "avatar");

		expect(await entity.avatar.getBuffer("thumb")).toEqual(Buffer.from("v2-changed:hello"));
		expect(entity.avatar.key("other")).toBe(otherPathBefore);
		expect(await entity.avatar.getBuffer("other")).toEqual(Buffer.from("other:hello"));
	});

	test("force regenerates even when the config is unchanged", async () => {
		const driver = new FSDriver({ location: dir });
		const subscriber = new AttachmentSubscriber({
			drivers: { fs: driver },
			defaultDriver: "fs",
			variants: { thumb: new TagConverter("v1") },
		});
		const entity = makeEntity(subscriber);
		entity.avatar = await seedOriginal();
		await subscriber.regenerateVariants(entity, "avatar");

		const putSpy = spyOn(driver, "put");
		await subscriber.regenerateVariants(entity, "avatar", { force: true });

		expect(putSpy).toHaveBeenCalled();
	});

	test("only regenerates variants listed in opts.only", async () => {
		let subscriber = makeSubscriber(dir, {
			thumb: new TagConverter("v1"),
			other: new TagConverter("other"),
		});
		const entity = makeEntity(subscriber, ["thumb", "other"]);
		entity.avatar = await seedOriginal();
		await subscriber.regenerateVariants(entity, "avatar");

		subscriber = makeSubscriber(dir, {
			thumb: new TagConverter("v2-changed"),
			other: new TagConverter("other-changed"),
		});
		subscriber.AttachmentDecorator({ variants: ["thumb", "other"] })(Object.getPrototypeOf(entity), "avatar");

		await subscriber.regenerateVariants(entity, "avatar", { only: ["thumb"] });

		expect(await entity.avatar.getBuffer("thumb")).toEqual(Buffer.from("v2-changed:hello"));
		// "other" changed too, but wasn't requested -> left as the old (stale) value
		expect(await entity.avatar.getBuffer("other")).toEqual(Buffer.from("other:hello"));
	});

	test("keeps orphaned (removed-from-config) variants by default", async () => {
		let subscriber = makeSubscriber(dir, { thumb: new TagConverter("v1") });
		const entity = makeEntity(subscriber, ["thumb"]);
		entity.avatar = await seedOriginal();
		await subscriber.regenerateVariants(entity, "avatar");
		const thumbPath = entity.avatar.key("thumb");

		subscriber = makeSubscriber(dir, {});
		subscriber.AttachmentDecorator({ variants: [] })(Object.getPrototypeOf(entity), "avatar");

		await subscriber.regenerateVariants(entity, "avatar");

		expect(entity.avatar.key("thumb")).toBe(thumbPath);
		expect(await entity.avatar.getBuffer("thumb")).toEqual(Buffer.from("v1:hello"));
	});

	test("deletes orphaned variants (storage + metadata) when deleteOrphaned: true", async () => {
		let subscriber = makeSubscriber(dir, { thumb: new TagConverter("v1") });
		const entity = makeEntity(subscriber, ["thumb"]);
		entity.avatar = await seedOriginal();
		await subscriber.regenerateVariants(entity, "avatar");

		subscriber = makeSubscriber(dir, {});
		subscriber.AttachmentDecorator({ variants: [] })(Object.getPrototypeOf(entity), "avatar");

		await subscriber.regenerateVariants(entity, "avatar", { deleteOrphaned: true });

		expect(() => entity.avatar.key("thumb")).toThrow(/not found/);

		const disk = new Disk(new FSDriver({ location: dir }));
		expect(await disk.exists("orig/thumb.txt")).toBe(false);
	});

	test("deletes the old variant object when a regenerated variant's path changes", async () => {
		class RenamingConverter extends BaseConverter<ConvertInput, ConvertOutput> {
			constructor(private readonly extname: string) {
				super();
			}
			async supports() {
				return true;
			}
			async handle(input: ConvertInput): Promise<ConvertOutput> {
				return { buffer: input.buffer, mimeType: "text/plain", extname: this.extname };
			}
		}

		let subscriber = makeSubscriber(dir, { thumb: new RenamingConverter("txt") });
		const entity = makeEntity(subscriber, ["thumb"]);
		entity.avatar = await seedOriginal();
		await subscriber.regenerateVariants(entity, "avatar");
		expect(entity.avatar.key("thumb")).toBe("orig/thumb.txt");

		subscriber = makeSubscriber(dir, { thumb: new RenamingConverter("bin") });
		subscriber.AttachmentDecorator({ variants: ["thumb"] })(Object.getPrototypeOf(entity), "avatar");

		await subscriber.regenerateVariants(entity, "avatar", { force: true });

		expect(entity.avatar.key("thumb")).toBe("orig/thumb.bin");
		const disk = new Disk(new FSDriver({ location: dir }));
		expect(await disk.exists("orig/thumb.txt")).toBe(false);
		expect(await disk.exists("orig/thumb.bin")).toBe(true);
	});
});
