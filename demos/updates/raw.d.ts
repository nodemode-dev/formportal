declare module "*?raw" {
  const text: string;
  export default text;
}

declare module "*.css";

interface ImportMeta {
  readonly env: { readonly DEV: boolean };
}
