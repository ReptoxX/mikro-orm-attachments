import { Entity, Property } from "@mikro-orm/core";
import { TenantScoped } from "../mixins/tenantScoped";
import { SoftDeletable } from "../mixins/softDeletable";
import { Model } from "../mixins/model";
import {
	Attachment,
	AttachmentProperty,
} from "@monorepo/mikro-orm-attachments";

@Entity()
export class Project extends TenantScoped(SoftDeletable(Model)) {
	@Property()
	name!: string;

	@AttachmentProperty()
	avatar!: Attachment;
}
