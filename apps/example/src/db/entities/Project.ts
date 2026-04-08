import { Entity, Property } from "@mikro-orm/decorators/legacy";
import { TenantScoped } from "../mixins/tenantScoped";
import { SoftDeletable } from "../mixins/softDeletable";
import { Model } from "../mixins/model";
import { Attachment } from "@monorepo/mikro-orm-attachments";
import { AttachmentProperty } from "../subscribers/attachmentSubscriber";

@Entity()
export class Project extends TenantScoped(SoftDeletable(Model)) {
	@Property()
	name!: string;

	@AttachmentProperty({ variants: ["thumbnail"] })
	avatar!: Attachment<"thumbnail">;
}
