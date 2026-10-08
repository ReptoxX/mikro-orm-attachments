import { helper } from "@mikro-orm/core";
import { Property } from "@mikro-orm/decorators/legacy";

import type { Attachment } from "../Attachment";
import { AttachmentType } from "../DatabaseType";
import type { AttachmentSubscriber } from "../subscribers/AttachmentSubscriber";
import {
	ALLOWED_PROPERTY_OPTIONS,
	type AttachmentDecoratorProps,
	type AttachmentPropertyOptionsFor,
	DEFAULT_ATTACHMENT_PROPERTY_OPTIONS,
	type RegisteredSubscriber,
	type VariantSpec,
	type VariantsOf,
} from "../typings";

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

type VariantEntry = Extract<keyof VariantsOf<RegisteredSubscriber>, string> | Record<string, VariantSpec>;
export type VariantInput = readonly VariantEntry[] | Record<string, VariantSpec>;

export type DeclaredVariants<V> = V extends readonly (infer E)[] ? (E extends string ? E : Extract<keyof E, string>) : Extract<keyof V, string>;

type AttachmentOf<P> = NonNullable<P> extends readonly (infer A)[] ? A : NonNullable<P>;

type PropertyError<P, Declared extends string> = [AttachmentOf<P>] extends [Attachment<infer V>]
	? string extends V
		? never
		: [Exclude<V, Declared>] extends [never]
			? never
			: `Variant "${Exclude<V, Declared>}" is missing in AttachmentProperty({ variants })`
	: "AttachmentProperty needs an Attachment or Attachment[] property";

type ValidTarget<T, K, Declared extends string> = K extends keyof T
	? [PropertyError<T[K], Declared>] extends [never]
		? unknown
		: { [P in K]: PropertyError<T[K], Declared> }
	: unknown;

export type AttachmentPropertyProps<V extends VariantInput> = Omit<AttachmentDecoratorProps<RegisteredSubscriber>, "variants"> & { variants?: V };

/**
 * Works for `Attachment` and `Attachment[]` properties. Options are typed from the subscriber in `Register`,
 * and the property's `Attachment<"variant">` names are checked against `variants`.
 */
export function AttachmentProperty<const V extends VariantInput = []>(options: AttachmentPropertyProps<V> = {}) {
	return AttachmentDecorator(options as AttachmentDecoratorProps<RegisteredSubscriber>) as <T extends object, K extends string>(
		target: T & ValidTarget<T, K, DeclaredVariants<V>>,
		propertyKey: K,
	) => void;
}

export function createAttachmentDecorator<S extends AttachmentSubscriber<any, any>>(options?: AttachmentDecoratorProps<S>) {
	return AttachmentDecorator<S>(options);
}

/** Reads managed entities from metadata (covers `defineEntity`), the static map covers unmanaged decorated instances. */
export function getAttachmentProps<S extends AttachmentSubscriber<any, any>>(entity: object): Record<string, AttachmentPropertyOptionsFor<S>> {
	const props: Record<string, AttachmentPropertyOptionsFor<S>> = { ...(entity.constructor as any)[ATTACHMENT_PROPS] };
	const meta = (entity as any).__helper ? helper(entity).__meta : undefined;
	for (const prop of meta?.props ?? []) {
		if (prop.customType instanceof AttachmentType) {
			props[prop.name] = prop.customType.options as AttachmentPropertyOptionsFor<S>;
		}
	}
	return props;
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
