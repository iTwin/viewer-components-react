/** A utility type which makes all keys required, including nested keys.  */
export type RecursiveRequire<T> = { [K in keyof T]-?: RecursiveRequire<T[K]> };
