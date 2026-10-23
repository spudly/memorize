/**
 * Asset modules the app imports directly. Metro resolves these at
 * bundle time; the imported value is the bundled asset (a font
 * source for expo-font registrations).
 */
declare module "*.ttf" {
  const asset: number;
  export default asset;
}
