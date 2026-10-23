// Metro serves bundled font files as numeric asset ids; expo-font
// accepts those ids as font sources. TypeScript has no built-in
// module shape for them, so declare it here.
declare module "*.ttf" {
  const assetId: number;
  export default assetId;
}
