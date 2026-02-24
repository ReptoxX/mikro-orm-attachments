import { PrimaryKey, Entity } from "@mikro-orm/decorators/legacy";
import { Timestamped } from "./timestamped";

@Entity({ abstract: true })
export abstract class BasicModel {
	@PrimaryKey()
	id!: number;
}

export abstract class Model extends Timestamped(BasicModel) {}
