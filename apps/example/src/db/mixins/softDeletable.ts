import { Filter, Index, Property } from "@mikro-orm/core";
import type { Constructor } from "../mixin";

export function SoftDeletable<TBase extends Constructor>(Base: TBase) {
	@Filter({
		name: "softDelete",
		cond: () => ({ deletedAt: null }),
		default: true,
	})
	abstract class SoftDeletableEntity extends Base {
		@Index()
		@Property({ nullable: true })
		deletedAt: Date | null = null;

		softDelete(now = new Date()) {
			this.deletedAt = now;
		}

		restore() {
			this.deletedAt = null;
		}
	}

	return SoftDeletableEntity;
}
