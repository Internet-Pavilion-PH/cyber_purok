import * as BABYLON from "@babylonjs/core";

export interface PlaceModelOptions {
  scaleFactor?: number;
  targetSize?: number;
  onGround?: boolean;
  mergeMeshes?: boolean;
  fadeIn?: boolean;
  rotation?: BABYLON.Vector3 | number[];
}

export class PlaceModel {
  public scene: BABYLON.Scene;
  public modelName: string;
  public position: BABYLON.Vector3;
  public rotation: BABYLON.Vector3;
  public options: Required<Pick<PlaceModelOptions, "scaleFactor" | "targetSize" | "onGround" | "mergeMeshes" | "fadeIn" | "rotation">>;

  public modelRoot: BABYLON.TransformNode | null = null;
  public addedMeshes: BABYLON.Mesh[] = [];

  constructor(
    scene: BABYLON.Scene,
    modelName: string,
    position: BABYLON.Vector3 | number[],
    options: PlaceModelOptions = {},
  ) {
    this.scene = scene;
    this.modelName = modelName;
    this.position = this.normalizePosition(position);
    this.rotation = this.normalizeRotation(options.rotation ?? [0, 0, 0]);
    this.options = {
      scaleFactor: options.scaleFactor ?? 0.3,
      targetSize: options.targetSize ?? 2,
      onGround: options.onGround ?? true,
      mergeMeshes: options.mergeMeshes ?? false,
      fadeIn: options.fadeIn ?? false,
      rotation: this.rotation,
    };
  }

  private normalizePosition(position: BABYLON.Vector3 | number[]): BABYLON.Vector3 {
    if (position instanceof BABYLON.Vector3) {
      return position.clone();
    }

    const x = position[0] ?? 0;
    const y = position[1] ?? 0;
    const z = position[2] ?? 0;
    return new BABYLON.Vector3(x, y, z);
  }

  private normalizeRotation(rotation: BABYLON.Vector3 | number[]): BABYLON.Vector3 {
    if (rotation instanceof BABYLON.Vector3) {
      return rotation.clone();
    }

    const x = rotation[0] ?? 0;
    const y = rotation[1] ?? 0;
    const z = rotation[2] ?? 0;
    return new BABYLON.Vector3(x, y, z);
  }

  private resolveAssetPath(modelName: string): { rootUrl: string; fileName: string } {
    if (modelName.startsWith("http://") || modelName.startsWith("https://")) {
      const lastSlash = modelName.lastIndexOf("/");
      return {
        rootUrl: modelName.substring(0, lastSlash + 1),
        fileName: modelName.substring(lastSlash + 1),
      };
    }

    return {
      rootUrl: "/",
      fileName: modelName.replace(/^\/+/, ""),
    };
  }

  public async load() {
    const { rootUrl, fileName } = this.resolveAssetPath(this.modelName);
    const worldPos = this.position.clone();

    if (this.options.onGround) {
      const ray = new BABYLON.Ray(
        new BABYLON.Vector3(worldPos.x, 100, worldPos.z),
        new BABYLON.Vector3(0, -1, 0),
        200,
      );
      const hit = this.scene.pickWithRay(ray, (mesh) => mesh.name === "ground");
      if (hit?.hit && hit.pickedPoint) {
        worldPos.y = hit.pickedPoint.y;
      } else {
        worldPos.y = 0;
      }
    }

    try {
      const beforeCount = this.scene.meshes.length;
      const beforeCams = this.scene.cameras.length;
      const beforeLights = this.scene.lights.length;

      const result = await BABYLON.SceneLoader.ImportMeshAsync("", rootUrl, fileName, this.scene);

      const addedMeshes = result.meshes.filter(
        (mesh) => mesh instanceof BABYLON.Mesh,
      ) as BABYLON.Mesh[];

      this.scene.cameras.slice(beforeCams).forEach((camera) => {
        try {
          camera.dispose();
        } catch {
          // ignore camera cleanup issues
        }
      });

      this.scene.lights.slice(beforeLights).forEach((light) => {
        if (light.name !== "dir") {
          try {
            light.dispose();
          } catch {
            // ignore light cleanup issues
          }
        }
      });

      if (!addedMeshes.length) {
        console.warn(`No meshes loaded from '${this.modelName}'`);
        return { added: 0 };
      }

      this.addedMeshes = addedMeshes;

      addedMeshes.forEach((mesh) => {
        mesh.receiveShadows = false;
        mesh.checkCollisions = true;
      });

      this.modelRoot = new BABYLON.TransformNode(`${this.modelName}_root`, this.scene);

      const glbRoot = result.transformNodes.find(
        (node) => (node.name === "__root__" || node.name === fileName.replace(/\.glb$/i, "")) && !node.parent,
      );

      if (glbRoot) {
        glbRoot.setParent(this.modelRoot);
      } else {
        const topLevelMeshes = addedMeshes.filter((mesh) => !mesh.parent);
        topLevelMeshes.forEach((mesh) => mesh.setParent(this.modelRoot));
      }

      const min = new BABYLON.Vector3(
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
      );
      const max = new BABYLON.Vector3(
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
      );

      addedMeshes.forEach((mesh) => {
        if (!mesh.getBoundingInfo) return;
        const bounds = mesh.getBoundingInfo();
        min.copyFrom(BABYLON.Vector3.Minimize(min, bounds.boundingBox.minimumWorld));
        max.copyFrom(BABYLON.Vector3.Maximize(max, bounds.boundingBox.maximumWorld));
      });

      const center = min.add(max).scale(0.5);
      const size = max.subtract(min);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;

      let targetScaling = new BABYLON.Vector3(1, 1, 1);
      if (this.options.scaleFactor) {
        targetScaling = new BABYLON.Vector3(
          this.options.scaleFactor,
          this.options.scaleFactor,
          this.options.scaleFactor,
        );
        this.modelRoot.scaling = this.options.fadeIn ? BABYLON.Vector3.Zero() : targetScaling;
      } else {
        const autoScale = this.options.targetSize / maxDim;
        targetScaling = new BABYLON.Vector3(autoScale, autoScale, autoScale);
        this.modelRoot.scaling = this.options.fadeIn ? BABYLON.Vector3.Zero() : targetScaling;
      }

      const lowestY = min.y;
      const raise = worldPos.y - lowestY;
      this.modelRoot.position = new BABYLON.Vector3(worldPos.x - center.x, raise, worldPos.z - center.z);
      this.modelRoot.rotation = this.rotation.clone();

      if (this.options.fadeIn) {
        const fadeDuration = 600;
        let elapsed = 0;
        const observer = this.scene.onBeforeRenderObservable.add(() => {
          elapsed += this.scene.getEngine().getDeltaTime();
          const progress = Math.min(elapsed / fadeDuration, 1);
          this.modelRoot!.scaling = BABYLON.Vector3.Lerp(BABYLON.Vector3.Zero(), targetScaling, progress);
          if (progress >= 1) {
            this.scene.onBeforeRenderObservable.remove(observer);
          }
        });
      }

      console.log(`✓ Model '${this.modelName}' placed at`, worldPos);
      return { added: addedMeshes.length, min, max, center, modelRoot: this.modelRoot };
    } catch (error) {
      console.error(`✗ Failed to place model '${this.modelName}'`, error);
      throw error;
    }
  }
}
