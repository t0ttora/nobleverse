declare module 'html-to-docx' {
  const exportFn: (
    html: string,
    a?: any,
    opts?: any
  ) => Promise<Blob | Buffer | ArrayBuffer | Uint8Array>;
  export default exportFn;
}
