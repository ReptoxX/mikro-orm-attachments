import { PropertyOptions } from "@mikro-orm/core";
import type { DriverContract } from "flydrive/types";
import { ImageConverter } from "./converters/ImageConverter";
import { BlurhashOptions, Converter, ConverterOptions } from "./types/converter";
import { AttachmentSubscriber } from "./subscribers/AttachmentSubscriber";

type StringKeyOf<T> = Extract<keyof T, string>;

export type DriversOf<S> = S extends AttachmentSubscriber<infer TDrivers, any> ? TDrivers : never;
export type VariantsOf<S> = S extends AttachmentSubscriber<any, infer TVariants> ? TVariants : never;

export type VariantSelection<TVariants extends Record<string, VariantSpec>> =
	| ReadonlyArray<StringKeyOf<TVariants> | Record<string, VariantSpec>>
	| Partial<TVariants>
	| Record<string, VariantSpec>;

export interface AttachmentPropertyOptions<
	TDrivers extends Record<string, DriverContract> = Record<string, DriverContract>,
	TVariants extends Record<string, VariantSpec> = Record<string, VariantSpec>
> {
	folder?: string;
	blurhash?: boolean | BlurhashOptions;
	variants?: VariantSelection<TVariants>;
	driver?: StringKeyOf<TDrivers>;
}

export type AttachmentPropertyOptionsFor<S extends AttachmentSubscriber<any, any>> = AttachmentPropertyOptions<DriversOf<S>, VariantsOf<S>>;

export type NormalizedAttachmentPropertyOptions<
	TDrivers extends Record<string, DriverContract> = Record<string, DriverContract>,
	TVariants extends Record<string, VariantSpec> = Record<string, VariantSpec>
> = Omit<AttachmentPropertyOptions<TDrivers, TVariants>, "variants"> & {
	variants?: Record<string, VariantSpec>;
};

export type NormalizedAttachmentPropertyOptionsFor<S extends AttachmentSubscriber<any, any>> = NormalizedAttachmentPropertyOptions<DriversOf<S>, VariantsOf<S>>;

export const DEFAULT_ATTACHMENT_PROPERTY_OPTIONS: AttachmentPropertyOptions = {
	blurhash: true,
};

export const DEFAULT_ATTACHMENT_OPTIONS: Omit<AttachmentOptions, "drivers" | "defaultDriver" | "variants"> = {
	rename: true,
	converters: [new ImageConverter()],
};
export interface AttachmentOptions<
	TDrivers extends Record<string, DriverContract> = Record<string, DriverContract>,
	TVariants extends Record<string, VariantSpec> = Record<string, VariantSpec>
> {
	readonly drivers: TDrivers;
	readonly defaultDriver: StringKeyOf<TDrivers>;
	readonly rename?: boolean | ((file: File, columnName: string, entity: any) => string);
	readonly converters?: Converter[];
	readonly variants?: TVariants;
}

export const ALLOWED_PROPERTY_OPTIONS = [
	"accessor",
	"comment",
	"customOrder",
	"getter",
	"getterName",
	"hidden",
	"index",
	"lazy",
	"name",
	"nullable",
	"serializedName",
	"serializedPrimaryKey",
	"serializer",
	"version",
] as const;

export type AllowedPropertyOptions = (typeof ALLOWED_PROPERTY_OPTIONS)[number];

export interface AttachmentDecoratorProps<S extends AttachmentSubscriber<any, any>>
	extends AttachmentPropertyOptionsFor<S>,
		Pick<PropertyOptions<object>, AllowedPropertyOptions> {}

export interface AttachmentBase {
	drive: string;
	name: string;
	extname: string;
	size: number;
	mimeType: string;
	path: string;
	originalName: string;
	variants: Omit<AttachmentBase, "variants" | "originalName" | "drive">[];
}
export interface ImageAttachment extends AttachmentBase {
	blurhash?: string;
	meta: {
		date?: string;
		host?: string;
		dimension: {
			width: number;
			height: number;
		};
		gps?: {
			latitude?: number;
			longitude?: number;
			altitude?: number;
		};
		orientation?: {
			value: number;
			description?: string;
		};
	};
	path: string;
	url: string;
}

export interface VariantSpec extends ConverterOptions {}
