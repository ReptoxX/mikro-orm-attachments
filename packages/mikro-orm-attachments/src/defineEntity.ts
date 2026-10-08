import { defineEntity } from "@mikro-orm/core";

import type { Attachment } from "./Attachment";
import { AttachmentType } from "./DatabaseType";
import type { DeclaredVariants, VariantInput } from "./decorators/AttachmentDecorator";
import type { AttachmentPropertyOptions, AttachmentPropertyOptionsFor, RegisteredSubscriber } from "./typings";

export type AttachmentBuilderOptions<V extends VariantInput, M extends boolean> = Omit<AttachmentPropertyOptionsFor<RegisteredSubscriber>, "variants"> & {
	variants?: V;
	multiple?: M;
};

type AttachmentValue<V extends string, M extends boolean> = M extends true ? Attachment<V>[] : Attachment<V>;

/** `defineEntity` property builder, e.g. `cover: attachment({ variants: ["web"] }).nullable()`. */
export function attachment<const V extends VariantInput = [], const M extends boolean = false>(options: AttachmentBuilderOptions<V, M> = {}) {
	const { multiple: _multiple, ...rest } = options;
	return defineEntity.properties.type(new AttachmentType<AttachmentValue<DeclaredVariants<V>, M>>(rest as AttachmentPropertyOptions));
}
