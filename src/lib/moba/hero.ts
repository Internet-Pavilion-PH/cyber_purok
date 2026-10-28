import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { get } from "svelte/store";
import {
  heroState,
  maxHp,
  maxMana,
  hpRegen,
  manaRegen,
} from "$lib/moba/heroStore";

export const ARENA_BOUNDS = 470;

export type HeroAnimationState = "Idle" | "Walking" | "Attack" | "Q" | "W" | "E" | "R";

export interface HeroSkillAnimations {
  q?: string;
  w?: string;
  e?: string;
  r?: string;
}

export interface HeroConfig {
  id: string;
  name: string;
  moveSpeed: number;
  rotationSpeed: number;
  spawnPosition: BABYLON.Vector3;
  modelScale?: number;
  modelUrl?: string;
  fileName?: string;
  forwardOffset?: number;
  idleAnimationName?: string;
  walkAnimationName?: string;
  attackAnimationName?: string;
  skillAnimations?: HeroSkillAnimations;
}

export class Hero {
  public mesh: BABYLON.AbstractMesh | null = null;
  public config: HeroConfig;
  public currentTarget: BABYLON.Vector3 | null = null;

  // Internal Dependencies & State
  private scene: BABYLON.Scene;
  private moveDirection = BABYLON.Vector3.Zero();
  private animGroups = new Map<string, BABYLON.AnimationGroup>();
  private resolvedAnimations = new Map<HeroAnimationState, BABYLON.AnimationGroup | null>();
  private animationNames: Record<HeroAnimationState, string>;
  private headAnchor: BABYLON.TransformNode | null = null;
  
  private isMoving = false;
  private isAttacking = false;

  // Scene & GUI Resources for Cleanup
  private uiTexture: GUI.AdvancedDynamicTexture | null = null;
  private nameLabel: GUI.TextBlock | null = null;
  private healthBarFill: GUI.Rectangle | null = null;
  private manaBarFill: GUI.Rectangle | null = null;
  private heroLight: BABYLON.PointLight | null = null;
  private heroShadowGen: BABYLON.ShadowGenerator | null = null;

  constructor(scene: BABYLON.Scene, config: HeroConfig) {
    this.scene = scene;
    this.config = config;

    this.animationNames = {
      Idle: config.idleAnimationName ?? "Idle",
      Walking: config.walkAnimationName ?? "Walking",
      Attack: config.attackAnimationName ?? "Attack",
      Q: config.skillAnimations?.q ?? "Q",
      W: config.skillAnimations?.w ?? "W",
      E: config.skillAnimations?.e ?? "E",
      R: config.skillAnimations?.r ?? "R",
    };
  }

  /**
   * Helper getter to always return current 2D world position.
   */
  public get position(): { x: number; z: number } {
    if (!this.mesh) return { x: this.config.spawnPosition.x, z: this.config.spawnPosition.z };
    return { x: this.mesh.position.x, z: this.mesh.position.z };
  }

  /**
   * Loads mesh assets, binds components, and initializes state.
   */
  public async load(shadowGen?: BABYLON.ShadowGenerator): Promise<void> {
    const url = this.config.modelUrl ?? "https://assets.babylonjs.com/meshes/";
    const file = this.config.fileName ?? "HVGirl.glb";

    const result = await BABYLON.SceneLoader.ImportMeshAsync("", url, file, this.scene);
    if (!result.meshes[0]) throw new Error(`Hero model failed to load from ${url}${file}`);

    this.mesh = result.meshes[0];

    this.configureMesh(this.mesh);
    this.cacheAnimations(result.animationGroups);
    this.setupShadows(this.mesh, shadowGen);
    this.attachOverheadBars(this.mesh);

    this.playAnimation("Idle");
    this.resetStats();
  }

  // --- PUBLIC API METHODS ---

  public setTarget(destination: BABYLON.Vector3 | null) {
    this.currentTarget = destination ? destination.clone() : null;
  }

  public updateDisplayName(name: string) {
    const nextName = (name || "Hero").trim().slice(0, 12) || "Hero";
    this.config.name = nextName;
    if (this.nameLabel) this.nameLabel.text = nextName;
  }

  public setMoveDirection(direction: BABYLON.Vector3 | null) {
    if (!direction || direction.lengthSquared() < 0.0001) {
      this.moveDirection = BABYLON.Vector3.Zero();
      return;
    }

    this.moveDirection = direction.clone();
  }

  public moveTo(destination: BABYLON.Vector3) {
    this.currentTarget = destination.clone();
  }

  public playAnimation(state: HeroAnimationState) {
    const group = this.resolvedAnimations.get(state);
    if (!group) return;

    this.animGroups.forEach((anim) => anim.stop());
    group.start(true, 1.0, group.from, group.to, false);
  }

  public attack() {
    this.isAttacking = true;
    this.playAnimation("Attack");
  }

  public stopAttack() {
    this.isAttacking = false;
    this.playAnimation(this.isMoving ? "Walking" : "Idle");
  }

