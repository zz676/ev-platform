export function createCanvas(width: number, height: number): any;
export class Image {
  src: any;
  width: number;
  height: number;
}
export function registerFont(
  path: string,
  options: { family: string; weight?: string; style?: string }
): void;
export function loadImage(src: string | Buffer | ArrayBuffer): Promise<any>;
export const GlobalFonts: {
  registerFromPath: (path: string, family?: string) => boolean;
};
