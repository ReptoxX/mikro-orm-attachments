import { EventArgs, EventSubscriber, FlushEventArgs } from "@mikro-orm/core";
import { Disk } from "flydrive";
import { Attachment } from "../Attachment";
import { AttachmentConverter } from "../converters/AttachmentConverter";
import { createAttachmentDecorator, getAttachmentProps } from "../decorators/AttachmentDecorator";
import { ATTACHMENT_DISK, ATTACHMENT_LOADED } from "../symbols";
import { AttachmentOptions, AttachmentDecoratorProps, DEFAULT_ATTACHMENT_OPTIONS, VariantSelection, VariantSpec, AttachmentPropertyOptions } from "../typings";
import { DriverContract } from "flydrive/types";

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

	getSubscribedEvents(): string[] {
		return ["onLoad", "beforeFlush"];
	}

	async onLoad(args: EventArgs<any>): Promise<void> {
		const entity = args.entity;
		const props = getAttachmentProps<AttachmentSubscriber<TDrivers, TVariants>>(entity);
		for (const prop of Object.keys(props)) {
			const value = entity[prop];
			const config = props[prop];
			if (value instanceof Attachment) {
				const disk = this.#getDisk(config, value.getDrive() as Extract<keyof TDrivers, string>);
				value[ATTACHMENT_DISK] = disk;
			}
		}
	}

	#getDisk(config: AttachmentPropertyOptions<TDrivers, TVariants>, dbDriver?: Extract<keyof TDrivers, string>): Disk {
		let disk = this.disks.get(dbDriver ?? config.driver ?? this.options.defaultDriver);
		if (dbDriver && !disk) {
			disk = this.disks.get(config.driver ?? this.options.defaultDriver);
		}
		if (!disk) {
			throw new Error(`Unknown attachment driver "${String(dbDriver ?? config.driver ?? this.options.defaultDriver)}"`);
		}
		return disk;
	}

	async beforeFlush(args: FlushEventArgs): Promise<void> {
		const uow = args.uow;
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

	AttachmentDecorator(options?: AttachmentDecoratorProps<AttachmentSubscriber<TDrivers, TVariants>>) {
		return createAttachmentDecorator<AttachmentSubscriber<TDrivers, TVariants>>(options);
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
