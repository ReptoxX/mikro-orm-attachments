import { Disk } from "flydrive";
import {
	ATTACHMENT_DISK,
	ATTACHMENT_FILE,
	ATTACHMENT_FN_LOAD,
	ATTACHMENT_FN_PROCESS,
	ATTACHMENT_FN_SAVE,
	ATTACHMENT_LOADED,
	ATTACHMENT_OPTIONS,
} from "./symbols";
import { AttachmentBase, ImageAttachment } from "./typings";
import { SignedURLOptions } from "flydrive/types";

export class Attachment {
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

	#getVariant(variantName: string) {
		this.#ensureLoaded();
		const variant = (this.data as ImageAttachment)?.variants.find((v) => v.name === variantName) ?? null;
		if (!variant) {
			throw new Error(`Attachment: Variant '${variantName}' not found`);
		}
		return variant;
	}

	url(variant?: string) {
		this.#ensureLoaded();
		if (variant) {
			return this.#disk.getUrl(this.#getVariant(variant).path);
		}
		return (this.data as ImageAttachment)?.url;
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

	async getBytes(variantName?: string) {
		this.#ensureLoaded();
		const path = variantName ? this.#getVariant(variantName).path : this.data?.path ?? "";
		return this.#disk.getBytes(path);
	}

	async getBuffer(variantName?: string) {
		this.#ensureLoaded();
		return Buffer.from(await this.getBytes(variantName));
	}

	async getStream(variantName?: string) {
		this.#ensureLoaded();
		const path = variantName ? this.#getVariant(variantName).path : this.data?.path ?? "";
		return this.#disk.getStream(path);
	}

	getMimeType(variantName?: string) {
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
