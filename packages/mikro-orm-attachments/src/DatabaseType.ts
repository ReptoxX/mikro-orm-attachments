import { Type } from "@mikro-orm/core";
import { ATTACHMENT_FN_LOAD, ATTACHMENT_FN_SAVE } from "./symbols";
import { Attachment } from "./Attachment";
import { AttachmentPropertyOptions } from "./typings";

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

	convertToDatabaseValue(value: Attachment): any {
		return value[ATTACHMENT_FN_SAVE]();
	}

	convertToJSValue(value: any): Attachment {
		try {
			return Attachment[ATTACHMENT_FN_LOAD](JSON.parse(value));
		} catch (error) {
			try {
				return Attachment[ATTACHMENT_FN_LOAD](value);
			} catch (e) {
				throw new Error("Invalid attachment data");
			}
		}
	}

	getColumnType(): string {
		return "json";
	}
}
