import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial } from "three";
import { isVisibleMesh } from "../src/interaction/occlusion";

describe("actual gaze occlusion", () => {
  it("includes instanced architecture and excludes every hidden ancestor", () => {
    const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
    const root = new Group(), inner = new Group();
    const blocker = new InstancedMesh(geometry, material, 1), work = new Mesh(geometry, material);
    root.add(inner); inner.add(blocker, work);
    expect(isVisibleMesh(blocker)).toBe(true);
    expect(isVisibleMesh(work)).toBe(true);
    expect(isVisibleMesh(inner)).toBe(false);
    root.visible = false;
    expect(isVisibleMesh(blocker)).toBe(false);
    expect(isVisibleMesh(work)).toBe(false);
    root.visible = true; work.visible = false;
    expect(isVisibleMesh(work)).toBe(false);
    geometry.dispose(); material.dispose(); blocker.dispose();
  });
});
