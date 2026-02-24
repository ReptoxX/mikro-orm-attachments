import type { Property as PropertyType } from "@mikro-orm/decorators/legacy";
import { AttachmentType } from "../DatabaseType";
import { ALLOWED_PROPERTY_OPTIONS, AttachmentDecoratorProps, AttachmentPropertyOptionsFor, DEFAULT_ATTACHMENT_PROPERTY_OPTIONS } from "../typings";
import { AttachmentSubscriber } from "../subscribers/AttachmentSubscriber";
import { resolveModule } from "../utils/helpers";

const { Property } = resolveModule<{ Property: typeof PropertyType }>(["@mikro-orm/decorators/legacy", "@mikro-orm/core"]);
const ATTACHMENT_PROPS = Symbol("attachment:props");

export function AttachmentDecorator<S extends AttachmentSubscriber<any, any>>(options: AttachmentDecoratorProps<S> = {}) {
	return (target: any, propertyKey: string) => {
		let { mikro, attachment } = splitOptions(options, ALLOWED_PROPERTY_OPTIONS);

		attachment = {
			...DEFAULT_ATTACHMENT_PROPERTY_OPTIONS,
			...attachment,
		} as AttachmentPropertyOptionsFor<S>;

		const ctor = target.constructor as any;
		if (!ctor[ATTACHMENT_PROPS]) ctor[ATTACHMENT_PROPS] = {} as Record<string, AttachmentPropertyOptionsFor<S>>;
		ctor[ATTACHMENT_PROPS][propertyKey] = attachment;

		return Property({ ...mikro, type: new AttachmentType(attachment) })(target, propertyKey);
	};
}

export function createAttachmentDecorator<S extends AttachmentSubscriber<any, any>>(options?: AttachmentDecoratorProps<S>) {
	return AttachmentDecorator<S>(options);
}

export function getAttachmentProps<S extends AttachmentSubscriber<any, any>>(entity: object): Record<string, AttachmentPropertyOptionsFor<S>> {
	const ctor = entity.constructor as any;
	const set: Record<string, AttachmentPropertyOptionsFor<S>> | undefined = ctor[ATTACHMENT_PROPS];
	return set ? set : {};
}

function splitOptions<T extends AttachmentDecoratorProps<any>, K extends readonly (keyof T)[]>(obj: T, mikroOptions: K) {
	type Key = K[number];

	const allowedSet = new Set<keyof T>(mikroOptions as readonly (keyof T)[]);
	const mikro = {} as Pick<T, Key>;
	const attachment = {} as Omit<T, Key>;

	for (const key in obj) {
		if (allowedSet.has(key as keyof T)) {
			(mikro as any)[key] = obj[key];
		} else {
			(attachment as any)[key] = obj[key];
		}
	}

	return { mikro, attachment };
}
