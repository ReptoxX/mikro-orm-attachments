import "../config/env";
import { Attachment } from "mikro-orm-attachments";
import sharp from "sharp";
import { orm } from "../db";
import { Project } from "../db/entities/Project";
import { attachmentSubscriber } from "../db/subscribers/attachmentSubscriber";

/**
 * Demonstrates + manually exercises AttachmentSubscriber#regenerateVariants.
 *
 * Run with: `bun run regenerate-variants` (from apps/example)
 *
 * - First run: seeds a Project with an avatar if none exists, then regenerates
 *   its variants (a no-op the first time right after upload, since the stored
 *   configHash already matches the live config).
 * - Change `thumbnail`'s resize height in src/db/subscribers/attachmentSubscriber.ts
 *   and re-run to see only the changed variant get rewritten.
 */

const em = orm.em.fork();
em.setFilterParams("tenant", { tenantId: 1 });

let project = await em.findOne(Project, {}, { filters: { softDelete: false } });

if (!project) {
	const png = await sharp({
		create: { width: 400, height: 400, channels: 3, background: { r: 255, g: 0, b: 0 } },
	})
		.png()
		.toBuffer();
	const file = new File([png], "seed-avatar.png", { type: "image/png" });

	project = em.create(Project, {
		tenantId: 1,
		name: "regenerate-variants seed",
		avatar: Attachment.fromFile(file),
	});
	await em.persist(project).flush();
	console.log(`Seeded Project #${project.id} with a fresh avatar.`);
}

async function dumpAvatar(label: string, projectId: number) {
	const rows = await em.getConnection().execute<{ avatar: string }[]>("select avatar from project where id = ?", [projectId]);
	console.log(`${label}:`, JSON.stringify(JSON.parse(rows[0].avatar), null, 2));
}

await dumpAvatar("Before", project.id);

await attachmentSubscriber.regenerateVariants(project, "avatar");
await em.flush();

await dumpAvatar("After", project.id);

await orm.close();
