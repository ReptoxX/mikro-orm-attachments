import { Elysia } from "elysia";
import { orm } from "../db";

export function db() {
	return new Elysia({ name: "mikro-orm" }).derive(
		{ as: "scoped" },
		async function mikroOrm(ctx) {
			const em = orm.em.fork();
			return { em };
		}
	);
}
