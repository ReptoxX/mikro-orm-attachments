import { Disk } from "flydrive";
import { Attachment } from "../Attachment";
import { ATTACHMENT_FILE, ATTACHMENT_FN_PROCESS, ATTACHMENT_LOADED } from "../symbols";
import { AttachmentConverterProps } from "../types/attachment";
import { AttachmentBase, AttachmentOptions, ImageAttachment, VariantSpec } from "../typings";
import type { NormalizedAttachmentPropertyOptions } from "../typings";
import { join } from "path";
import { v7 } from "uuid";
import { fileTypeFromBuffer, fileTypeFromFile } from "file-type";
import { imageToBlurhash } from "../utils/helpers";
import { ImageConverter } from "./ImageConverter";
import type { DriverContract } from "flydrive/types";
import { BlurhashOptions } from "../types/converter";

export class AttachmentConverter<
	TDrivers extends Record<string, DriverContract> = Record<string, DriverContract>,
	TVariants extends Record<string, VariantSpec> = Record<string, VariantSpec>
> {
	private readonly file: File;
	private readonly disk: Disk;
	private buffer?: Buffer;
	private readonly modelOptions: NormalizedAttachmentPropertyOptions<TDrivers, TVariants>;
	private readonly config: AttachmentOptions<TDrivers, TVariants>;
	private readonly entity: any;
	private readonly columnName: string;
	private readonly diskName: string;
	private fileInfo?: {
		extname: string;
		mimeType: string;
		size: number;
	};

	constructor(private readonly att: Attachment, props: AttachmentConverterProps<TDrivers, TVariants>) {
		const { disk, options, config, entity, columnName, diskName } = props;
		this.disk = disk;
		this.modelOptions = options;
		this.config = config;
		this.entity = entity;
		this.columnName = columnName;
		this.diskName = diskName;

		if (att[ATTACHMENT_LOADED]) {
			throw new Error("Attachment already processed, please use the Attachment.fromFile method to create a new attachment");
		}
		this.file = this.att[ATTACHMENT_FILE]!;
	}

	done(data: AttachmentBase) {
		this.att[ATTACHMENT_FN_PROCESS](data);
	}

	generateKey(name: string, ...path: string[]) {
		let folder = this.modelOptions.folder ?? "";
		folder = folder.replace(/:([A-Za-z0-9_]+)/g, (full, key: string) => {
			let value = this.entity[key];

			if (value === undefined || value === null) {
				throw new Error(
					`Missing value for Attachment path "${key}" in entity ${this.entity.constructor.name}. Please ensure that the referenced property is computed before the attachment is processed. (Auto incrementing fields are not supported.)`
				);
			}

			return this.normalizeFileName(String(value));
		});

		return join(folder, name, ...path);
	}

	normalizeFileName(fileName: string) {
		return encodeURIComponent(fileName.replace(/[^a-zA-Z0-9.-]/g, "_")).toLowerCase();
	}

	async fileToBuffer() {
		if (this.buffer) {
			return this.buffer;
		}
		const arrayBuffer = await this.file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		this.buffer = buffer;
		return buffer;
	}

	getFileName() {
		if (!this.config.rename) {
			return this.normalizeFileName(this.file.name);
		}
		if (typeof this.config.rename === "function") {
			return this.normalizeFileName(this.config.rename(this.file, this.columnName, this.entity));
		}

		return this.normalizeFileName(v7());
	}

	async getFileType() {
		return fileTypeFromBuffer(await this.fileToBuffer());
	}

	async analyseFile() {
		const fileType = await this.getFileType();
		this.fileInfo = {
			extname: fileType?.ext ?? this.file.name.split(".").pop() ?? "",
			mimeType: fileType?.mime ?? this.file.type,
			size: this.file.size,
		};
	}

	async uploadFile(key: string, buffer: Buffer) {
		await this.disk.put(key, buffer);
	}

	async pickConverter(variantName: string, variant: VariantSpec) {
		if (!this.fileInfo) {
			throw new Error("Attachment Converter: File info not found");
		}
		for (const converter of this.config.converters ?? []) {
			if (
				await converter.supports(
					{
						size: this.fileInfo.size,
						mimeType: this.fileInfo.mimeType,
						variantName,
						variant,
						buffer: await this.fileToBuffer(),
						extname: this.fileInfo.extname,
					},
					this.modelOptions
				)
			) {
				return converter;
			}
		}
		return null;
	}

	async process() {
		await this.analyseFile();
		const buffer = await this.fileToBuffer();

		const name = this.getFileName();
		const extname = this.fileInfo?.extname ?? "";
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

		if (this.modelOptions.variants) {
			for (const [variantName, variant] of Object.entries(this.modelOptions.variants)) {
				const converter = await this.pickConverter(variantName, variant);
				if (converter) {
					const converterOutput = await converter.handle(
						{
							buffer,
							size: this.fileInfo?.size ?? 0,
							mimeType: this.fileInfo?.mimeType ?? "",
							extname: this.fileInfo?.extname ?? "",
							variantName,
							variant,
						},
						this.modelOptions.variants[variantName]
					);
					const variantKey = this.generateKey(originalKey.split("/").pop()!.split(".").shift()!, `${variantName}.${converterOutput.extname}`);
					await this.uploadFile(variantKey, converterOutput.buffer);
					data.variants.push({
						name: variantName,
						extname: converterOutput.extname,
						size: converterOutput.buffer.length,
						mimeType: converterOutput.mimeType,
						path: variantKey,
					});
				}
			}
		}

		if (this.fileInfo?.mimeType.startsWith("image/")) {
			const blurhashEnabled = typeof this.modelOptions.blurhash === "boolean" ? this.modelOptions.blurhash : this.modelOptions.blurhash?.enabled;

			if (blurhashEnabled) {
				(data as ImageAttachment).blurhash = await imageToBlurhash(
					buffer,
					typeof this.modelOptions.blurhash === "object" ? this.modelOptions.blurhash : undefined
				);
			}
		}

		this.done(data);
	}
}
