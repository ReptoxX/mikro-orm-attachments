import {
	ChangeSetType,
	EventSubscriber,
	FlushEventArgs,
	type EventArgs,
} from "@mikro-orm/core";

function hasTenantIdField(entity: any): boolean {
	return entity && typeof entity === "object" && "tenantId" in entity;
}

export class TenantSubscriber implements EventSubscriber {
	getSubscribedEvents(): string[] {
		return ["onFlush"];
	}

	onFlush(args: FlushEventArgs): void {
		const tenantId = args.em.getFilterParams("tenant")?.tenantId;
		const uow = args.uow;

		for (const cs of uow.getChangeSets()) {
			const entity = cs.entity as any;

			if (!hasTenantIdField(entity)) continue;

			if (cs.type === ChangeSetType.CREATE) {
				// Auto-assign tenantId if missing
				if (entity.tenantId == null) {
					// console.log("create", entity, scope);
					entity.tenantId = tenantId;

					uow.recomputeSingleChangeSet(entity);
				}
			}

			// 	// For both create + update, forbid writes outside allowed scope
			// 	// (prevents someone from manually setting tenantId to another tenant)
			if (entity.tenantId != null) {
				const allowed = +tenantId === entity.tenantId;
				// console.log("allowed", allowed, tenantId, entity.tenantId);

				if (!allowed) {
					throw new Error(
						`Illegal tenant write: tenantId=${tenantId} not in scope`
					);
				}
			}
		}
	}
	// }
}
