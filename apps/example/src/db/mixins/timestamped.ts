import { type Opt, Property } from "@mikro-orm/core";
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
