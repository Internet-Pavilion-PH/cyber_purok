import * as BABYLON from "@babylonjs/core";
// import { GrassProceduralTexture } from "@babylonjs/procedural-textures";
import { ArenaLights } from "./lights";

export class ArenaBuilder {
  public ground: BABYLON.Mesh;
  public walls: BABYLON.Mesh[] = [];
  public gameGroundMaterial: BABYLON.StandardMaterial;
  public lights: ArenaLights;

  constructor(
    private readonly scene: BABYLON.Scene,
  ) {
    this.ground = this.createGround();
    const materials = this.createGroundMaterials();
    this.gameGroundMaterial = materials.gameGroundMaterial;
    this.ground.material = this.gameGroundMaterial;
    this.ground.receiveShadows = true;

    this.lights = new ArenaLights(this.scene);
    this.lights.setGround(this.ground);

    this.walls = this.createWalls();
    this.lights.addShadowCasters(this.walls);
    this.walls.forEach((wall) => {
      wall.receiveShadows = true;
    });
  }

  public updateCameraMode() {
    this.ground.material = this.gameGroundMaterial;
    this.walls.forEach((wall) => {
      wall.material = this.gameGroundMaterial;
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

    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      { height: groundHeight, width: groundWidth, subdivisions: 4 },
      this.scene,
    );
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

    return {
      gameGroundMaterial: grassMat,
    };
  }

  private createWalls(): BABYLON.Mesh[] {
    const groundWidth = 1000;
    const groundHeight = 1000;
    const groundHalfWidth = groundWidth / 2;
    const groundHalfHeight = groundHeight / 2;
    const wallHeight = 50;
    const wallThickness = 20;

    const wallPositions = [
      {
        name: "wallNorth",
        width: groundWidth,
        depth: wallThickness,
        x: 0,
        z: -(groundHalfHeight + wallThickness / 2),
        y: wallHeight / 2,
      },
      {
        name: "wallSouth",
        width: groundWidth,
        depth: wallThickness,
        x: 0,
        z: groundHalfHeight + wallThickness / 2,
        y: wallHeight / 2,
      },
      {
        name: "wallEast",
        width: wallThickness,
        depth: groundHeight,
        x: groundHalfWidth + wallThickness / 2,
        z: 0,
        y: wallHeight / 2,
      },
      {
        name: "wallWest",
        width: wallThickness,
        depth: groundHeight,
        x: -(groundHalfWidth + wallThickness / 2),
        z: 0,
        y: wallHeight / 2,
      },
    ];

    return wallPositions.map(({ name, width, depth, x, z, y }) => {
      const wall = BABYLON.MeshBuilder.CreateBox(
        name,
        { width, height: wallHeight, depth },
        this.scene,
      );
      wall.position = new BABYLON.Vector3(x, y, z);
      wall.material = this.gameGroundMaterial;
      wall.isPickable = false;
      return wall;
    });
  }
}
