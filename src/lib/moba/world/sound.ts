import * as BABYLON from "@babylonjs/core";

export class AmbientSound {
  private readonly sound: BABYLON.Sound;
  private started = false;

  constructor(
    private readonly scene: BABYLON.Scene,
    url: string,
    options: Partial<BABYLON.ISoundOptions> = {},
  ) {
    this.sound = new BABYLON.Sound(
      "ambient",
      url,
      this.scene,
      undefined,
      {
        loop: true,
        autoplay: false,
        volume: 0.15,
        ...options,
      },
    );
  }

  public bindToFirstInteraction(target: Window | HTMLElement = window) {
    if (this.started) return;

    const handler = () => {
      this.start();
      target.removeEventListener("pointerdown", handler, true);
      target.removeEventListener("keydown", handler, true);
    };

    target.addEventListener("pointerdown", handler, true);
    target.addEventListener("keydown", handler, true);
  }

  public start() {
    if (this.started) return;

    this.started = true;
    BABYLON.Engine.audioEngine?.unlock();
    this.sound.play();
  }

  public stop() {
    this.sound.stop();
    this.started = false;
  }

  public setVolume(volume: number) {
    this.sound.setVolume(volume);
  }

  public dispose() {
    this.sound.dispose();
  }
}
