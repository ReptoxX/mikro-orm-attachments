import type { Disk } from "flydrive";
import type { DriverContract } from "flydrive/types";
import type { AttachmentOptions, NormalizedAttachmentPropertyOptions, VariantSpec } from "../typings";

export type AttachmentConverterProps<
	TDrivers extends Record<string, DriverContract> = Record<string, DriverContract>,
	TVariants extends Record<string, VariantSpec> = Record<string, VariantSpec>
> = {
	entity: any;
	columnName: string;
	disk: Disk;
	diskName: string;
	options: NormalizedAttachmentPropertyOptions<TDrivers, TVariants>;
	config: AttachmentOptions<TDrivers, TVariants>;
};
