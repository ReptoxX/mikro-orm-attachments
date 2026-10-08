/** Type-level checks, verified by `tsgo --noEmit`. */
import { defineEntity, type InferEntity, p } from "@mikro-orm/core";
import type { DriverContract } from "flydrive/types";

import type { Attachment } from "../Attachment";
import type { BaseConverter } from "../converters/BaseConverter";
import { attachment } from "../defineEntity";
import type { AttachmentSubscriber } from "../subscribers/AttachmentSubscriber";
import { AttachmentProperty } from "./AttachmentDecorator";

declare const webp: BaseConverter<any, any>;
declare const subscriber: AttachmentSubscriber<{ s3: DriverContract }, { thumbnail: BaseConverter<any, any> }>;

declare module "../typings" {
	interface Register {
		subscriber: typeof subscriber;
	}
}

export class Valid {
	@AttachmentProperty()
	plain?: Attachment | null;

	@AttachmentProperty({ variants: ["thumbnail"], driver: "s3" })
	global?: Attachment<"thumbnail">;

	@AttachmentProperty({ variants: [{ web: webp }] })
	inline: Attachment<"web">[] = [];

	@AttachmentProperty({ variants: ["thumbnail", { web: webp }] })
	mixed?: Attachment<"web" | "thumbnail">;
}

export class Invalid {
	// @ts-expect-error variant not declared
	@AttachmentProperty()
	missing?: Attachment<"thumbnail">;

	// @ts-expect-error inline variant name differs
	@AttachmentProperty({ variants: [{ webp }] })
	renamed?: Attachment<"web">[];

	// @ts-expect-error unknown global variant
	@AttachmentProperty({ variants: ["nope"] })
	unknown?: Attachment;

	// @ts-expect-error unknown driver
	@AttachmentProperty({ driver: "fs" })
	driver?: Attachment;

	// @ts-expect-error not an attachment
	@AttachmentProperty()
	name?: string;
}

const Project = defineEntity({
	name: "Project",
	properties: {
		id: p.integer().primary(),
		cover: attachment({ variants: ["thumbnail", { web: webp }] }).nullable(),
		screenshots: attachment({ variants: ["thumbnail"], multiple: true }),
		file: attachment(),
	},
});

declare const project: InferEntity<typeof Project>;
project.cover?.url("web");
project.screenshots[0]?.url("thumbnail");
project.file.url();
// @ts-expect-error variant not declared on this property
project.cover?.url("large");
// @ts-expect-error no variants declared
project.file.url("thumbnail");
// @ts-expect-error not an array
project.cover?.length;
// @ts-expect-error unknown global variant
attachment({ variants: ["nope"] });
