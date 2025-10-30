import * as BABYLON from '@babylonjs/core';

export default class ModelPlacer {
	url: string;
	worldPosition?: BABYLON.Vector3;

	constructor(url: string, worldPosition?: BABYLON.Vector3) {
		this.url = url;
		this.worldPosition = worldPosition;
	}

	/**
	 * Append the GLB to the scene and place it according to worldPosition.
	 * If worldPosition.y is a number, it's treated as the desired base Y (lowest point).
	 * If worldPosition.y is undefined, worldPosition is used as the desired center.
	 */
	async appendTo(
		scene: BABYLON.Scene,
		camera?: BABYLON.ArcRotateCamera,
		options?: { targetSize?: number; focusCamera?: boolean; scaleFactor?: number; alwaysScale?: boolean }
	) {
		const targetSize = options?.targetSize ?? 2;
		const focusCamera = options?.focusCamera ?? false;
		const scaleFactor = options?.scaleFactor;
		const alwaysScale = options?.alwaysScale ?? false;
		const beforeCount = scene.meshes.length;
		const beforeCams = scene.cameras.length;
		const beforeLights = scene.lights.length;

		// Append the scene (prefer helper if available)
		if ((BABYLON as any).AppendSceneAsync) {
			await (BABYLON as any).AppendSceneAsync(this.url, scene);
		} else {
			const idx = this.url.lastIndexOf('/');
			const root = this.url.slice(0, idx + 1);
			const file = this.url.slice(idx + 1);
			await BABYLON.SceneLoader.AppendAsync(root, file, scene);
		}

		// newly added meshes
		const added = scene.meshes.slice(beforeCount).filter((m) => m instanceof BABYLON.Mesh) as BABYLON.Mesh[];

		// remove any appended cameras/lights that might interfere
		scene.cameras.slice(beforeCams).forEach((c) => { try { c.dispose(); } catch (e) {} });
		scene.lights.slice(beforeLights).forEach((l) => { if (l.name === 'dir') return; try { l.dispose(); } catch (e) {} });

		if (!added.length) return { added: 0 };

		const modelRoot = new BABYLON.TransformNode('modelRoot', scene);
		added.forEach((m) => m.setParent(modelRoot));

		// compute combined world bbox
		const min = new BABYLON.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
		const max = new BABYLON.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
		added.forEach((m) => {
			if (!m.getBoundingInfo) return;
			const bi = m.getBoundingInfo();
			min.copyFrom(BABYLON.Vector3.Minimize(min, bi.boundingBox.minimumWorld));
			max.copyFrom(BABYLON.Vector3.Maximize(max, bi.boundingBox.maximumWorld));
		});

		const center = min.add(max).scale(0.5);
		const size = max.subtract(min);
		const maxDim = Math.max(size.x, size.y, size.z) || 1;

		// Scaling behavior:
		// - if scaleFactor is provided, apply it (uniform scale)
		// - else compute autoScale = targetSize / maxDim and apply when `alwaysScale` is true
		//   or when model is very small (maxDim < 0.5) to keep previous behavior
		if (typeof scaleFactor === 'number') {
			modelRoot.scaling = new BABYLON.Vector3(scaleFactor, scaleFactor, scaleFactor);
		} else {
			const autoScale = targetSize / maxDim;
			if (alwaysScale || maxDim < 0.5) {
				modelRoot.scaling = new BABYLON.Vector3(autoScale, autoScale, autoScale);
			}
		}

		// placement
		if (this.worldPosition) {
			const wp = this.worldPosition;
			if (typeof wp.y === 'number' && !isNaN(wp.y)) {
				// place so lowest point sits at wp.y
				const lowestY = min.y;
				const raise = wp.y - lowestY;
				modelRoot.position = new BABYLON.Vector3(wp.x - center.x, raise, wp.z - center.z);
			} else {
				// center at provided position (uses wp.y if present)
				modelRoot.position = new BABYLON.Vector3(wp.x - center.x, (wp.y ?? -center.y), wp.z - center.z);
			}
		} else {
			// default: place base on ground y=0
			const raise = -min.y;
			modelRoot.position = new BABYLON.Vector3(-center.x, raise, -center.z);
		}

		// optional: focus camera (only if explicitly requested)
		if (camera && focusCamera) {
			try {
				camera.target = center;
				const boundingRadius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
				camera.radius = Math.max(5, boundingRadius * 6);
			} catch (e) {}
		}

		return { added: added.length, min, max, center, modelRoot };
	}
}
