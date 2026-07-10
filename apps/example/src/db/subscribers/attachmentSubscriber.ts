import { AttachmentSubscriber } from "mikro-orm-attachments";
import { ImgkitConverter } from "mikro-orm-attachments/converters/ImgkitConverter";
import { FSDriver } from "flydrive/drivers/fs";

export const attachmentSubscriber = new AttachmentSubscriber({
	rename: true,
	drivers: {
		fs: new FSDriver({
			location: "./uploads",
			visibility: "public",
			urlBuilder: {
				async generateURL(key, filePath) {
					return `http://localhost:3000/uploads/${key}`;
				},
			},
		}),
		// s3_hetzner: new S3Driver({
		// 	bucket: "my-bucket",
		// 	accessKeyId: "my-access-key-id",
		// 	secretAccessKey: "my-secret-access-key",
		// 	region: "us-east-1",
		// }),
	},
	variants: {
		thumbnail: new ImgkitConverter({
			resize: {
				height: 100,
			},
			output: {
				format: "webp",
			},
		}),
	},
	defaultDriver: "fs",
});
export const AttachmentProperty = attachmentSubscriber.AttachmentDecorator;
