/** Geometry and UV are separate: cover crops; contain never distorts. Focus uses image coordinates (top-left origin). */
export function pictureFit(
  aspect: number,
  width: number,
  height: number,
  fit: "contain" | "cover",
  focus: [number, number] = [0.5, 0.5],
) {
  const target = width / height;
  if (fit === "contain")
    return {
      width: aspect > target ? width : height * aspect,
      height: aspect > target ? width / aspect : height,
      uv: [0, 0, 1, 1] as const,
    };
  const spanX = aspect > target ? target / aspect : 1,
    spanY = aspect > target ? 1 : aspect / target;
  const x = Math.max(0, Math.min(1 - spanX, focus[0] - spanX / 2));
  const y = Math.max(0, Math.min(1 - spanY, 1 - focus[1] - spanY / 2));
  return { width, height, uv: [x, y, x + spanX, y + spanY] as const };
}
