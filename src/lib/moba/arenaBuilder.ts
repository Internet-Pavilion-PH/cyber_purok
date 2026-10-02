import * as BABYLON from "@babylonjs/core";
import { GridMaterial } from "@babylonjs/materials";
import { GrassProceduralTexture } from "@babylonjs/procedural-textures";
import { ArenaLights } from "./lights";

export class ArenaBuilder {
  public ground: BABYLON.Mesh;
  public walls: BABYLON.Mesh[] = [];
  public gameGroundMaterial: BABYLON.StandardMaterial;
  public debugGroundMaterial: BABYLON.Material;
  public debugMapOverlay: BABYLON.Mesh;
  public lights: ArenaLights;

  constructor(
    private readonly scene: BABYLON.Scene,
    private cameraMode: "debug" | "game" = "game",
  ) {
    this.ground = this.createGround();
    const materials = this.createGroundMaterials();
    this.gameGroundMaterial = materials.gameGroundMaterial;
    this.debugGroundMaterial = materials.debugGroundMaterial;
    this.ground.material = this.cameraMode === "debug" ? this.debugGroundMaterial : this.gameGroundMaterial;
    this.ground.receiveShadows = true;

    this.lights = new ArenaLights(this.scene);
    this.lights.setGround(this.ground);

    this.debugMapOverlay = this.createDebugMapOverlay();
    this.updateCameraMode(this.cameraMode);

    this.walls = this.createWalls();
    this.lights.addShadowCasters(this.walls);
    this.walls.forEach((wall) => {
      wall.receiveShadows = true;
    });
  }

  public updateCameraMode(mode: "debug" | "game") {
    this.cameraMode = mode;
    this.ground.material = mode === "debug" ? this.debugGroundMaterial : this.gameGroundMaterial;
    this.walls.forEach((wall) => {
      wall.material = mode === "debug" ? this.debugGroundMaterial : this.gameGroundMaterial;
    });

    this.debugMapOverlay.setEnabled(mode === "debug");
    this.debugMapOverlay.material!.alpha = mode === "debug" ? 0.45 : 0;
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
    const grassTex = new GrassProceduralTexture("grassTex", 1024, this.scene);
    grassTex.uScale = 6;
    grassTex.vScale = 6;
    grassTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    grassTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    grassTex.anisotropicFilteringLevel = 8;
    grassMat.diffuseTexture = grassTex;
    grassMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    grassMat.ambientColor = new BABYLON.Color3(0.25, 0.25, 0.25);

    const mapTex = new BABYLON.Texture("/map.png", this.scene);
    mapTex.uScale = 1;
    mapTex.vScale = 1;
    mapTex.hasAlpha = true;
mapTex.getAlphaFromRGB = true;
    mapTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    mapTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    grassMat.ambientTexture = mapTex;

    const debugGrid = new GridMaterial("debugGrid", this.scene);
    debugGrid.mainColor = new BABYLON.Color3(0.7, 0.7, 0.75);
    debugGrid.lineColor = new BABYLON.Color3(0.3, 0.35, 0.45);
    debugGrid.gridRatio = 1;
    debugGrid.majorUnitFrequency = 10;
    debugGrid.minorUnitVisibility = 0.6;
    debugGrid.opacity = 1;

    const debugMapMaterial = new BABYLON.StandardMaterial("debugMapMaterial", this.scene);
    debugMapMaterial.diffuseTexture = mapTex;
    debugMapMaterial.diffuseTexture.hasAlpha = false;
    debugMapMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    debugMapMaterial.alpha = 0.45;
    debugMapMaterial.backFaceCulling = false;

    return {
      gameGroundMaterial: grassMat,
      debugGroundMaterial: debugGrid,
      debugMapMaterial,
    };
  }

  private createDebugMapOverlay() {
    const groundWidth = 1000;
    const groundHeight = 1000;

    const overlay = BABYLON.MeshBuilder.CreateGround(
      "debugMapOverlay",
      { width: groundWidth, height: groundHeight, subdivisions: 1 },
      this.scene,
    );
    overlay.position.y = 0.03;
    overlay.isPickable = false;
    overlay.setEnabled(false);

    const debugMapMaterial = new BABYLON.StandardMaterial("debugMapMaterial", this.scene);
    const mapTex = new BABYLON.Texture("/map.png", this.scene);
    mapTex.uScale = 1;
    mapTex.vScale = 1;
    mapTex.hasAlpha = true;
    mapTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    mapTex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    debugMapMaterial.diffuseTexture = mapTex;
    debugMapMaterial.diffuseTexture.hasAlpha = false;
    debugMapMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    debugMapMaterial.alpha = 0;
    debugMapMaterial.backFaceCulling = false;
    overlay.material = debugMapMaterial;

    return overlay;
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
      wall.material = this.cameraMode === "debug" ? this.debugGroundMaterial : this.gameGroundMaterial;
      wall.isPickable = false;
      return wall;
    });
  }
}
