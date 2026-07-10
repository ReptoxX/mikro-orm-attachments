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

function loadedAttachment(path: string, variantPaths: string[] = []) {
	return new Attachment({
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
	});
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
