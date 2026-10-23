// Bundled font assets are Metro asset module ids at runtime; TS has
// no built-in module type for them.
declare module "*.ttf" {
  const assetId: number;
  export default assetId;
}
