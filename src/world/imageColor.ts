import { Color, type Texture } from "three";
export function sampledColor(texture: Texture | null, fallback = "#849aa7") {
  const color = new Color(fallback);
  if (!texture?.image) return color;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 8;
    const context = canvas.getContext("2d")!;
    context.drawImage(texture.image, 0, 0, 8, 8);
    const pixels = context.getImageData(0, 0, 8, 8).data;
    const rgb = [0, 0, 0];
    for (let i = 0; i < pixels.length; i += 4) {
      rgb[0] += pixels[i];
      rgb[1] += pixels[i + 1];
      rgb[2] += pixels[i + 2];
    }
    color
      .setRGB(rgb[0] / 16320, rgb[1] / 16320, rgb[2] / 16320)
      .convertSRGBToLinear();
    color.lerp(new Color("#b2d5e6"), 0.65);
  } catch {
    /* Remote works keep neutral reflected light. */
  }
  return color;
}
