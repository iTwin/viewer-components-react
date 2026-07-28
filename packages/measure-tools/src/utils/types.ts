/** A utility type which makes all keys required, including nested keys.  */
export type RecursiveRequired<T> = { [K in keyof T]-?: RecursiveRequired<T[K]> };
