import { EventSubscriber, MikroORM, type Options, SqliteDriver } from "@mikro-orm/sql";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Database } from "bun:sqlite";
import { attachmentSubscriber } from "./subscribers/attachmentSubscriber";
import { env } from "../config/env";
import { TenantSubscriber } from "./subscribers/tenantSubscriber";

import { User } from "./entities/User";
import { Project } from "./entities/Project";
import { ReflectMetadataProvider } from "@mikro-orm/decorators/legacy";

export const config: Options<SqliteDriver> = {
	metadataProvider: ReflectMetadataProvider,
	driver: SqliteDriver,
	driverOptions: new BunSqliteDialect({
		database: new Database(env.DATABASE_URL),
	}),
	entities: [User, Project],
	dbName: env.DATABASE_URL,
	debug: false,
	subscribers: [new TenantSubscriber(), attachmentSubscriber],
};

export const orm = await MikroORM.init(config);
try {
	await orm.schema.update();
} catch (error) {
	console.error("SCHEMA UPDATE FAILED", error);
	throw error;
}
