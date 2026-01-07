import { Entity, Property } from "@mikro-orm/core";
import { SoftDeletable } from "../mixins/softDeletable";
import { TenantScoped } from "../mixins/tenantScoped";
import { Model } from "../mixins/model";

@Entity()
export class User extends TenantScoped(SoftDeletable(Model)) {
	@Property()
	name!: string;

	@Property()
	email!: string;

	@Property()
	password!: string;

	@Property()
	activeTenantId!: number;
}
