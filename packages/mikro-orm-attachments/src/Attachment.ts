import { AttachmentOptions, AttachmentPropertyOptions } from "./typings";
import {
	ATTACHMENT_FN_LOAD,
	ATTACHMENT_FN_PROCESS,
	ATTACHMENT_FN_SAVE,
	ATTACHMENT_LOADED,
	ATTACHMENT_OPTIONS,
} from "./symbols";
import { AttachmentData } from "./typings";
import { imageToBlurhash } from "./utils/helpers";

export class Attachment {
	[ATTACHMENT_LOADED]: boolean = false;

	private file?: File;
	private data?: AttachmentData;

	constructor(data: File | AttachmentData) {
		if (data instanceof File) {
			this.file = data;
		} else {
			this[ATTACHMENT_LOADED] = true;
			this.data = data;
		}
	}

	get #loaded() {
		return this[ATTACHMENT_LOADED];
	}
	set #loaded(value: boolean) {
		this[ATTACHMENT_LOADED] = value;
	}

	#ensureLoaded() {
		if (!this.#loaded) {
			throw new Error(
				"Attachment is not processed, please flush the entity first."
			);
		}
	}

	// Internal functions
	[ATTACHMENT_FN_SAVE]() {
		return this.data;
	}

	static [ATTACHMENT_FN_LOAD](value: AttachmentData): Attachment {
		const att = new Attachment(value);
		return att;
	}

	async [ATTACHMENT_FN_PROCESS](
		options: AttachmentPropertyOptions,
		config: AttachmentOptions
	) {
		if (this.#loaded) {
			return;
		}
		const file = this.file!;
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const blurhash = options.blurhash
			? await imageToBlurhash(buffer)
			: undefined;

		this.data = {
			filename: file.name,
			folder: options.folder ?? "attachments",
			blurhash,
		};

		this.#loaded = true;
	}

	static fromFile(file: File): Attachment {
		const att = new Attachment(file);
		return att;
	}

	url() {
		this.#ensureLoaded();
		return `${this.data?.folder}/${this.data?.filename}`;
	}

	blurhash() {
		this.#ensureLoaded();
		return this.data?.blurhash;
	}

	toJSON() {
		return {
			url: this.url(),
			blurhash: this.blurhash(),
		};
	}
}
