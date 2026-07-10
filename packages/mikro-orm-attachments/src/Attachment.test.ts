import { describe, expect, it } from "bun:test";

import { Attachment } from "./Attachment";
import { ATTACHMENT_FN_KEYS } from "./symbols";

function loaded(path: string, variants: { path: string }[] = []) {
	return new Attachment({
		drive: "fs",
		name: "file",
		extname: "png",
		size: 1,
		mimeType: "image/png",
		path,
		originalName: "file.png",
		variants: variants.map((v, i) => ({
			name: `variant-${i}`,
			extname: "png",
			size: 1,
			mimeType: "image/png",
			path: v.path,
		})),
	});
}

describe("Attachment[ATTACHMENT_FN_KEYS]", () => {
	it("returns an empty array for an unloaded attachment (fromFile, never flushed)", () => {
		const attachment = Attachment.fromFile(new File(["x"], "a.png"));
		expect(attachment[ATTACHMENT_FN_KEYS]()).toEqual([]);
	});

	it("returns just the original path when there are no variants", () => {
		const attachment = loaded("avatars/a/a.png");
		expect(attachment[ATTACHMENT_FN_KEYS]()).toEqual(["avatars/a/a.png"]);
	});

	it("returns the original path plus every variant path", () => {
		const attachment = loaded("avatars/a/a.png", [{ path: "avatars/a/thumbnail.webp" }, { path: "avatars/a/2x.webp" }]);
		expect(attachment[ATTACHMENT_FN_KEYS]()).toEqual(["avatars/a/a.png", "avatars/a/thumbnail.webp", "avatars/a/2x.webp"]);
	});

	it("skips variants with an empty path", () => {
		const attachment = loaded("avatars/a/a.png", [{ path: "" }, { path: "avatars/a/thumbnail.webp" }]);
		expect(attachment[ATTACHMENT_FN_KEYS]()).toEqual(["avatars/a/a.png", "avatars/a/thumbnail.webp"]);
	});
});
