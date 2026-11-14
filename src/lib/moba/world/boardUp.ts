import * as BABYLON from "@babylonjs/core";

export type BoardUpLocation = BABYLON.Vector3 | { x: number; y: number; z: number };

export type BoardUpOptions = {
  texture: string | BABYLON.Texture;
  start?: BoardUpLocation;
  end?: BoardUpLocation;
  height?: number;
  thickness?: number;
  name?: string;
  parent?: BABYLON.Node | null;
  alpha?: number;
  emissiveColor?: BABYLON.Color3 | string;
};

export class BoardUp {
  public readonly scene: BABYLON.Scene;
  public readonly rootNode: BABYLON.TransformNode;
  public readonly mesh: BABYLON.Mesh;
  public readonly material: BABYLON.StandardMaterial;
  public readonly texture: BABYLON.Texture;

  static create(scene: BABYLON.Scene, options: BoardUpOptions): BoardUp {
    return new BoardUp(scene, options);
  }

  constructor(scene: BABYLON.Scene, options: BoardUpOptions) {
    const {
      texture,
      start,
      end,
      height = 2,
      thickness = 0.2,
      name = "boardUp",
      parent = null,
      alpha = 1,
      emissiveColor,
    } = options;

    const startVec = start !== undefined ? BoardUp.toVector3(start) : new BABYLON.Vector3(0, 0, 0);
    const endVec = end !== undefined ? BoardUp.toVector3(end) : startVec.clone();

    const boxWidth = BABYLON.Vector3.Distance(startVec, endVec) || 1;
    const mid = startVec.add(endVec).scale(0.5);

    this.scene = scene;
    this.rootNode = new BABYLON.TransformNode(`${name}_root`, scene);
    this.rootNode.position = mid.clone();
    if (parent) {
      this.rootNode.parent = parent;
    }

    this.texture = typeof texture === "string"
      ? new BABYLON.Texture(texture, scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE)
      : texture;
    this.texture.hasAlpha = true;

    this.material = new BABYLON.StandardMaterial(`${name}_material`, scene);
    this.material.diffuseTexture = this.texture;
    this.material.alpha = alpha;
    this.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
    this.material.useAlphaFromDiffuseTexture = true;
    this.material.emissiveColor = typeof emissiveColor === "string"
      ? BABYLON.Color3.FromHexString(emissiveColor)
      : (emissiveColor ?? new BABYLON.Color3(1, 1, 1));

    this.mesh = BABYLON.MeshBuilder.CreateBox(
      `${name}_board`,
      { width: boxWidth, height, depth: thickness },
      scene,
    );

    this.mesh.parent = this.rootNode;
    this.mesh.isPickable = false;
    this.mesh.billboardMode = 0;
    this.mesh.material = this.material;

    const dx = endVec.x - startVec.x;
    const dz = endVec.z - startVec.z;
    const angle = Math.atan2(dz, dx);
    this.rootNode.rotation.y = -angle;

    this.applyFaceUVs();
  }

  private static toVector3(location: BoardUpLocation): BABYLON.Vector3 {
    if (location instanceof BABYLON.Vector3) {
      return location.clone();
    }

    return new BABYLON.Vector3(location.x, location.y, location.z);
  }

  private applyFaceUVs(): void {
    const uvs = new Float32Array(24 * 2);

    for (let face = 0; face < 6; face++) {
      const faceOffset = face * 4;
      const uvOffset = face * 8;

      const quad = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];

      for (let i = 0; i < 4; i++) {
        const index = faceOffset + i;
        const sourceIndex = uvOffset + i * 2;
        uvs[sourceIndex] = quad[i][0];
        uvs[sourceIndex + 1] = quad[i][1];
        const vertexIndex = index * 2;
        uvs[vertexIndex] = uvs[sourceIndex];
        uvs[vertexIndex + 1] = uvs[sourceIndex + 1];
      }
    }

    this.mesh.setVerticesData(BABYLON.VertexBuffer.UVKind, uvs, false, 2);
  }

  public attachTo(parent: BABYLON.Node): void {
    this.rootNode.parent = parent;
  }

  public dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
