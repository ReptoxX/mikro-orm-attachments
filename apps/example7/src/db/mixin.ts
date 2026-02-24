export type Constructor<T = object> = abstract new (...args: any[]) => T;

export function mixin<TBase extends Constructor>(Base: TBase) {
	return Base;
}
