// Bundled font files load through Metro as registered asset ids.
declare module "*.ttf" {
  const asset: number;
  export default asset;
}
