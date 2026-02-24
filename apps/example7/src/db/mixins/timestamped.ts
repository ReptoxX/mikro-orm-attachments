import { type Opt } from "@mikro-orm/core";
import { Property } from "@mikro-orm/decorators/legacy";
import type { Constructor } from "../mixin";

export function Timestamped<TBase extends Constructor>(Base: TBase) {
	abstract class TimestampedEntity extends Base {
		@Property()
		createdAt: Date & Opt = new Date();

		@Property({ onUpdate: () => new Date() })
		updatedAt: Date & Opt = new Date();
	}

	return TimestampedEntity;
}
