import { describe, expect, it, spyOn } from "bun:test";

import { Attachment } from "./Attachment";
import { ATTACHMENT_DISK, ATTACHMENT_FN_KEYS, ATTACHMENT_LOADED } from "./symbols";

function rawData(path: string, variants: { path: string }[] = []) {
	return {
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
	};
}

function loaded(path: string, variants: { path: string }[] = []) {
	return new Attachment(rawData(path, variants));
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

describe("Attachment.resolve", () => {
	const stored = () => new Attachment({ ...rawData("a/a.png"), url: "https://cdn/a.png" } as never);

	it("keeps the current attachment when the field was not sent", async () => {
		const current = stored();
		expect(await Attachment.resolve(undefined, current)).toBe(current);
	});

	it("clears on null or empty string", async () => {
		expect(await Attachment.resolve(null, stored())).toBeNull();
		expect(await Attachment.resolve("", stored())).toBeNull();
	});

	it("keeps the current attachment without downloading when the url is unchanged", async () => {
		const current = stored();
		const fetchSpy = spyOn(globalThis, "fetch");
		try {
			expect(await Attachment.resolve("https://cdn/a.png", current)).toBe(current);
			expect(fetchSpy).not.toHaveBeenCalled();
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it("keeps the current attachment when one of its variant urls is sent back", async () => {
		const current = new Attachment({ ...rawData("a/a.png", [{ path: "a/avatar.webp" }]), url: "https://cdn/a.png" } as never);
		current[ATTACHMENT_DISK] = { getUrl: async (key: string) => `https://cdn/${key}` } as never;
		const fetchSpy = spyOn(globalThis, "fetch");
		try {
			expect(await Attachment.resolve("https://cdn/a/avatar.webp", current)).toBe(current);
			expect(fetchSpy).not.toHaveBeenCalled();
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it("downloads a new, unprocessed attachment when the url changed", async () => {
		const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([1]), { headers: { "content-type": "image/png" } }));
		try {
			const next = await Attachment.resolve("https://cdn/b.png", stored());
			expect(next).not.toBeNull();
			expect(next?.[ATTACHMENT_LOADED]).toBe(false);
			expect(fetchSpy).toHaveBeenCalledTimes(1);
		} finally {
			fetchSpy.mockRestore();
		}
	});
});
