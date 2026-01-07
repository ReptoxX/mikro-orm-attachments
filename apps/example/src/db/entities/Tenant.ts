import {
	BooleanType,
	Collection,
	Entity,
	Index,
	ManyToOne,
	OneToMany,
	Property,
} from "@mikro-orm/core";
import { Model } from "../mixins/model";

export type TenantKind = "BRAND" | "AGENCY";

@Entity()
export class Tenant extends Model {
	@Index()
	@Property()
	kind!: TenantKind;

	@Index()
	@Property()
	name!: string;

	@ManyToOne(() => Tenant, { nullable: true })
	parent?: Tenant;

	@Property({ type: BooleanType, default: false })
	isCentral!: boolean;

	@OneToMany(() => Tenant, (t) => t.parent)
	children = new Collection<Tenant>(this);
}
