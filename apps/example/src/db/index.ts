import { MikroORM, type Options } from "@mikro-orm/core";
import { SqliteDriver } from "@mikro-orm/sqlite";
import { attachmentSubscriber } from "./subscribers/attachmentSubscriber";
import { env } from "../config/env";
import { TenantSubscriber } from "./subscribers/tenantSubscriber";

import { User } from "./entities/User";
import { Project } from "./entities/Project";

export const config: Options<SqliteDriver> = {
	driver: SqliteDriver,
	entities: [User, Project],
	dbName: env.DATABASE_URL,
	debug: false,
	subscribers: [new TenantSubscriber(), attachmentSubscriber],
};

export const orm = await MikroORM.init(config);
try {
	await orm.schema.updateSchema();
} catch (error) {
	console.error("SCHEMA UPDATE FAILED", error);
	throw error;
}
