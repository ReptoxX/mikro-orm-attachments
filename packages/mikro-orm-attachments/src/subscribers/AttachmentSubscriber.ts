import { EventSubscriber, FlushEventArgs } from "@mikro-orm/core";
import { Attachment } from "~/Attachment";
import { getAttachmentProps } from "~/decorators/AttachmentProperty";
import { ATTACHMENT_FN_PROCESS } from "~/symbols";
import { AttachmentOptions } from "~/typings";

export class AttachmentSubscriber implements EventSubscriber {
	#options: AttachmentOptions = {
		blurhash: true,
	};

	constructor(options: AttachmentOptions = {}) {
		this.#options = {
			...this.#options,
			...options,
		};
	}

	getSubscribedEvents(): string[] {
		return ["beforeFlush"];
	}

	async beforeFlush(args: FlushEventArgs): Promise<void> {
		const uow = args.uow;
		const entities = new Set([
			...uow.getChangeSets().map((cs) => cs.entity),
			...uow.getPersistStack(),
		]);
		for (const entity of entities) {
			await this.#handleEntity(entity);
		}
	}

	async #handleEntity(entity: any) {
		const props = getAttachmentProps(entity);
		for (const prop of Object.keys(props)) {
			const value = entity[prop];
			const config = props[prop];
			if (value instanceof Attachment) {
				await value[ATTACHMENT_FN_PROCESS](config, this.#options);
			}
		}
	}
}
