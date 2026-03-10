import { Buffer } from "node:buffer";
import { writeFileSync } from "node:fs";
import type { Disk } from "flydrive";
import type { SignedURLOptions } from "flydrive/types";

import { ATTACHMENT_DISK, ATTACHMENT_FILE, ATTACHMENT_FN_LOAD, ATTACHMENT_FN_PROCESS, ATTACHMENT_FN_SAVE, ATTACHMENT_LOADED, ATTACHMENT_OPTIONS } from "./symbols";
import type { AttachmentBase, ImageAttachment } from "./typings";

export class Attachment<Variants extends string = string> {
	[ATTACHMENT_LOADED]: boolean = false;
	[ATTACHMENT_FILE]?: File;
	[ATTACHMENT_DISK]?: Disk;
	private data?: AttachmentBase;

	constructor(data: File | AttachmentBase) {
		if (data instanceof File) {
			this[ATTACHMENT_FILE] = data;
		} else {
			this[ATTACHMENT_LOADED] = true;
			this.data = data;
		}
	}

	#ensureLoaded() {
		if (!this[ATTACHMENT_LOADED]) {
			throw new Error("Attachment is not processed, please flush the entity first.");
		}
	}
	get #disk() {
		this.#ensureLoaded();
		return this[ATTACHMENT_DISK]!;
	}

	// Internal functions
	[ATTACHMENT_FN_SAVE]() {
		return this.data ?? {};
	}

	static [ATTACHMENT_FN_LOAD](value: AttachmentBase): Attachment {
		const att = new Attachment(value);
		return att;
	}

	[ATTACHMENT_FN_PROCESS](data: AttachmentBase) {
		if (this[ATTACHMENT_LOADED]) {
			return;
		}
		this.data = data;
		this[ATTACHMENT_LOADED] = true;
	}

	static fromFile(file: File): Attachment {
		const att = new Attachment(file);
		return att;
	}

	/**
	 * Downloads a file from a URL and returns an Attachment object.
	 *
	 * @param url - The URL of the file to download.
	 * @returns The Attachment object.
	 * @throws An error if the file cannot be downloaded.
	 */
	static async fromUrl(url: string): Promise<Attachment> {
		const response = await fetch(url);
		const arrayBuffer = await response.arrayBuffer();
		let filename: string | undefined;

		// Try to obtain filename from Content-Disposition header
		const contentDisposition = response.headers.get("content-disposition");
		if (contentDisposition) {
			const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
			if (filenameMatch) {
				filename = filenameMatch[1].replace(/['"]/g, "");
			}
		}

		// Fallback to last segment of URL if no filename found
		if (!filename) {
			const urlParts = url.split("?");
			const pathParts = urlParts[0].split("/");
			filename = pathParts.pop() || "download";
		}

		const buffer = Buffer.from(arrayBuffer);

		const file = new File([buffer], filename, { type: response.headers.get("content-type") ?? "" });
		const att = new Attachment(file);
		return att;
	}

	#getVariant(variantName: string) {
		this.#ensureLoaded();
		const variant = (this.data as ImageAttachment)?.variants.find((v) => v.name === variantName) ?? null;
		if (!variant) {
			throw new Error(`Attachment: Variant '${variantName}' not found`);
		}
		return variant;
	}

	url(variant?: Variants) {
		this.#ensureLoaded();
		if (variant) {
			return this.#disk.getUrl(this.#getVariant(variant).path);
		}
		return (this.data as ImageAttachment)?.url;
	}

	originalName() {
		return this.data?.originalName ?? "";
	}

	size(variant?: Variants) {
		if (variant) {
			return this.#getVariant(variant).size;
		}
		return this.data?.size;
	}

	meta(variant?: Variants) {
		if (variant) {
			return this.#getVariant(variant).meta;
		}
		return this.data?.meta;
	}

	preSignedUrl(variantNameOrOptions?: string | SignedURLOptions, signedUrlOptions?: SignedURLOptions) {
		this.#ensureLoaded();
		if (typeof variantNameOrOptions === "string") {
			return this.#disk.getSignedUrl(this.#getVariant(variantNameOrOptions).path, signedUrlOptions);
		}
		return this.#disk.getSignedUrl(this.data?.path ?? "", signedUrlOptions);
	}

	blurhash() {
		this.#ensureLoaded();
		return (this.data as ImageAttachment)?.blurhash;
	}

	getDisk() {
		return this.#disk;
	}

	getDrive() {
		return this.data?.drive ?? "";
	}

	async getBytes(variantName?: Variants) {
		this.#ensureLoaded();
		const path = variantName ? this.#getVariant(variantName).path : (this.data?.path ?? "");
		return this.#disk.getBytes(path);
	}

	async getBuffer(variantName?: Variants) {
		this.#ensureLoaded();
		return Buffer.from(await this.getBytes(variantName));
	}

	async getStream(variantName?: Variants) {
		this.#ensureLoaded();
		const path = variantName ? this.#getVariant(variantName).path : (this.data?.path ?? "");
		return this.#disk.getStream(path);
	}

	getMimeType(variantName?: Variants) {
		this.#ensureLoaded();
		const variant = variantName ? this.#getVariant(variantName) : this.data;
		return variant?.mimeType ?? "";
	}

	toJSON() {
		return {
			url: this.url(),
			blurhash: this.blurhash(),
		};
	}
}
