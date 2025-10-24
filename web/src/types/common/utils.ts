// Utility type functions

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

export type PickRequired<T, K extends keyof T> = Pick<T, RequiredKeys<Pick<T, K>>>;

export type PickOptional<T, K extends keyof T> = Pick<T, OptionalKeys<Pick<T, K>>>;

export type OmitByType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

export type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

// Component prop utilities
export type ComponentProps<T extends React.ComponentType<any>> = 
  T extends React.ComponentType<infer P> ? P : never;

export type ComponentRef<T extends React.ComponentType<any>> = 
  T extends React.ForwardRefExoticComponent<infer P> 
    ? P extends { ref?: infer R } 
      ? R 
      : never
    : never;

