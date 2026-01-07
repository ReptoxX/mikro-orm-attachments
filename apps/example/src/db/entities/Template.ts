import {
	Collection,
	Entity,
	Enum,
	OneToMany,
	type Opt,
	Property,
} from "@mikro-orm/core";
import { Model } from "../mixins/model";
import { TenantScoped } from "../mixins/tenantScoped";
import { SoftDeletable } from "../mixins/softDeletable";

@Entity()
export class Template extends TenantScoped(SoftDeletable(Model)) {
	@Property()
	name!: string;

	@Property()
	description!: string;

	@Property({ nullable: true })
	backgroundColor?: string & Opt;

	@Property({ nullable: true })
	foregroundColor?: string & Opt;

	@Property({ nullable: true })
	labelColor?: string & Opt;

	@Property({ nullable: true })
	alternativeText?: string;

	@Property({ default: true })
	showQr: boolean = true;

	@Property({ nullable: true })
	qrContent?: string;

	@Enum({ items: () => PassTemplatesStyle, nativeEnumName: "template_style" })
	style: PassTemplatesStyle & Opt = PassTemplatesStyle.STORECARD;

	@OneToMany(() => TemplateImage, (i) => i.template, { orphanRemoval: true })
	images? = new Collection<TemplateImage>(this);

	@OneToMany(() => TemplateField, (f) => f.template, { orphanRemoval: true })
	fields? = new Collection<TemplateField>(this);

	@OneToMany(() => Pass, (p) => p.template, { orphanRemoval: true })
	passes? = new Collection<Pass>(this);
}
