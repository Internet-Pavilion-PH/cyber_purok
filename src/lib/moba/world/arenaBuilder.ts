import * as BABYLON from "@babylonjs/core";
// import { GrassProceduralTexture } from "@babylonjs/procedural-textures";
import { ArenaLights } from "./lights";
import { Stone } from "./stone";

export class ArenaBuilder {
  public ground: BABYLON.Mesh;
  public walls: BABYLON.Mesh[] = [];
  public gameGroundMaterial: BABYLON.StandardMaterial;
  public wallMaterial: BABYLON.StandardMaterial;
  public lights: ArenaLights;
  /** Resolves once the heightmap terrain heights are applied. */
  public groundReady!: Promise<void>;

  constructor(
    private readonly scene: BABYLON.Scene,
  ) {
    this.ground = this.createGround();
    const materials = this.createGroundMaterials();
    this.gameGroundMaterial = materials.gameGroundMaterial;
    this.wallMaterial = materials.wallMaterial;
    this.ground.material = this.gameGroundMaterial;
    this.ground.receiveShadows = true;

    this.lights = new ArenaLights(this.scene);
    this.lights.setGround(this.ground);

    this.walls = this.createWalls();
    this.walls.forEach((wall) => {
      wall.receiveShadows = true;
    });
  }

  public updateCameraMode() {
    this.ground.material = this.gameGroundMaterial;
    this.walls.forEach((wall) => {
      wall.material = this.wallMaterial;
    });
  }

  public setTimeMinutes(minutes: number) {
    this.lights.setTimeMinutes(minutes);
  }

  public tickTime(deltaMs: number) {
    this.lights.tickTime(deltaMs);
  }

  private createGround(): BABYLON.Mesh {
    const groundWidth = 1000;
    const groundHeight = 1000;

    let resolveReady!: () => void;
    this.groundReady = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    // Temporarily flatten the arena ground to remove the expensive heightmap
    // displacement work from the render cost profile.
    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      {
        width: groundWidth,
        height: groundHeight,
        subdivisions: 32,
      },
      this.scene,
    );

    resolveReady();
    ground.position.y = 0;
    return ground;
  }

  private createGroundMaterials() {
    const grassMat = new BABYLON.StandardMaterial("grassMat", this.scene);

    // The generative grass texture is left here for reference, but the arena is
    // intentionally using the authored paint_map.png instead of a generated base.
    // const grassTex = new GrassProceduralTexture("grassTex", 1024, this.scene);
    // grassTex.uScale = 6;
    // grassTex.vScale = 6;
    // grassTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    // grassTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    // grassTex.anisotropicFilteringLevel = 8;
    // grassMat.diffuseTexture = grassTex;

    grassMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    grassMat.ambientColor = new BABYLON.Color3(0.25, 0.25, 0.25);

    const mapTex = new BABYLON.Texture("/images/paint_map.png", this.scene);
    mapTex.uScale = 1;
    mapTex.vScale = 1;
    mapTex.hasAlpha = true;
    mapTex.getAlphaFromRGB = true;
    mapTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    mapTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    grassMat.ambientTexture = mapTex;

    const wallMat = new BABYLON.StandardMaterial("wallMat", this.scene);
    const wallTex = new BABYLON.Texture("/images/texture/rock.png", this.scene);
    wallTex.uScale = 1;
    wallTex.vScale = 1;
    wallTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    wallTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    wallMat.diffuseTexture = wallTex;
    wallMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    wallMat.ambientColor = new BABYLON.Color3(0.3, 0.3, 0.3);

    return {
      gameGroundMaterial: grassMat,
      wallMaterial: wallMat,
    };
  }

  private createWalls(): BABYLON.Mesh[] {
    const groundWidth = 1000;
    const groundHeight = 1000;
    const groundHalfWidth = groundWidth / 2;
    const groundHalfHeight = groundHeight / 2;

    const wallSegments: BABYLON.Mesh[] = [];

    const addStoneLine = (name: string, start: BABYLON.Vector3, end: BABYLON.Vector3, height: number, yOffset: number) => {
      const stoneFence = new Stone(this.scene, [start, end], height).createStone();
      stoneFence.name = name;
      stoneFence.position.y = yOffset;
      const children = stoneFence.getChildren();
      for (const child of children) {
        if (child instanceof BABYLON.Mesh) {
          child.material = this.wallMaterial;
          child.isPickable = false;
          child.position.y += yOffset;
          wallSegments.push(child);
        }
      }
    };

    const wallY = 45;
    const wallInset = 35;
    const wallYOffset = 4;
    addStoneLine(
      "wallNorth",
      new BABYLON.Vector3(-groundHalfWidth - wallInset, 0, -groundHalfHeight - wallInset),
      new BABYLON.Vector3(groundHalfWidth + wallInset, 0, -groundHalfHeight - wallInset),
      wallY,
      wallYOffset,
    );
    addStoneLine(
      "wallSouth",
      new BABYLON.Vector3(-groundHalfWidth - wallInset, 0, groundHalfHeight + wallInset),
      new BABYLON.Vector3(groundHalfWidth + wallInset, 0, groundHalfHeight + wallInset),
      wallY * 0.98,
      wallYOffset,
    );
    addStoneLine(
      "wallEast",
      new BABYLON.Vector3(groundHalfWidth + wallInset, 0, -groundHalfHeight - wallInset),
      new BABYLON.Vector3(groundHalfWidth + wallInset, 0, groundHalfHeight + wallInset),
      wallY,
      wallYOffset,
    );
    addStoneLine(
      "wallWest",
      new BABYLON.Vector3(-groundHalfWidth - wallInset, 0, -groundHalfHeight - wallInset),
      new BABYLON.Vector3(-groundHalfWidth - wallInset, 0, groundHalfHeight + wallInset),
      wallY,
      wallYOffset,
    );

    return wallSegments;
  }
}
