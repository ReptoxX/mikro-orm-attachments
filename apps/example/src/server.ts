import "./config/env";
import { Elysia, status, t } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { User } from "./db/entities/User";
import { errorHandler } from "./plugins/errorHandler";
import { db } from "./plugins/db";
import { Project } from "./db/entities/Project";
import { type } from "arktype";
import { Attachment } from "@monorepo/mikro-orm-attachments";

const app = new Elysia()
	.use(errorHandler)
	.use(openapi())
	.use(db())
	.onBeforeHandle(({ em }) => {
		em.setFilterParams("tenant", {
			tenantId: 1,
		});
	})
	.onError(({ error }) => {})
	.get(
		"/projects",
		({ em, query: { includeDeleted = 0 } }) => {
			return em.findAll(Project, {
				filters: {
					softDelete: includeDeleted === 0,
				},
			});
		},
		{
			query: type({
				"includeDeleted?": "string.numeric.parse | number |> 0 <= number <= 1",
			}),

			// query: z.object({
			// includeDeleted: z.coerce.number().max(1).min(0).optional(),
			// }),
		}
	)
	.post(
		"/projects",
		async ({ em, body }) => {
			const project = em.create(Project, {
				name: body.name,
				avatar: Attachment.fromFile(body.avatar),
			});
			await em.persist(project).flush();
			return Object.assign({}, project);
		},
		{
			// body: type({
			// 	name: "string",
			// 	avatar: "File",
			// }),
			body: t.Object({
				name: t.String(),
				avatar: t.File(),
			}),
			type: "multipart/form-data",
		}
	)
	.post(
		"/projects/from-url",
		async ({ em, body }) => {
			const project = em.create(Project, {
				name: body.name,
				avatar: await Attachment.fromUrl(body.avatar),
			});
			await em.persist(project).flush();
			return Object.assign({}, project);
		},
		{
			// body: type({
			// 	name: "string",
			// 	avatar: "File",
			// }),
			body: t.Object({
				name: t.String(),
				avatar: t.String(),
			}),
			type: "multipart/form-data",
		}
	)
	.delete(
		"/projects/:id",
		async ({ em, params }) => {
			const project = await em.findOne(Project, {
				id: params.id,
			});
			if (!project) {
				return status(404);
			}
			project.softDelete();
			await em.persist(project).flush();
			return Object.assign({}, project);
		},
		{
			params: type({ id: "string.numeric.parse | number" }),
		}
	)
	.get(
		"/project/:id/avatar",
		async ({ em, params, set }) => {
			const project = await em.findOne(Project, {
				id: params.id,
			});
			if (!project) {
				return status(404);
			}

			set.headers["content-type"] = project.avatar.getMimeType("thumbnail");
			return project.avatar.getBytes("thumbnail");
		},
		{
			params: type({ id: "string.numeric.parse | number" }),
		}
	)
	.post(
		"/projects/:id/restore",
		async ({ em, params }) => {
			const project = await em.findOne(
				Project,
				{
					id: params.id,
				},
				{ filters: { softDelete: false } }
			);
			if (!project) {
				return status(404);
			}
			project.restore();
			await em.persist(project).flush();
		},
		{
			params: type({ id: "string.numeric.parse | number" }),
		}
	)
	.listen(3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
