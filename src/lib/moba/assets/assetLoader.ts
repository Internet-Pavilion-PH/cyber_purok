import * as BABYLON from "@babylonjs/core";
import worldAssetManifest from "./assetList.json";

const legacyAssetPathMap: Record<string, string> = {
  "Ate_Tanod.glb": "/creeps/",
  "JFK_2.glb": "/heroes/",
  "chef.glb": "/heroes/",
  "Kuya_Tanod.glb": "/creeps/",
  "Fountain.glb": "/world/",
  "Yellowbasketstore.glb": "/world/",
  "led.glb": "/world/",
  "Conch1.glb": "/world/",
  "gw.glb": "/world/",
  "roger.glb": "/world/",
  "cottage.glb": "/world/",
  "pcbhouse.glb": "/world/",
  "ffc1.glb": "/world/",
  "ffc2.glb": "/world/",
  "salawaki_isda-optimized.glb": "/world/",
  "salawaki.glb": "/world/",
  "WireStructures.glb": "/world/",
  "SolidStructure.glb": "/world/",
  "bukid.glb": "/world/",
  "JoelTower.glb": "/world/",
  "kolown-build.glb": "/world/",
  "crate.glb": "/world/",
  "standee.glb": "/world/",
  "aninipot-crate-glow.glb": "/world/",
  "guava.glb": "/world/",
};

export type AssetLoaderTask =
  | {
      kind: "mesh";
      name: string;
      rootUrl: string;
      fileName: string;
      extension?: string;
      onSuccess?: (task: BABYLON.MeshAssetTask) => void;
    }
  | {
      kind: "binary";
      name: string;
      url: string;
      onSuccess?: (task: BABYLON.BinaryFileAssetTask) => void;
    }
  | {
      kind: "texture";
      name: string;
      url: string;
      onSuccess?: (task: BABYLON.TextureAssetTask) => void;
    }
  | {
      kind: "cubeTexture";
      name: string;
      url: string;
      onSuccess?: (task: BABYLON.CubeTextureAssetTask) => void;
    };

export type AssetLoaderManifest = AssetLoaderTask[];

