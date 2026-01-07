import { EntityManager } from "@mikro-orm/core";
import Elysia, { InferContext } from "elysia";
import { orm } from "../../db";
import { db } from "../../plugins/db";

export class AuthService {
	constructor(private readonly em: EntityManager) {}

	async login(email: string, password: string): Promise<boolean> {
		console.log(email, password);
		return true;
	}
}

export const authService = new Elysia()
	.use(db(orm))
	.decorate(
		"authService",
		({ em }: { em: EntityManager }) => new AuthService(em)
	);
