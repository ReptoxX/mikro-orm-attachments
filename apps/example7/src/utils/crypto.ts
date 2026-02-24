import { env } from "../config/env";
import crypto from "crypto";

export function encrypt(value: string) {
	const ENC_KEY = Buffer.from(env.ENCRYPTION_KEY, "hex");
	const IV = Buffer.from(env.ENCRYPTION_IV, "hex"); //
	const cipher = crypto.createCipheriv("aes-256-cbc", ENC_KEY, IV);
	let encrypted = cipher.update(value, "utf8", "base64");
	encrypted += cipher.final("base64");
	return encrypted;
}

export function decrypt(value: string) {
	const ENC_KEY = Buffer.from(env.ENCRYPTION_KEY, "hex");
	const IV = Buffer.from(env.ENCRYPTION_IV, "hex");

	const decipher = crypto.createDecipheriv("aes-256-cbc", ENC_KEY, IV);
	const decrypted = decipher.update(value, "base64", "utf8");
	return decrypted + decipher.final("utf8");
}
