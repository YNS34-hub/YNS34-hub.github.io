/** Original files stay intact; only bounded preview textures enter the world. */
export async function imagePreview(
  blob: Blob,
  maxDimension = 1280,
): Promise<{
  preview?: Blob;
  color?: string;
  width?: number;
  height?: number;
}> {
  if (
    typeof createImageBitmap === "undefined" ||
    typeof document === "undefined"
  )
    return {};
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(blob);
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const drawing = canvas.getContext("2d");
    if (!drawing) return {};
    drawing.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const preview = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.86),
    );
    const palette = document.createElement("canvas");
    palette.width = 24;
    palette.height = 24;
    const sample = palette.getContext("2d", { willReadFrequently: true });
    let color: string | undefined;
    if (sample) {
      sample.drawImage(canvas, 0, 0, 24, 24);
      const pixels = sample.getImageData(0, 0, 24, 24).data;
      let red = 0;
      let green = 0;
      let blue = 0;
      let weight = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
        const opacity = pixels[index + 3] / 255;
        const influence = opacity * (0.2 + saturation);
        red += r * influence;
        green += g * influence;
        blue += b * influence;
        weight += influence;
      }
      if (weight > 0) {
        // Desaturate the sampled palette so imported art cannot overwhelm the architecture.
        const values = [red / weight, green / weight, blue / weight];
        const gray = values.reduce((sum, value) => sum + value, 0) / 3;
        color = `#${values
          .map((value) =>
            Math.round(value * 0.35 + gray * 0.65)
              .toString(16)
              .padStart(2, "0"),
          )
          .join("")}`;
      }
    }
    canvas.width = 1;
    canvas.height = 1;
    return {
      preview: preview || undefined,
      color,
      width: bitmap.width,
      height: bitmap.height,
    };
  } catch {
    return {};
  } finally {
    bitmap?.close();
  }
}
