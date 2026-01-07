import { Entity, Opt, PrimaryKey, Property } from "@mikro-orm/core";
import { Timestamped } from "./timestamped";

@Entity({ abstract: true })
export abstract class BasicModel {
	@PrimaryKey()
	id!: number;
}

export abstract class Model extends Timestamped(BasicModel) {}