export class AssetLoader {
  private readonly scene: BABYLON.Scene;
  private readonly manager: BABYLON.AssetsManager;
  private readonly tasks: AssetLoaderTask[] = [];
  private readonly loadedAssets = new Map<string, unknown>();

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.manager = new BABYLON.AssetsManager(scene);
  }

  public addMeshTask(task: Omit<Extract<AssetLoaderTask, { kind: "mesh" }>, "kind">) {
    this.tasks.push({ kind: "mesh", ...task });
    return this;
  }

  public addBinaryTask(task: Omit<Extract<AssetLoaderTask, { kind: "binary" }>, "kind">) {
    this.tasks.push({ kind: "binary", ...task });
    return this;
  }

  public addTextureTask(task: Omit<Extract<AssetLoaderTask, { kind: "texture" }>, "kind">) {
    this.tasks.push({ kind: "texture", ...task });
    return this;
  }

  public addCubeTextureTask(task: Omit<Extract<AssetLoaderTask, { kind: "cubeTexture" }>, "kind">) {
    this.tasks.push({ kind: "cubeTexture", ...task });
    return this;
  }

  public addManifest(manifest: AssetLoaderManifest) {
    this.tasks.push(...manifest);
    return this;
  }

  public async load(): Promise<Map<string, unknown>> {
    if (!this.tasks.length) {
      return this.loadedAssets;
    }

    for (const task of this.tasks) {
      switch (task.kind) {
        case "mesh": {
          const assetTask = this.manager.addMeshTask(task.name, [], task.rootUrl, task.fileName, task.extension);
          assetTask.onSuccess = (completedTask) => {
            this.loadedAssets.set(task.name, completedTask.loadedMeshes);
            task.onSuccess?.(completedTask);
          };
          assetTask.onError = (taskError, message, exception) => {
            console.error(`AssetLoader failed for mesh task '${task.name}'`, { message, exception, taskError });
          };
          break;
        }
        case "binary": {
          const assetTask = this.manager.addBinaryFileTask(task.name, task.url);
          assetTask.onSuccess = (completedTask) => {
            this.loadedAssets.set(task.name, completedTask.data);
            task.onSuccess?.(completedTask);
          };
          assetTask.onError = (taskError, message, exception) => {
            console.error(`AssetLoader failed for binary task '${task.name}'`, { message, exception, taskError });
          };
          break;
        }
        case "texture": {
          const assetTask = this.manager.addTextureTask(task.name, task.url);
          assetTask.onSuccess = (completedTask) => {
            this.loadedAssets.set(task.name, completedTask.texture);
            task.onSuccess?.(completedTask);
          };
          assetTask.onError = (taskError, message, exception) => {
            console.error(`AssetLoader failed for texture task '${task.name}'`, { message, exception, taskError });
          };
          break;
        }
        case "cubeTexture": {
          const assetTask = this.manager.addCubeTextureTask(task.name, task.url);
          assetTask.onSuccess = (completedTask) => {
            this.loadedAssets.set(task.name, completedTask.texture);
            task.onSuccess?.(completedTask);
          };
          assetTask.onError = (taskError, message, exception) => {
            console.error(`AssetLoader failed for cube texture task '${task.name}'`, { message, exception, taskError });
          };
          break;
        }
      }
    }

    await new Promise<void>((resolve, reject) => {
      this.manager.onFinish = () => {
        resolve();
      };
      this.manager.onTaskError = (task) => {
        reject(new Error(`AssetLoader task failed: ${task.name}`));
      };

      this.manager.load();
    });

    return this.loadedAssets;
  }

  public getLoadedAsset<T>(name: string): T | undefined {
    return this.loadedAssets.get(name) as T | undefined;
  }

  public reset() {
    this.tasks.length = 0;
    this.loadedAssets.clear();
    this.manager.reset();
  }
}

export const createAssetLoader = (scene: BABYLON.Scene) => new AssetLoader(scene);
export const WORLD_MODEL_MANIFEST = worldAssetManifest as AssetLoaderManifest;

export function resolveAssetKey(assetName: string): AssetLoaderTask | undefined {
  const normalized = assetName.trim();
  if (!normalized) return undefined;

  const exactMatch = WORLD_MODEL_MANIFEST.find(
    (asset) => asset.name === normalized || (asset.kind === "mesh" && asset.fileName === normalized),
  );

  return exactMatch;
}

export function resolveAssetUrl(assetName: string): string | undefined {
  if (!assetName) return undefined;

  if (assetName.startsWith("http://") || assetName.startsWith("https://")) {
    return assetName;
  }

  const match = resolveAssetKey(assetName);
  if (!match) return undefined;

  if (match.kind === "binary" || match.kind === "texture" || match.kind === "cubeTexture") {
    return match.url;
  }

  return undefined;
}

export function resolveAssetPath(modelName: string): { rootUrl: string; fileName: string } {
  const normalized = modelName.replace(/^\/+/, "");

  if (modelName.startsWith("http://") || modelName.startsWith("https://")) {
    const lastSlash = modelName.lastIndexOf("/");
    return {
      rootUrl: modelName.substring(0, lastSlash + 1),
      fileName: modelName.substring(lastSlash + 1),
    };
  }

  const manifestMatch = WORLD_MODEL_MANIFEST.find(
    (asset) => asset.kind === "mesh" && (asset.name === normalized || asset.fileName === normalized),
  );
  if (manifestMatch && manifestMatch.kind === "mesh") {
    return {
      rootUrl: manifestMatch.rootUrl,
      fileName: manifestMatch.fileName,
    };
  }

  const fallbackRootUrl = legacyAssetPathMap[normalized] ?? "/";
  return {
    rootUrl: fallbackRootUrl,
    fileName: normalized,
  };
}
