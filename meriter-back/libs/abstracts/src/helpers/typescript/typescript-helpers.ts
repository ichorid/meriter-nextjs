export type Typify<T> = { [K in keyof T]: T[K] };
