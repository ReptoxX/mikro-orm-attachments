import { Property, PropertyOptions } from "@mikro-orm/core";
import { AttachmentType } from "~/DatabaseType";
import {
	AttachmentPropertyOptions,
	DEFAULT_ATTACHMENT_PROPERTY_OPTIONS,
} from "~/typings";

const ATTACHMENT_PROPS = Symbol("attachment:props");
type AttachmentProps = Record<string, AttachmentPropertyOptions>;

type AttachmentPropertyArgs<T extends object> = Omit<
	PropertyOptions<T>,
	"type"
> & {
	config?: AttachmentPropertyOptions;
};

export function AttachmentProperty<T extends object>(
	options: AttachmentPropertyArgs<T> = { config: {} }
) {
	return (target: any, propertyKey: string) => {
		let { config, ...rest } = options;

		config = {
			...DEFAULT_ATTACHMENT_PROPERTY_OPTIONS,
			...config,
		};

		const ctor = target.constructor as any;
		if (!ctor[ATTACHMENT_PROPS])
			ctor[ATTACHMENT_PROPS] = {} as AttachmentProps;
		ctor[ATTACHMENT_PROPS][propertyKey] = config;

		return Property({ ...rest, type: new AttachmentType(config) })(
			target,
			propertyKey
		);
	};
}

export function getAttachmentProps(entity: object): AttachmentProps {
	const ctor = entity.constructor as any;
	const set: AttachmentProps | undefined = ctor[ATTACHMENT_PROPS];
	return set ? set : {};
}