  public castQ() { this.playAnimation("Q"); }
  public castW() { this.playAnimation("W"); }
  public castE() { this.playAnimation("E"); }
  public castR() { this.playAnimation("R"); }

  public update(dt: number) {
    if (!this.mesh) return;

    this.updateMovement();
    this.updateRegeneration(dt);
    this.updateUI();
  }

  public takeDamage(amount: number) {
    heroState.update((s) => ({
      ...s,
      currentHp: Math.max(0, s.currentHp - amount),
    }));
  }

  public consumeMana(amount: number): boolean {
    const state = get(heroState);
    if (state.currentMana < amount) return false;

    heroState.update((s) => ({
      ...s,
      currentMana: s.currentMana - amount,
    }));
    return true;
  }

  /**
   * Cleanly disposes all Babylon resources attached to this hero.
   */
  public dispose() {
    this.uiTexture?.dispose();
    this.heroLight?.dispose();
    this.heroShadowGen?.dispose();
    this.animGroups.forEach((group) => group.dispose());
    this.mesh?.dispose();
  }

  // --- PRIVATE SETUP & HELPERS ---

  private configureMesh(mesh: BABYLON.AbstractMesh) {
    const scale = this.config.modelScale ?? 5;
    mesh.scaling.scaleInPlace(scale);
    mesh.position.copyFrom(this.config.spawnPosition);
    mesh.rotationQuaternion = null; // Unlocks standard Euler rotation
    mesh.ellipsoid = new BABYLON.Vector3(2, 3, 2);
    mesh.ellipsoidOffset = new BABYLON.Vector3(0, 3, 0);

  // Create an anchor node positioned at head height in 3D space
  this.headAnchor = new BABYLON.TransformNode("headAnchor", this.scene);
  this.headAnchor.parent = mesh;
  
  // Adjust Y value based on the unscaled height of your mesh
  this.headAnchor.position = new BABYLON.Vector3(0, 4.5, 0);

  }

  private cacheAnimations(groups: BABYLON.AnimationGroup[]) {
    groups.forEach((group) => this.animGroups.set(group.name, group));

    // Pre-resolve and cache state mappings
    (Object.keys(this.animationNames) as HeroAnimationState[]).forEach((state) => {
      const targetName = this.animationNames[state];
      const match = this.findAnimation(targetName);
      this.resolvedAnimations.set(state, match);
    });
  }

  private findAnimation(animationName: string): BABYLON.AnimationGroup | null {
    if (this.animGroups.has(animationName)) {
      return this.animGroups.get(animationName)!;
    }

    const lowerTarget = animationName.toLowerCase();
    for (const [key, group] of this.animGroups) {
      if (key.toLowerCase().includes(lowerTarget)) return group;
    }
    return null;
  }

  private setupShadows(mesh: BABYLON.AbstractMesh, globalShadowGen?: BABYLON.ShadowGenerator) {
    const heroMeshes = [mesh, ...mesh.getChildMeshes()];
    heroMeshes.forEach((m) => (m.receiveShadows = true));

    if (globalShadowGen) {
      heroMeshes.forEach((m) => globalShadowGen.addShadowCaster(m, true));
    }

    // Local overhead PointLight for local hero shadows
    // Temporarily disabled while tuning the arena light cycle.
    // const desiredLightHeight = 28;
    // const heroScaleY = mesh.scaling.y || 1;
    //
    // this.heroLight = new BABYLON.PointLight(
    //   "heroLight",
    //   new BABYLON.Vector3(0, desiredLightHeight / heroScaleY, 0),
    //   this.scene
    // );
    // this.heroLight.parent = mesh;
    // this.heroLight.intensity = 1.0;
    // this.heroLight.range = 80;
    // this.heroLight.diffuse = new BABYLON.Color3(0.9, 0.95, 1.0);
    // this.heroLight.specular = new BABYLON.Color3(0, 0, 0);
    //
    // this.heroShadowGen = new BABYLON.ShadowGenerator(1024, this.heroLight);
    // heroMeshes.forEach((m) => this.heroShadowGen!.addShadowCaster(m, true));
    // this.heroShadowGen.useBlurExponentialShadowMap = true;
    // this.heroShadowGen.blurKernel = 8;
    // this.heroShadowGen.darkness = 0.5;

    this.heroLight = null;
    this.heroShadowGen = null;
  }

