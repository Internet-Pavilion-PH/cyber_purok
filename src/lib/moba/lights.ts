import * as BABYLON from "@babylonjs/core";

export class ArenaLights {
  public hemiLight: BABYLON.HemisphericLight;
  public sunLight: BABYLON.DirectionalLight;
  public shadowGen: BABYLON.ShadowGenerator;
  public timeMinutes = 720;

  private ground: BABYLON.Mesh | null = null;

  constructor(private readonly scene: BABYLON.Scene) {
    this.hemiLight = this.createAmbientLighting();
    this.sunLight = this.createSunLighting();
    this.shadowGen = this.createShadowGenerator();
    this.updateSunFromTime();
  }

  public setGround(ground: BABYLON.Mesh) {
    this.ground = ground;
    this.ground.receiveShadows = true;
  }

  public addShadowCaster(mesh: BABYLON.AbstractMesh) {
    this.shadowGen.addShadowCaster(mesh, true);
  }

  public addShadowCasters(meshes: Iterable<BABYLON.AbstractMesh>) {
    for (const mesh of meshes) {
      this.addShadowCaster(mesh);
    }
  }

  public setTimeMinutes(minutes: number) {
    this.timeMinutes = ((minutes % 1440) + 1440) % 1440;
    this.updateSunFromTime();
  }

  public tickTime(deltaMs: number) {
    this.timeMinutes = (this.timeMinutes + deltaMs / 60000) % 1440;
    this.updateSunFromTime();
  }

  public updateSunFromTime() {
    const hours = this.timeMinutes / 60;
    const sunAngle = ((hours - 12) / 24) * Math.PI * 2;
    const cycle = Math.sin(sunAngle);
    const dayFactor = BABYLON.Scalar.Clamp((cycle + 1) / 2, 0, 1);

    const sunRadius = 300;
    const sunX = Math.cos(sunAngle) * sunRadius;
    const sunY = Math.max(25, cycle * 260 + 300);
    const sunZ = Math.sin(sunAngle * 0.9) * 200;

    this.sunLight.position = new BABYLON.Vector3(sunX, sunY, sunZ);
    this.sunLight.direction = BABYLON.Vector3.Zero().subtract(this.sunLight.position).normalize();
    this.sunLight.intensity = 0.18 + dayFactor * 0.9;

    this.hemiLight.intensity = 0.15 +dayFactor * 0.35;
    this.hemiLight.groundColor = new BABYLON.Color3(
      0.1 + dayFactor * 0.35,
      0.15 + dayFactor * 0.25,
      0.2 + dayFactor * 0.3,
    );
    this.hemiLight.diffuse = new BABYLON.Color3(
      0.25 + dayFactor * 0.45,
      0.3 + dayFactor * 0.3,
      0.25 + dayFactor * 0.2,
    );

    this.shadowGen.darkness = 0.3 + dayFactor * 0.35;

    if (this.timeMinutes === 720) {
      this.sunLight.position = new BABYLON.Vector3(0, 300, 0);
      this.sunLight.direction = new BABYLON.Vector3(0, -1, 0);
      this.sunLight.intensity = 0.9;
      this.hemiLight.intensity = 0.35;
      this.shadowGen.darkness = 0.35;
    }
  }

  private createAmbientLighting() {
    const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.3;
    return hemi;
  }

  private createSunLighting() {
    const sun = new BABYLON.DirectionalLight(
      "sun",
      new BABYLON.Vector3(-0.4, -1, -0.3),
      this.scene,
    );
    sun.position = new BABYLON.Vector3(0, 300, 0);
    sun.intensity = 0.5;
    return sun;
  }

  private createShadowGenerator() {
    const shadowGen = new BABYLON.ShadowGenerator(768, this.sunLight);
    shadowGen.useBlurExponentialShadowMap = false;
    shadowGen.blurKernel = 0;
    shadowGen.darkness = 0.5;
    return shadowGen;
  }
}
