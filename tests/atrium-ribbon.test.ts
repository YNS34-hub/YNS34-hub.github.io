import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { createMemoryRibbon } from "../src/rooms/atrium/ribbonGeometry";

describe("memory glass ribbon", () => {
  it("keeps the original core and circulation footprints clear", () => {
    const geometry = createMemoryRibbon(), position = geometry.getAttribute("position");
    const point = new Vector3();
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i);
      expect(point.length()).toBeGreaterThan(2.7);
      expect(point.length()).toBeLessThan(3.4);
      expect(point.y + 3.7).toBeGreaterThan(.316);
    }
    geometry.dispose();
  });

  it("forms a closed, finite dielectric volume with valid normals", () => {
    const geometry = createMemoryRibbon(), index = geometry.getIndex()!;
    const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
    const edges = new Map<string, number>(), a = new Vector3(), b = new Vector3(), c = new Vector3();
    for (let i = 0; i < index.count; i += 3) {
      const vertices = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      a.fromBufferAttribute(position, vertices[0]);
      b.fromBufferAttribute(position, vertices[1]);
      c.fromBufferAttribute(position, vertices[2]);
      expect(b.sub(a).cross(c.sub(a)).lengthSq()).toBeGreaterThan(1e-12);
      for (let edge = 0; edge < 3; edge++) {
        const first = vertices[edge], second = vertices[(edge + 1) % 3];
        const key = `${Math.min(first, second)}:${Math.max(first, second)}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    expect([...edges.values()].every(count => count === 2)).toBe(true);
    for (let i = 0; i < normal.count; i++) {
      const length = a.fromBufferAttribute(normal, i).length();
      expect(Number.isFinite(length)).toBe(true);
      expect(length).toBeCloseTo(1, 5);
    }
    geometry.dispose();
  });
});
