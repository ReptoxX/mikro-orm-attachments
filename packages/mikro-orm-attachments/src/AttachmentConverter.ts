import { join } from "node:path";
import { fileTypeFromBuffer } from "file-type";
import type { Disk } from "flydrive";
import type { DriverContract } from "flydrive/types";
import { v7 } from "uuid";

import type { Attachment } from "./Attachment";
import { BaseConverter } from "./converters/BaseConverter";
import { ATTACHMENT_FILE, ATTACHMENT_FN_PROCESS, ATTACHMENT_LOADED } from "./symbols";
import type { AttachmentConverterProps } from "./types/attachment";
import type { AttachmentBase, AttachmentOptions, ImageAttachment, NormalizedAttachmentPropertyOptions, RegenerateVariantsOptions, VariantSpec } from "./typings";

type FileInfo = { extname: string; mimeType: string; size: number };
type VariantEntry = AttachmentBase["variants"][number];

export class AttachmentConverter<
	TDrivers extends Record<string, DriverContract> = Record<string, DriverContract>,
	TVariants extends Record<string, VariantSpec> = Record<string, VariantSpec>,
> {
	private file?: File;
	private readonly disk: Disk;
	private buffer?: Buffer;
	private readonly modelOptions: NormalizedAttachmentPropertyOptions<TDrivers, TVariants>;
	private readonly config: AttachmentOptions<TDrivers, TVariants>;
	// biome-ignore lint/suspicious/noExplicitAny: entity comes from mikro-orm and there it's set to any
	private readonly entity: any;
	private readonly columnName: string;
	private readonly diskName: string;
	private fileInfo?: FileInfo;

	constructor(
		private readonly att: Attachment,
		props: AttachmentConverterProps<TDrivers, TVariants>,
	) {
		const { disk, options, config, entity, columnName, diskName } = props;
		this.disk = disk;
		this.modelOptions = options;
		this.config = config;
		this.entity = entity;
		this.columnName = columnName;
		this.diskName = diskName;
	}

	done(data: AttachmentBase) {
		this.att[ATTACHMENT_FN_PROCESS](data);
	}

	generateKey(name: string, ...path: string[]) {
		let folder = this.modelOptions.folder ?? "";
		folder = folder.replace(/:([A-Za-z0-9_]+)/g, (_full, key: string) => {
			const value = this.entity[key];

			if (value === undefined || value === null) {
				throw new Error(
					`Missing value for Attachment path "${key}" in entity ${this.entity.constructor.name}. Please ensure that the referenced property is computed before the attachment is processed. (Auto incrementing fields are not supported.)`,
				);
			}

			return this.normalizeFileName(String(value));
		});

		return join(folder, name, ...path);
	}

	normalizeFileName(fileName: string) {
		return encodeURIComponent(fileName.replace(/[^a-zA-Z0-9.-]/g, "_")).toLowerCase();
	}

	#baseNameOf(key: string) {
		// biome-ignore lint/style/noNonNullAssertion: a storage key always has at least one path/name segment
		return key.split("/").pop()!.split(".").shift()!;
	}

	async fileToBuffer() {
		if (this.buffer) {
			return this.buffer;
		}
		// biome-ignore lint/style/noNonNullAssertion: only reached from the upload path, where the file is guaranteed to be set
		const arrayBuffer = await this.file!.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		this.buffer = buffer;
		return buffer;
	}

	getFileName() {
		// biome-ignore lint/style/noNonNullAssertion: only reached from the upload path, where the file is guaranteed to be set
		const file = this.file!;
		if (!this.config.rename) {
			return this.normalizeFileName(file.name);
		}
		if (typeof this.config.rename === "function") {
			return this.normalizeFileName(this.config.rename(file, this.columnName, this.entity));
		}

		return this.normalizeFileName(v7());
	}

	async getFileType() {
		return fileTypeFromBuffer(await this.fileToBuffer());
	}

	async analyseFile() {
		// biome-ignore lint/style/noNonNullAssertion: only reached from the upload path, where the file is guaranteed to be set
		const file = this.file!;
		const fileType = await this.getFileType();
		this.fileInfo = {
			extname: fileType?.ext ?? file.name.split(".").pop() ?? "",
			mimeType: fileType?.mime ?? file.type,
			size: file.size,
		};
	}

	async uploadFile(key: string, buffer: Buffer) {
		await this.disk.put(key, buffer);
	}

	#resolveConverter(variantName: string, converter?: VariantSpec): VariantSpec | undefined {
		return this.config.variants?.[variantName] ?? converter;
	}

	async pickConverter(variantName: string, converter?: VariantSpec) {
		if (!this.fileInfo) {
			throw new Error("Attachment Converter: File info not found");
		}
		const resolved = this.#resolveConverter(variantName, converter);
		if (resolved instanceof BaseConverter) {
			if (
				await resolved.supports({
					size: this.fileInfo.size,
					mimeType: this.fileInfo.mimeType,
					buffer: await this.fileToBuffer(),
					extname: this.fileInfo.extname,
				})
			) {
				return resolved;
			}
		}
		return null;
	}

	async #buildVariant(variantName: string, variant: VariantSpec, converter: VariantSpec, buffer: Buffer, fileInfo: FileInfo, baseName: string): Promise<VariantEntry> {
		const converterOutput = await converter.handle({
			buffer,
			size: fileInfo.size,
			mimeType: fileInfo.mimeType,
			extname: fileInfo.extname,
			variantName,
			variant,
		});
		const variantKey = this.generateKey(baseName, `${variantName}.${converterOutput.extname}`);
		await this.uploadFile(variantKey, converterOutput.buffer);
		return {
			name: variantName,
			extname: converterOutput.extname,
			size: converterOutput.buffer.length,
			mimeType: converterOutput.mimeType,
			path: variantKey,
			configHash: converter.configFingerprint(),
		};
	}

	async process() {
		if (this.att[ATTACHMENT_LOADED]) {
			throw new Error("Attachment already processed, please use the Attachment.fromFile method to create a new attachment");
		}
		// biome-ignore lint/style/noNonNullAssertion: file is guaranteed to be non-null
		this.file = this.att[ATTACHMENT_FILE]!;

		await this.analyseFile();
		const buffer = await this.fileToBuffer();
		const fileInfo = this.fileInfo as FileInfo;

		const name = this.getFileName();
		const extname = fileInfo.extname;
		const originalKey = this.generateKey(name, `${name}.${extname}`);

		await this.uploadFile(originalKey, buffer);

		const data: AttachmentBase | ImageAttachment = {
			name: name,
			extname,
			size: this.file.size,
			drive: this.diskName,
			mimeType: this.file.type,
			path: originalKey,
			url: await this.disk.getUrl(originalKey),
			originalName: this.file.name,
			variants: [],
		};
		const metadata = await this.config.metadata?.metadata({
			buffer,
			size: fileInfo.size,
			mimeType: fileInfo.mimeType,
			extname: fileInfo.extname,
		});
		data.meta = metadata;

		if (this.modelOptions.variants) {
			const baseName = this.#baseNameOf(originalKey);
			for (const [variantName, variant] of Object.entries(this.modelOptions.variants)) {
				const converter = await this.pickConverter(variantName, variant);
				if (!converter) {
					throw new Error(`Attachment Converter: No converter for the variant ${variantName} found`);
				}
				data.variants.push(await this.#buildVariant(variantName, variant, converter, buffer, fileInfo, baseName));
			}
		}

		if (fileInfo.mimeType.startsWith("image/")) {
			// const blurhashEnabled = typeof this.modelOptions.blurhash === "boolean" ? this.modelOptions.blurhash : this.modelOptions.blurhash?.enabled;
			// if (blurhashEnabled) {
			// 	(data as ImageAttachment).blurhash = await imageToBlurhash(buffer, typeof this.modelOptions.blurhash === "object" ? this.modelOptions.blurhash : undefined);
			// }
		}

		this.done(data);
	}

	/**
	 * Re-runs variant generation for an already-persisted attachment against the
	 * *current* live variant config. Never touches the original file. Variants whose
	 * stored `configHash` already matches the current config are left completely
	 * untouched (no re-upload, no disk read at all if nothing needs regenerating).
	 */
	async regenerateVariants(current: AttachmentBase, opts: RegenerateVariantsOptions = {}): Promise<AttachmentBase> {
		const fileInfo: FileInfo = { extname: current.extname, mimeType: current.mimeType, size: current.size };
		this.fileInfo = fileInfo;
		const baseName = this.#baseNameOf(current.path);
		const declared = this.modelOptions.variants ?? {};
		const existingByName = new Map(current.variants.map((v) => [v.name, v]));
		const nextVariants: VariantEntry[] = [];

		const ensureBuffer = async (): Promise<Buffer> => {
			if (!this.buffer) {
				this.buffer = Buffer.from(await this.disk.getBytes(current.path));
			}
			// biome-ignore lint/style/noNonNullAssertion: just assigned above if it was missing
			return this.buffer!;
		};

		for (const [variantName, variant] of Object.entries(declared)) {
			const existing = existingByName.get(variantName);

			if (opts.only && !opts.only.includes(variantName)) {
				if (existing) {
					nextVariants.push(existing);
				}
				continue;
			}

			const resolved = this.#resolveConverter(variantName, variant);
			if (!resolved) {
				throw new Error(`Attachment Converter: No converter for the variant ${variantName} found`);
			}
			const fingerprint = resolved.configFingerprint();

			if (!opts.force && existing?.configHash === fingerprint) {
				nextVariants.push(existing);
				continue;
			}

			const buffer = await ensureBuffer();
			const converter = await this.pickConverter(variantName, variant);
			if (!converter) {
				throw new Error(`Attachment Converter: No converter for the variant ${variantName} found`);
			}
			const entry = await this.#buildVariant(variantName, variant, converter, buffer, fileInfo, baseName);
			if (existing && existing.path !== entry.path) {
				await this.disk.delete(existing.path).catch(() => {});
			}
			nextVariants.push(entry);
		}

		if (!opts.only) {
			for (const existing of current.variants) {
				if (declared[existing.name]) {
					continue;
				}
				if (opts.deleteOrphaned) {
					await this.disk.delete(existing.path).catch(() => {});
				} else {
					nextVariants.push(existing);
				}
			}
		}

		return { ...current, variants: nextVariants };
	}
}
