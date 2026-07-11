import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { FSDriver } from "flydrive/drivers/fs";

import { Attachment } from "../Attachment";
import { AttachmentDecorator } from "../decorators/AttachmentDecorator";
import { AttachmentSubscriber } from "./AttachmentSubscriber";

class ProjectFixture {
	avatar: unknown;
	cover: unknown;
}
AttachmentDecorator()(ProjectFixture.prototype, "avatar");
AttachmentDecorator()(ProjectFixture.prototype, "cover");

function rawAttachmentData(path: string, variantPaths: string[] = []) {
	return {
		drive: "fs",
		name: "file",
		extname: "png",
		size: 1,
		mimeType: "image/png",
		path,
		originalName: "file.png",
		variants: variantPaths.map((p, i) => ({
			name: `variant-${i}`,
			extname: "png",
			size: 1,
			mimeType: "image/png",
			path: p,
		})),
	};
}

function loadedAttachment(path: string, variantPaths: string[] = []) {
	return new Attachment(rawAttachmentData(path, variantPaths));
}

function updateChangeSet(entity: object, payloadKeys: string[], originalEntity?: Record<string, unknown>) {
	const payload: Record<string, unknown> = {};
	for (const key of payloadKeys) {
		payload[key] = (entity as Record<string, unknown>)[key];
	}
	return { entity, type: "update", payload, originalEntity };
}

describe("AttachmentSubscriber#afterDelete", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "attachment-delete-test-"));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	function writeFixtureFile(relativePath: string) {
		const full = join(root, relativePath);
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(full, "content");
	}

	function makeSubscriber() {
		return new AttachmentSubscriber({
			drivers: { fs: new FSDriver({ location: root }) },
			defaultDriver: "fs",
			variants: {},
		});
	}

	it("deletes the original file and all variants from disk", async () => {
		writeFixtureFile("a/a.png");
		writeFixtureFile("a/thumb.png");
		writeFixtureFile("a/2x.png");

		const subscriber = makeSubscriber();
		const entity = new ProjectFixture();
		entity.avatar = loadedAttachment("a/a.png", ["a/thumb.png", "a/2x.png"]);

		await subscriber.afterDelete({ entity });

		expect(existsSync(join(root, "a/a.png"))).toBe(false);
		expect(existsSync(join(root, "a/thumb.png"))).toBe(false);
		expect(existsSync(join(root, "a/2x.png"))).toBe(false);
	});

	it("only touches attachment properties that are actually set, leaving unrelated files alone", async () => {
		writeFixtureFile("b/avatar.png");
		writeFixtureFile("keep/unrelated.png");

		const subscriber = makeSubscriber();
		const entity = new ProjectFixture();
		entity.avatar = loadedAttachment("b/avatar.png");
		entity.cover = null;

		await subscriber.afterDelete({ entity });

		expect(existsSync(join(root, "b/avatar.png"))).toBe(false);
		expect(existsSync(join(root, "keep/unrelated.png"))).toBe(true);
	});

	it("is a no-op for a null attachment property", async () => {
		const subscriber = makeSubscriber();
		const entity = new ProjectFixture();
		entity.avatar = null;
		entity.cover = null;

		await expect(subscriber.afterDelete({ entity })).resolves.toBeUndefined();
	});

	it("is a no-op for an attachment that was never flushed (fromFile, unloaded)", async () => {
		const subscriber = makeSubscriber();
		const entity = new ProjectFixture();
		entity.avatar = Attachment.fromFile(new File(["x"], "a.png"));

		await expect(subscriber.afterDelete({ entity })).resolves.toBeUndefined();
	});

	it("resolves the disk from the persisted drive name when the attachment was never loaded through onLoad", async () => {
		writeFixtureFile("c/c.png");

		const subscriber = makeSubscriber();
		const entity = new ProjectFixture();
		entity.avatar = loadedAttachment("c/c.png");

		// never called subscriber.onLoad() - ATTACHMENT_DISK is unset, forcing the getDrive() fallback
		expect((entity.avatar as Attachment).getDisk()).toBeUndefined();

		await subscriber.afterDelete({ entity });

		expect(existsSync(join(root, "c/c.png"))).toBe(false);
	});

	it("reuses the disk already attached by onLoad for a fetched-then-removed entity", async () => {
		writeFixtureFile("d/d.png");

		const subscriber = makeSubscriber();
		const entity = new ProjectFixture();
		entity.avatar = loadedAttachment("d/d.png");

		await subscriber.onLoad({ entity });
		expect((entity.avatar as Attachment).getDisk()).toBeDefined();

		await subscriber.afterDelete({ entity });

		expect(existsSync(join(root, "d/d.png"))).toBe(false);
	});

	it("logs a warning and keeps going when a storage delete fails, without throwing", async () => {
		writeFixtureFile("e/thumb.png");

		const failingDriver = {
			delete: async (key: string) => {
				if (key === "e/e.png") {
					throw new Error("simulated storage failure");
				}
			},
		};
		const subscriber = new AttachmentSubscriber({
			drivers: { fs: failingDriver as unknown as import("flydrive/types").DriverContract },
			defaultDriver: "fs",
			variants: {},
		});
		const entity = new ProjectFixture();
		entity.avatar = loadedAttachment("e/e.png", ["e/thumb.png"]);

		const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
		try {
			await expect(subscriber.afterDelete({ entity })).resolves.toBeUndefined();
			expect(warnSpy).toHaveBeenCalledTimes(1);
			expect(String(warnSpy.mock.calls[0]?.[0])).toContain("e/e.png");
		} finally {
			warnSpy.mockRestore();
		}
	});
});

