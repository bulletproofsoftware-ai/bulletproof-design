declare module '@babel/standalone' {
  export function transform(code: string, options?: any): { code: string };
  export const availablePlugins: Record<string, unknown>;
  export const availablePresets: Record<string, unknown>;
}
