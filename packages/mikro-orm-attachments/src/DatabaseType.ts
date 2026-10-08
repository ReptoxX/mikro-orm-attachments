/** biome-ignore-all lint/suspicious/noExplicitAny: entity comes from mikro-orm and there it's set to any */
import { type Platform, Type, ValidationError } from "@mikro-orm/core";

import { Attachment } from "./Attachment";
import { ATTACHMENT_FN_LOAD, ATTACHMENT_FN_SAVE } from "./symbols";
import { type AttachmentPropertyOptions, DEFAULT_ATTACHMENT_PROPERTY_OPTIONS } from "./typings";

/** `TValue` is phantom: it carries the inferred property type into `defineEntity`. */
export class AttachmentType<TValue extends Attachment<any> | Attachment<any>[] = Attachment | Attachment[]> extends Type<TValue | null, unknown> {
	readonly options: AttachmentPropertyOptions;

	constructor(options?: AttachmentPropertyOptions) {
		super();
		this.options = { ...DEFAULT_ATTACHMENT_PROPERTY_OPTIONS, ...options };
	}

	convertToDatabaseValue(value: TValue | null | undefined, _platform: Platform): unknown {
		if (value == null) return null;
		if (value instanceof Attachment) {
			return value[ATTACHMENT_FN_SAVE]();
		}
		if (Array.isArray(value) && value.every((item) => item instanceof Attachment)) {
			// stringified, the pg driver would otherwise send a JS array as a Postgres array literal
			return JSON.stringify(value.map((item) => item[ATTACHMENT_FN_SAVE]()));
		}

		throw ValidationError.invalidType(AttachmentType, value, "js");
	}

	convertToJSValue(value: any): TValue {
		let parsed = value;
		if (typeof value === "string") {
			try {
				parsed = JSON.parse(value);
			} catch (_error) {
				throw ValidationError.invalidType(AttachmentType, value, "database");
			}
		}
		if (Array.isArray(parsed)) {
			return parsed.map((item) => Attachment[ATTACHMENT_FN_LOAD](item)) as TValue;
		}
		return Attachment[ATTACHMENT_FN_LOAD](parsed) as TValue;
	}

	getColumnType(): string {
		return "json";
	}
}
