import { Type } from "@mikro-orm/core";
import { decrypt, encrypt } from "../../utils/crypto";

export class EncryptedStringType extends Type<string, string> {
	convertToDatabaseValue(value: string): string {
		return encrypt(value);
	}

	convertToJSValue(value: string): string {
		return decrypt(value);
	}

	getColumnType(): string {
		return "text";
	}
}
