import * as BABYLON from "@babylonjs/core";

export type InfoTextOptions = {
  width?: number;
  height?: number;
  offsetY?: number;
  title?: string;
  description?: string;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  maxDistance?: number;
  /** Position distance is measured from; defaults to the active camera. */
  getViewerPosition?: () => BABYLON.Vector3 | null;
};

export type ManualInfoTextSpec = {
  id?: string;
  position: BABYLON.Vector3 | { x: number; y: number; z: number };
  title: string;
  description?: string;
  width?: number;
  height?: number;
  offsetY?: number;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  maxDistance?: number;
};

export class InfoText {
  public readonly plane: BABYLON.Mesh;
  private readonly material: BABYLON.StandardMaterial;
  private readonly texture: BABYLON.DynamicTexture;
  private readonly anchor: BABYLON.AbstractMesh | BABYLON.TransformNode;
  private readonly maxDistance: number;
  private readonly getViewerPosition: (() => BABYLON.Vector3 | null) | null;

  static createAtPosition(
    scene: BABYLON.Scene,
    position: BABYLON.Vector3 | { x: number; y: number; z: number },
    options: InfoTextOptions = {},
    name = "manualInfoText",
  ) {
    const anchor = new BABYLON.TransformNode(name, scene);
    anchor.position = position instanceof BABYLON.Vector3 ? position.clone() : new BABYLON.Vector3(position.x, position.y, position.z);
    return new InfoText(scene, anchor, options);
  }

  static createMany(
    scene: BABYLON.Scene,
    specs: ManualInfoTextSpec[],
    getViewerPosition?: () => BABYLON.Vector3 | null,
  ) {
    return specs.map((spec) => {
      const { id = `${spec.title}-info`, position, title, description, width, height, offsetY, textColor, backgroundColor, borderColor, maxDistance } = spec;
      return InfoText.createAtPosition(
        scene,
        position,
        {
          title,
          description,
          width,
          height,
          offsetY,
          textColor,
          backgroundColor,
          borderColor,
          maxDistance,
          getViewerPosition,
        },
        id,
      );
    });
  }

  constructor(
    scene: BABYLON.Scene,
    anchor: BABYLON.AbstractMesh | BABYLON.TransformNode,
    options: InfoTextOptions = {},
  ) {
    const {
      width = 7,
      height = 3.2,
      offsetY = 6,
      title = "Artwork",
      description = "",
      textColor = "#EAFEF5",
      backgroundColor = "rgba(8, 18, 22, 0.25)",
      borderColor = "#77EFC3",
      maxDistance = 35,
      getViewerPosition,
    } = options;

    this.getViewerPosition = getViewerPosition ?? null;
    this.anchor = anchor;
    this.maxDistance = maxDistance;

    this.plane = BABYLON.MeshBuilder.CreatePlane("infoTextPlane", { width, height }, scene);
    this.plane.parent = this.anchor;
    this.plane.position = new BABYLON.Vector3(0, offsetY, 0);
    this.plane.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
    this.plane.isPickable = false;

    this.material = new BABYLON.StandardMaterial("infoTextMaterial", scene);
    this.material.backFaceCulling = false;
    this.material.sideOrientation = BABYLON.Mesh.DOUBLESIDE;
    this.material.emissiveColor = new BABYLON.Color3(1, 1, 1);
    this.material.alpha = 1;
    this.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
    this.material.useAlphaFromDiffuseTexture = true;

    this.texture = new BABYLON.DynamicTexture(
      "infoTextTexture",
      { width: 1024, height: 512 },
      scene,
      false,
    );
    this.texture.hasAlpha = true;

    this.material.diffuseTexture = this.texture;
    this.plane.material = this.material;

    this.setText(title, description, { textColor, backgroundColor, borderColor });
    this.updateVisibility(scene.activeCamera);

    scene.registerBeforeRender(() => {
      this.updateVisibility(scene.activeCamera);
    });
  }

  setText(
    title: string,
    description?: string,
    colors?: {
      textColor?: string;
      backgroundColor?: string;
      borderColor?: string;
    },
  ) {
    const textColor = colors?.textColor ?? "#EAFEF5";
    const backgroundColor = colors?.backgroundColor ?? "rgba(8, 18, 22, 0.88)";
    const borderColor = colors?.borderColor ?? "#77EFC3";

    const ctx = this.texture.getContext();
    const { width, height } = this.texture.getSize();

    const canvasCtx = ctx as CanvasRenderingContext2D;

    canvasCtx.clearRect(0, 0, width, height);
    canvasCtx.fillStyle = backgroundColor;
    canvasCtx.fillRect(10, 10, width - 20, height - 20);

    canvasCtx.fillStyle = textColor;
    canvasCtx.font = "700 86px sans-serif";
    canvasCtx.textBaseline = "middle";
    canvasCtx.textAlign = "left";
    canvasCtx.fillText(title, 60, 170);

    if (description) {
      const lines = this.wrapText(canvasCtx, description, 860);
      canvasCtx.font = "400 38px sans-serif";
      canvasCtx.fillStyle = "#D7FCEB";

      lines.forEach((line, index) => {
        canvasCtx.fillText(line, 60, 250 + index * 44);
      });
    }

    this.texture.update();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }

    if (current) lines.push(current);
    return lines;
  }

  private updateVisibility(camera: BABYLON.Camera | null) {
    const viewer = this.getViewerPosition?.() ?? camera?.globalPosition ?? null;
    if (!viewer) {
      this.plane.setEnabled(false);
      return;
    }

    const distance = BABYLON.Vector3.Distance(this.anchor.absolutePosition, viewer);
    this.plane.setEnabled(distance <= this.maxDistance);
  }

  dispose() {
    this.plane.dispose();
    this.texture.dispose();
    this.material.dispose();
  }
}