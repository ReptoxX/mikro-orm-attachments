/** biome-ignore-all lint/suspicious/noExplicitAny: MikroORM uses any */
import type { EventArgs, FlushEventArgs } from "@mikro-orm/core";
import { Disk } from "flydrive";
import type { DriverContract } from "flydrive/types";

import { Attachment } from "../Attachment";
import { AttachmentConverter } from "../AttachmentConverter";
import { createAttachmentDecorator, getAttachmentProps } from "../decorators/AttachmentDecorator";
import { ATTACHMENT_DISK, ATTACHMENT_FN_KEYS, ATTACHMENT_FN_SAVE, ATTACHMENT_FN_UPDATE, ATTACHMENT_LOADED } from "../symbols";
import {
	type AttachmentBase,
	type AttachmentDecoratorProps,
	type AttachmentOptions,
	type AttachmentPropertyOptions,
	DEFAULT_ATTACHMENT_OPTIONS,
	type RegenerateVariantsOptions,
	type VariantSelection,
	type VariantSpec,
} from "../typings";

interface EventSubscriber {
	onLoad(args: any): Promise<void>;
	beforeFlush(args: any): Promise<void>;
	afterDelete(args: any): Promise<void>;
}

export class AttachmentSubscriber<const TDrivers extends Record<string, DriverContract>, const TVariants extends Record<string, VariantSpec>>
	implements EventSubscriber
{
	private readonly disks: Map<Extract<keyof TDrivers, string>, Disk>;
	constructor(private readonly options: AttachmentOptions<TDrivers, TVariants>) {
		this.options = {
			...DEFAULT_ATTACHMENT_OPTIONS,
			...this.options,
		};
		this.disks = new Map(Object.entries(this.options.drivers).map(([key, driver]) => [key as Extract<keyof TDrivers, string>, new Disk(driver)]));
	}

	async onLoad(args: any): Promise<void> {
		const { entity } = args as EventArgs<any>;
		const props = getAttachmentProps<AttachmentSubscriber<TDrivers, TVariants>>(entity);
		for (const prop of Object.keys(props)) {
			const value = entity[prop];
			const config = props[prop];
			if (value instanceof Attachment) {
				const disk = this.#getDisk(config, value.getDrive() as Extract<keyof TDrivers, string>, false);
				if (!disk) {
					continue;
				}
				value[ATTACHMENT_DISK] = disk;
			}
		}
	}

	#getDisk(config: AttachmentPropertyOptions<TDrivers, TVariants>, dbDriver?: Extract<keyof TDrivers, string>, throwError?: boolean): Disk | null {
		let disk = this.disks.get(dbDriver ?? config.driver ?? this.options.defaultDriver);
		if (dbDriver && !disk) {
			disk = this.disks.get(config.driver ?? this.options.defaultDriver);
		}
		if (!disk) {
			if (throwError) {
				throw new Error(`Unknown attachment driver "${String(dbDriver ?? config.driver ?? this.options.defaultDriver)}"`);
			}
			return null;
		}
		return disk;
	}

	async beforeFlush(args: any): Promise<void> {
		const { uow } = args as FlushEventArgs;
		const entities = new Set([...uow.getChangeSets().map((cs) => cs.entity), ...uow.getPersistStack()]);
		for (const entity of entities) {
			await this.#handleEntity(entity);
		}
	}

	async #handleEntity(entity: any) {
		const props = getAttachmentProps<AttachmentSubscriber<TDrivers, TVariants>>(entity);
		for (const prop of Object.keys(props)) {
			const value = entity[prop];
			const config = props[prop];
			if (value instanceof Attachment) {
				if (value[ATTACHMENT_LOADED]) {
					continue;
				}
				const disk = this.#getDisk(config);
				if (!disk) {
					continue;
				}
				value[ATTACHMENT_DISK] = disk;
				const variants = this.#normalizeVariants(config.variants);
				const converter = new AttachmentConverter(value, {
					disk,
					options: { ...config, variants },
					config: this.options,
					entity: entity,
					columnName: prop,
					diskName: config.driver ?? this.options.defaultDriver,
				});
				try {
					await converter.process();
				} catch (error) {
					console.error(error);
					throw new Error("Failed to process attachment");
				}
			}
		}
	}

	async afterDelete(args: any): Promise<void> {
		const { entity } = args as EventArgs<any>;
		await this.#handleDelete(entity);
	}

	async #handleDelete(entity: any) {
		const props = getAttachmentProps<AttachmentSubscriber<TDrivers, TVariants>>(entity);
		for (const prop of Object.keys(props)) {
			const value = entity[prop];
			const config = props[prop];

			if (!(value instanceof Attachment) || !value[ATTACHMENT_LOADED]) {
				continue;
			}

			const disk = value.getDisk() ?? this.#getDisk(config, value.getDrive() as Extract<keyof TDrivers, string>, false);
			if (!disk) {
				continue;
			}

			for (const key of value[ATTACHMENT_FN_KEYS]()) {
				try {
					await disk.delete(key);
				} catch (error) {
					console.warn(
						`AttachmentSubscriber: failed to delete attachment file "${key}" for property "${prop}" on ${entity.constructor?.name ?? "entity"}`,
						error
					);
				}
			}
		}
	}

	AttachmentDecorator(options?: AttachmentDecoratorProps<AttachmentSubscriber<TDrivers, TVariants>>) {
		return createAttachmentDecorator<AttachmentSubscriber<TDrivers, TVariants>>(options);
	}

	/**
	 * Re-runs variant generation for an already-persisted attachment property against
	 * the current, live variant config. Only touches variants (add/changed/removed);
	 * the original file is never re-uploaded. The entity must already be loaded (e.g.
	 * fetched via the EntityManager, or previously flushed) - call `em.persist(entity).flush()`
	 * afterwards to write the result back.
	 */
	async regenerateVariants(entity: any, propertyName: string, opts: RegenerateVariantsOptions = {}): Promise<void> {
		const props = getAttachmentProps<AttachmentSubscriber<TDrivers, TVariants>>(entity);
		const config = props[propertyName];
		if (!config) {
			throw new Error(`No attachment property "${propertyName}" on ${entity.constructor.name}`);
		}

		const value = entity[propertyName];
		if (!(value instanceof Attachment) || !value[ATTACHMENT_LOADED]) {
			throw new Error(`Attachment property "${propertyName}" must be loaded before regenerating variants (flush or fetch the entity first).`);
		}

		// biome-ignore lint/style/noNonNullAssertion: #getDisk with throwError=true never returns null
		const disk = this.#getDisk(config, value.getDrive() as Extract<keyof TDrivers, string>, true)!;
		value[ATTACHMENT_DISK] = disk;

		const variants = this.#normalizeVariants(config.variants);
		const converter = new AttachmentConverter(value, {
			disk,
			options: { ...config, variants },
			config: this.options,
			entity,
			columnName: propertyName,
			diskName: value.getDrive() || (config.driver ?? this.options.defaultDriver),
		});

		const current = value[ATTACHMENT_FN_SAVE]() as AttachmentBase;
		const updated = await converter.regenerateVariants(current, opts);
		value[ATTACHMENT_FN_UPDATE](updated);
	}

	#normalizeVariants(variants: VariantSelection<TVariants> | undefined): Record<string, VariantSpec> | undefined {
		if (!variants) return undefined;

		if (Array.isArray(variants)) {
			const out: Record<string, VariantSpec> = {};
			for (const entry of variants) {
				if (typeof entry === "string") {
					const fromGlobal = this.options.variants?.[entry as keyof TVariants];
					if (!fromGlobal) {
						throw new Error(`Unknown attachment variant "${entry}"`);
					}
					out[entry] = fromGlobal;
				} else if (entry && typeof entry === "object") {
					Object.assign(out, entry);
				}
			}
			return out;
		}

		if (variants && typeof variants === "object") {
			return variants as Record<string, VariantSpec>;
		}

		return undefined;
	}
}