  private attachOverheadBars(mesh: BABYLON.AbstractMesh) {
    this.uiTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("HeroUI", true, this.scene);

    const stack = new GUI.StackPanel("overheadStack");
    stack.width = "120px";
    stack.height = "42px";
    stack.isVertical = true;

    this.nameLabel = new GUI.TextBlock("heroName");
    this.nameLabel.text = this.config.name;
    this.nameLabel.color = "#eaf6ff";
    this.nameLabel.fontSize = 14;
    this.nameLabel.fontFamily = "Segoe UI, sans-serif";
    this.nameLabel.fontStyle = "bold";
    this.nameLabel.resizeToFit = true;
    this.nameLabel.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.nameLabel.paddingBottom = "4px";
    this.nameLabel.shadowColor = "#000000";
    this.nameLabel.shadowBlur = 8;

    // HP Bar
    const hpBg = new GUI.Rectangle("hpBg");
    hpBg.width = "100%";
    hpBg.height = "8px";
    hpBg.background = "#1a1a1a";
    hpBg.thickness = 0;
    hpBg.cornerRadius = 2;

    this.healthBarFill = new GUI.Rectangle("hpFill");
    this.healthBarFill.width = "100%";
    this.healthBarFill.height = "100%";
    this.healthBarFill.background = "#2ecc71";
    this.healthBarFill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    hpBg.addControl(this.healthBarFill);

    // Mana Bar
    const manaBg = new GUI.Rectangle("manaBg");
    manaBg.width = "100%";
    manaBg.height = "5px";
    manaBg.background = "#1a1a1a";
    manaBg.thickness = 0;
    manaBg.cornerRadius = 2;

    this.manaBarFill = new GUI.Rectangle("manaFill");
    this.manaBarFill.width = "100%";
    this.manaBarFill.height = "100%";
    this.manaBarFill.background = "#3498db";
    this.manaBarFill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    manaBg.addControl(this.manaBarFill);

    stack.addControl(this.nameLabel);
    stack.addControl(hpBg);
    stack.addControl(manaBg);

    this.uiTexture.addControl(stack);
    stack.linkWithMesh(mesh);
    stack.linkOffsetY = -150;

  if (this.headAnchor) {
    stack.linkWithMesh(this.headAnchor);
    stack.linkOffsetY = 0; // No hardcoded pixel offset needed!
  }


  }

  // --- PRIVATE FRAME UPDATE LOOPS ---

  /** Moves the hero, sliding along any mesh with `checkCollisions` instead of passing through it. */
  private stepWithCollisions(delta: BABYLON.Vector3) {
    if (!this.mesh) return;
    const y = this.mesh.position.y;
    this.mesh.moveWithCollisions(delta);
    this.mesh.position.y = y;
  }

  private updateMovement() {
    if (!this.mesh) return;

    const keyDirection = this.moveDirection.clone();
    keyDirection.y = 0;
    if (keyDirection.length() > 0.0001) {
      this.walkToward(keyDirection.normalize());
      return;
    }

    if (!this.currentTarget) {
      this.setMoving(false);
      return;
    }

    const toTarget = this.currentTarget.subtract(this.mesh.position);
    toTarget.y = 0;

    if (toTarget.length() > 0.5) {
      this.walkToward(toTarget.normalize());
    } else {
      this.currentTarget = null;
      this.setMoving(false);
    }
  }

  /** Turns toward a unit direction, takes one collision-aware step, and keeps the hero in the arena. */
  private walkToward(direction: BABYLON.Vector3) {
    if (!this.mesh) return;

    const forwardOffset = this.config.forwardOffset ?? Math.PI;
    const wantedYaw = Math.atan2(direction.x, direction.z) + forwardOffset;
    this.mesh.rotation.y = BABYLON.Scalar.LerpAngle(
      this.mesh.rotation.y,
      wantedYaw,
      this.config.rotationSpeed,
    );

    this.stepWithCollisions(direction.scale(this.config.moveSpeed));
    this.mesh.position.x = BABYLON.Scalar.Clamp(this.mesh.position.x, -ARENA_BOUNDS, ARENA_BOUNDS);
    this.mesh.position.z = BABYLON.Scalar.Clamp(this.mesh.position.z, -ARENA_BOUNDS, ARENA_BOUNDS);

    this.setMoving(true);
  }

  /** Switches between the Walking and Idle animations only when the state changes. */
  private setMoving(moving: boolean) {
    if (this.isMoving === moving) return;
    this.isMoving = moving;
    this.playAnimation(moving ? "Walking" : "Idle");
  }

  private updateRegeneration(dt: number) {
    const curMaxHp = get(maxHp);
    const curMaxMana = get(maxMana);
    const curHpRegen = get(hpRegen);
    const curManaRegen = get(manaRegen);

    heroState.update((s) => ({
      ...s,
      currentHp: Math.min(curMaxHp, s.currentHp + curHpRegen * dt),
      currentMana: Math.min(curMaxMana, s.currentMana + curManaRegen * dt),
    }));
  }

  private updateUI() {
    const state = get(heroState);
    const curMaxHp = get(maxHp);
    const curMaxMana = get(maxMana);

    if (this.healthBarFill && curMaxHp > 0) {
      const hpPct = Math.max(0, Math.min(100, (state.currentHp / curMaxHp) * 100));
      this.healthBarFill.width = `${hpPct}%`;
    }

    if (this.manaBarFill && curMaxMana > 0) {
      const manaPct = Math.max(0, Math.min(100, (state.currentMana / curMaxMana) * 100));
      this.manaBarFill.width = `${manaPct}%`;
    }
  }

  private resetStats() {
    heroState.update((s) => ({
      ...s,
      currentHp: get(maxHp),
      currentMana: get(maxMana),
    }));
  }
}