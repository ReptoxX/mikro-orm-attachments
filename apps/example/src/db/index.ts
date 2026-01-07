import { MikroORM, type Options } from "@mikro-orm/core";
import { SqliteDriver } from "@mikro-orm/sqlite";
import { SQL } from "bun";
import { User } from "./entities/User";
import { TenantSubscriber } from "./subscribers/tenantSubscriber";
import { Project } from "./entities/Project";
import { env } from "../config/env";
import { AttachmentSubscriber } from "@monorepo/mikro-orm-attachments";

const connection = new SQL();
export const config: Options<SqliteDriver> = {
	driver: SqliteDriver,
	entities: [User, Project],
	dbName: env.DATABASE_URL,
	debug: false,
	subscribers: [new TenantSubscriber(), new AttachmentSubscriber()],
};

export const orm = await MikroORM.init(config);
try {
	await orm.schema.updateSchema();
} catch (error) {
	console.error("SCHEMA UPDATE FAILED", error);
	throw error;
}
