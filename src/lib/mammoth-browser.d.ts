declare module "mammoth/mammoth.browser.min.js" {
  const mammoth: {
    extractRawText: (opts: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  export default mammoth;
  export const extractRawText: (opts: {
    arrayBuffer: ArrayBuffer;
  }) => Promise<{ value: string }>;
}
