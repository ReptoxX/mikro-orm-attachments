export interface AttachmentPropertyOptions {
	folder?: string;
	blurhash?: boolean;
}

export const DEFAULT_ATTACHMENT_PROPERTY_OPTIONS: AttachmentPropertyOptions = {
	folder: "attachments",
	blurhash: true,
};

export interface AttachmentOptions {}

export interface AttachmentData {
	filename: string;
	folder: string;
	blurhash?: string;
}
