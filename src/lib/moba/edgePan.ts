import * as BABYLON from "@babylonjs/core";

interface EdgePanOptions {
  scene: BABYLON.Scene;
  camera: BABYLON.ArcRotateCamera;
  canvas: HTMLCanvasElement;
  /** Max distance from the origin the camera target may reach. */
  clampExtent: number;
  panSpeed?: number;
  edgeMargin?: number;
}

/** RTS-style camera panning when the pointer touches the screen edges (desktop only). */
export const attachEdgePan = ({
  scene,
  camera,
  canvas,
  clampExtent,
  panSpeed = 50,
  edgeMargin = 80,
}: EdgePanOptions) => {
  // Returns -1..0..1 depending on how deep the pointer is inside the edge margin.
  const edgeAxis = (pos: number, size: number) => {
    if (pos < edgeMargin) return -((edgeMargin - pos) / edgeMargin);
    if (pos > size - edgeMargin) return (pos - (size - edgeMargin)) / edgeMargin;
    return 0;
  };

  scene.onBeforeRenderObservable.add(() => {
    const panX = edgeAxis(scene.pointerX, canvas.width);
    const panY = edgeAxis(scene.pointerY, canvas.height);
    if (panX === 0 && panY === 0) return;

    const dt = scene.getEngine().getDeltaTime() / 1000;
    const cosA = Math.cos(camera.alpha);
    const sinA = Math.sin(camera.alpha);
    const forwardX = -cosA;
    const forwardZ = -sinA;
    const rightX = -sinA;
    const rightZ = cosA;

    const moveX = (rightX * panX - forwardX * panY) * panSpeed * dt;
    const moveZ = (rightZ * panX - forwardZ * panY) * panSpeed * dt;

    camera.target.x = BABYLON.Scalar.Clamp(camera.target.x + moveX, -clampExtent, clampExtent);
    camera.target.z = BABYLON.Scalar.Clamp(camera.target.z + moveZ, -clampExtent, clampExtent);
  });
};
