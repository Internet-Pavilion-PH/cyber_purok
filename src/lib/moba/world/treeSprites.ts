import * as BABYLON from "@babylonjs/core";

export class TreeSprites {
  public readonly manager: BABYLON.SpriteManager;
  public readonly sprites: BABYLON.Sprite[] = [];

  constructor(
    scene: BABYLON.Scene,
    textureUrl: string = "/images/texture/artwork_tree.png",
    capacity: number = 500,
    cellSize: { width: number; height: number } = { width: 512, height: 512 },
  ) {
    this.manager = new BABYLON.SpriteManager(
      "treeSpritesManager",
      textureUrl,
      capacity,
      cellSize,
      scene,
    );
  }

  public addTree(position: BABYLON.Vector3, size: number = 1): BABYLON.Sprite {
    const sprite = new BABYLON.Sprite("treeSprite", this.manager);
    const aspectRatio = 875 / 1069;
    sprite.width = size * aspectRatio;
    sprite.height = size;
    sprite.position = position.clone();
    sprite.position.y += size * 0.5;
    this.sprites.push(sprite);
    return sprite;
  }
}
