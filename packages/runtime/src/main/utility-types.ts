export type Many<T> = Array<T> | T;

export type Maybe<T> = T | null | undefined;

export type ReadonlyMany<T> = ReadonlyArray<Readonly<T>> | Readonly<T>;

export type Awaitable<T> = Promise<T> | T;
