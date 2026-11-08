import * as BABYLON from "@babylonjs/core";
import type { Hero } from "../entities/hero";
import { PlaceModel } from "../world/placeModel";

export class GuavaHunt {
  private scene: BABYLON.Scene;
  private respawnDelayMs = 3500;
  private respawnTimer: ReturnType<typeof setTimeout> | null = null;
  public location: BABYLON.Vector3;
  public isPicked = false;
  public object: BABYLON.Mesh | BABYLON.TransformNode | null;
  private isServerAuthoritative = false;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.location = new BABYLON.Vector3(0, 5, 0);
    this.object = null;
  }

  public setServerMode(enabled: boolean): void {
    this.isServerAuthoritative = enabled;
  }

  public setLocalFallbackMode(): void {
    this.isServerAuthoritative = false;
    this.isPicked = true;
    if (this.object) {
      if (this.object instanceof BABYLON.Mesh) {
        this.object.dispose();
      } else {
        this.object.setEnabled(false);
      }
      this.object = null;
    }
    this.location = new BABYLON.Vector3(0, 5, 0);
  }

  public syncFromServer(message: { active?: boolean; x?: number; z?: number }): void {
    if (typeof message.x !== "number" || typeof message.z !== "number") return;

    this.isServerAuthoritative = true;
    this.location = new BABYLON.Vector3(message.x, 5, message.z);
    const active = message.active ?? true;
    this.isPicked = !active;

    if (!active) {
      if (this.object) {
        if (this.object instanceof BABYLON.Mesh) {
          this.object.dispose();
        } else {
          this.object.setEnabled(false);
        }
      }
      this.object = null;
      return;
    }

    if (!this.object) {
      void this.load();
      return;
    }

    this.object.position.set(this.location.x, this.location.y, this.location.z);
    this.object.setEnabled(true);
  }

  private applyGoldMaterial(target: BABYLON.AbstractMesh | BABYLON.TransformNode): void {
    const goldMaterial = new BABYLON.PBRMaterial("guavaGoldMaterial", this.scene);
    goldMaterial.albedoColor = new BABYLON.Color3(1, 0.8, 0.2);
    goldMaterial.emissiveColor = new BABYLON.Color3(0.8, 0.48, 0.05);
    goldMaterial.metallic = 1;
    goldMaterial.roughness = 0.15;

    const meshes = target instanceof BABYLON.Mesh ? [target] : target.getChildMeshes();
    meshes.forEach((mesh) => {
      if (mesh instanceof BABYLON.Mesh) {
        mesh.material = goldMaterial;
      }
    });
  }

  private addHoverAnimation(): void {
    if (!this.object) return;

    const baseY = this.location.y + 1.2;
    const observer = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.object || this.isPicked) {
        this.scene.onBeforeRenderObservable.remove(observer);
        return;
      }

      const time = performance.now() * 0.001;
      this.object.position.y = baseY + Math.sin(time * 3.5) * 0.35;
      this.object.rotation.y += this.scene.getEngine().getDeltaTime() * 0.0015;
    });
  }

  private triggerRespawn(): void {
    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer);
      this.respawnTimer = null;
    }

    this.isPicked = false;
    this.location = new BABYLON.Vector3(0, 5, 0);
  }

  private triggerPickupEffect(): void {
    if (!this.object || this.isPicked) return;

    this.isPicked = true;

    if (this.object instanceof BABYLON.Mesh) {
      this.object.dispose();
    } else {
      this.object.setEnabled(false);
    }

    this.object = null;

    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer);
    }
    this.respawnTimer = setTimeout(() => {
      this.respawnTimer = null;
      this.triggerRespawn();
    }, this.respawnDelayMs);
  }

  public update(hero: Hero): void {
    if (this.isServerAuthoritative || this.isPicked || !hero.mesh || !this.object) return;

    const dx = hero.mesh.position.x - this.location.x;
    const dz = hero.mesh.position.z - this.location.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 6) {
      this.triggerPickupEffect();
    }
  }

  public async load(): Promise<void> {
    try {
      const model = new PlaceModel(this.scene, "guava.glb", this.location, {
        onGround: true,
        scaleFactor: 2,
        collidable: false,
      });

      await model.load();

      if (model.modelRoot) {
        this.object = model.modelRoot;
        this.object.position = this.location.clone();
        this.applyGoldMaterial(this.object);
        this.addHoverAnimation();
      }
    } catch (error) {
      console.warn("Guava hunt model failed to load; skipping guava object.", error);
      this.object = null;
    }
  }
}