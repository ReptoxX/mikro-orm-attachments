import {
	BeforeUpdate,
	Filter,
	Index,
	type Opt,
	Property,
} from "@mikro-orm/core";
import type { Constructor } from "../mixin";

export interface ITenantScoped {
	tenantId: number;
}

export function TenantScoped<TBase extends Constructor>(Base: TBase) {
	@Filter({
		name: "tenant",
		cond: (args) => ({ tenantId: args.tenantId }),
		default: true,
	})
	abstract class TenantScopedEntity extends Base implements ITenantScoped {
		@Index()
		@Property()
		tenantId!: number & Opt;

		/**
		 * Prevent cross-tenant moves once persisted.
		 * Remove if you truly need to re-assign tenancy.
		 */
		@BeforeUpdate()
		preventTenantChange() {
			// `__originalEntityData` is MikroORM internals; it works, but it is internal.
			// If you dislike this, enforce immutability in repositories instead.
			const original = (this as any).__originalEntityData?.tenantId;

			if (original && original !== this.tenantId) {
				throw new Error("tenantId cannot be changed after creation");
			}
		}
	}

	return TenantScopedEntity;
}
