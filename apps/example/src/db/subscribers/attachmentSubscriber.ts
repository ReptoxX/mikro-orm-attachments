import { AttachmentSubscriber } from "@monorepo/mikro-orm-attachments";
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
		thumbnail: {
			resize: {
				height: 100,
			},
			format: {
				format: "webp",
				options: {
					quality: 80,
				},
			},
		},
		"2x": {
			resize: {
				height: 200,
			},
			format: {
				format: "webp",
				options: {
					quality: 80,
				},
			},
		},
	},
	defaultDriver: "fs",
});
export const AttachmentProperty = attachmentSubscriber.AttachmentDecorator;