describe("AttachmentSubscriber#afterUpdate", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "attachment-update-test-"));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	function writeFixtureFile(relativePath: string) {
		const full = join(root, relativePath);
		mkdirSync(dirname(full), { recursive: true });
		writeFileSync(full, "content");
	}

	function makeSubscriber() {
		return new AttachmentSubscriber({
			drivers: { fs: new FSDriver({ location: root }) },
			defaultDriver: "fs",
			variants: {},
		});
	}

	it("deletes the old file and variants when the property is replaced, keeping the new one", async () => {
		writeFixtureFile("old/old.png");
		writeFixtureFile("old/thumb.png");
		writeFixtureFile("new/new.png");

		const subscriber = makeSubscriber();
		const entity = new ProjectFixture();
		entity.avatar = loadedAttachment("new/new.png"); // value already uploaded by beforeFlush, as it'd be by the time afterUpdate fires

		const changeSet = updateChangeSet(entity, ["avatar"], { avatar: rawAttachmentData("old/old.png", ["old/thumb.png"]) });
		await subscriber.afterUpdate({ changeSet });

		expect(existsSync(join(root, "old/old.png"))).toBe(false);
		expect(existsSync(join(root, "old/thumb.png"))).toBe(false);
		expect(existsSync(join(root, "new/new.png"))).toBe(true);
	});

	it("deletes the old file when the property is cleared to null", async () => {
		writeFixtureFile("cleared/cleared.png");

		const subscriber = makeSubscriber();
		const entity = new ProjectFixture();
		entity.avatar = null;

		const changeSet = updateChangeSet(entity, ["avatar"], { avatar: rawAttachmentData("cleared/cleared.png") });
		await subscriber.afterUpdate({ changeSet });

		expect(existsSync(join(root, "cleared/cleared.png"))).toBe(false);
	});

	it("does not touch a property that wasn't part of this update", async () => {
		writeFixtureFile("keep/keep.png");

		const subscriber = makeSubscriber();
		const entity = new ProjectFixture();
		entity.avatar = loadedAttachment("keep/keep.png");
		entity.cover = null;

		// only "cover" changed - "avatar" must be left alone even though originalEntity carries a value for it
		const changeSet = updateChangeSet(entity, ["cover"], { avatar: rawAttachmentData("keep/keep.png"), cover: rawAttachmentData("other/other.png") });
		await subscriber.afterUpdate({ changeSet });

		expect(existsSync(join(root, "keep/keep.png"))).toBe(true);
	});

	it("is a no-op when the changeSet is not an update (e.g. create)", async () => {
		const subscriber = makeSubscriber();
		const entity = new ProjectFixture();
		entity.avatar = loadedAttachment("whatever/whatever.png");

		const changeSet = { entity, type: "create", payload: { avatar: entity.avatar } };
		await expect(subscriber.afterUpdate({ changeSet })).resolves.toBeUndefined();
	});

	it("is a no-op when there is no changeSet at all", async () => {
		const subscriber = makeSubscriber();
		await expect(subscriber.afterUpdate({})).resolves.toBeUndefined();
	});

	it("is a no-op when the property was already null before the update", async () => {
		const subscriber = makeSubscriber();
		const entity = new ProjectFixture();
		entity.avatar = loadedAttachment("z/z.png");

		const changeSet = updateChangeSet(entity, ["avatar"], { avatar: null });
		await expect(subscriber.afterUpdate({ changeSet })).resolves.toBeUndefined();
	});

	it("does not delete a key that the new attachment also uses (rename: false reusing the same path)", async () => {
		writeFixtureFile("same/file.png");
		writeFixtureFile("same/thumb.png");

		const subscriber = makeSubscriber();
		const entity = new ProjectFixture();
		entity.avatar = loadedAttachment("same/file.png", ["same/thumb.png"]);

		const changeSet = updateChangeSet(entity, ["avatar"], { avatar: rawAttachmentData("same/file.png", ["same/thumb.png"]) });
		await subscriber.afterUpdate({ changeSet });

		expect(existsSync(join(root, "same/file.png"))).toBe(true);
		expect(existsSync(join(root, "same/thumb.png"))).toBe(true);
	});

	it("does not crash when the previous attachment's stored data is missing a variants array", async () => {
		writeFixtureFile("legacy/legacy.png");

		const subscriber = makeSubscriber();
		const entity = new ProjectFixture();
		entity.avatar = loadedAttachment("new-legacy/new.png");

		const legacyRawData = {
			drive: "fs",
			name: "legacy",
			extname: "png",
			size: 1,
			mimeType: "image/png",
			path: "legacy/legacy.png",
			originalName: "legacy.png",
			// no `variants` key - simulates data written by an older version of this library
		};
		const changeSet = updateChangeSet(entity, ["avatar"], { avatar: legacyRawData });

		await expect(subscriber.afterUpdate({ changeSet })).resolves.toBeUndefined();
		expect(existsSync(join(root, "legacy/legacy.png"))).toBe(false);
	});

	it("logs a warning and keeps going when a storage delete fails, without throwing", async () => {
		writeFixtureFile("f/thumb.png");

		const failingDriver = {
			delete: async (key: string) => {
				if (key === "f/f.png") {
					throw new Error("simulated storage failure");
				}
			},
		};
		const subscriber = new AttachmentSubscriber({
			drivers: { fs: failingDriver as unknown as import("flydrive/types").DriverContract },
			defaultDriver: "fs",
			variants: {},
		});
		const entity = new ProjectFixture();
		entity.avatar = loadedAttachment("new-f/new.png");

		const changeSet = updateChangeSet(entity, ["avatar"], { avatar: rawAttachmentData("f/f.png", ["f/thumb.png"]) });

		const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
		try {
			await expect(subscriber.afterUpdate({ changeSet })).resolves.toBeUndefined();
			expect(warnSpy).toHaveBeenCalledTimes(1);
			expect(String(warnSpy.mock.calls[0]?.[0])).toContain("f/f.png");
		} finally {
			warnSpy.mockRestore();
		}
	});
});
