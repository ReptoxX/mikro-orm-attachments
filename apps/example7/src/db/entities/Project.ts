import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { TenantScoped } from "../mixins/tenantScoped";
import { SoftDeletable } from "../mixins/softDeletable";
import { Model } from "../mixins/model";
import { Attachment } from "@monorepo/mikro-orm-attachments";
import { AttachmentProperty } from "../subscribers/attachmentSubscriber";
import { AttachmentType } from "../../../node_modules/@monorepo/mikro-orm-attachments/src/DatabaseType";

@Entity()
export class Project extends TenantScoped(SoftDeletable(Model)) {
	@Property()
	name!: string;

	@AttachmentProperty({ variants: ["thumbnail"] })
	avatar!: Attachment<"thumbnail">;
}
