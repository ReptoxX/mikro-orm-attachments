/** biome-ignore-all lint/suspicious/noExplicitAny: entity comes from mikro-orm and there it's set to any */
import { type Platform, Type, ValidationError } from "@mikro-orm/core";

import { Attachment } from "./Attachment";
import { ATTACHMENT_FN_LOAD, ATTACHMENT_FN_SAVE } from "./symbols";
import type { AttachmentPropertyOptions } from "./typings";

export class AttachmentType extends Type<Attachment, string> {
	private readonly options: AttachmentPropertyOptions = {
		folder: "attachments",
		blurhash: true,
	};

	constructor(options: AttachmentPropertyOptions | undefined) {
		super();
		this.options = {
			...this.options,
			...options,
		};
	}

	convertToDatabaseValue(value: Attachment | string | null | undefined, _platform: Platform): string | null {
		if (value === null) return null;
		if (value instanceof Attachment) {
			return value[ATTACHMENT_FN_SAVE]() as string;
		}

		throw ValidationError.invalidType(AttachmentType, value, "js");
	}

	convertToJSValue(value: any): Attachment {
		try {
			return Attachment[ATTACHMENT_FN_LOAD](JSON.parse(value));
		} catch (_error) {
			try {
				return Attachment[ATTACHMENT_FN_LOAD](value);
			} catch (_e) {
				throw ValidationError.invalidType(AttachmentType, value, "database");
			}
		}
	}

	getColumnType(): string {
		return "json";
	}
}
