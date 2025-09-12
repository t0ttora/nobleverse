declare module 'dom-to-image-more' {
  export function toPng(
    node: Node,
    options?: Record<string, any>
  ): Promise<string>;
  export function toJpeg(
    node: Node,
    options?: Record<string, any>
  ): Promise<string>;
  export function toSvg(
    node: Node,
    options?: Record<string, any>
  ): Promise<string>;
  const defaultExport: {
    toPng: typeof toPng;
    toJpeg: typeof toJpeg;
    toSvg: typeof toSvg;
  };
  export default defaultExport;
}
