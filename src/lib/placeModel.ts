import * as BABYLON from '@babylonjs/core';

/**
 * Simple API to place a GLB model in the scene
 * @param scene - Babylon scene
 * @param modelName - filename in /static (e.g., 'gw.glb')
 * @param position - world position Vector3 or [x, y, z] array
 * @param options - optional scale, focus camera, etc.
 */
export async function placeModel(
	scene: BABYLON.Scene,
	modelName: string,
	position: BABYLON.Vector3 | number[],
	options?: {
		scaleFactor?: number;
		focusCamera?: boolean;
		targetSize?: number;
		onGround?: boolean; // raycast down to place on terrain
		mergeMeshes?: boolean;
	}
) {
	const opts = {
		scaleFactor: 0.3,
		focusCamera: false,
		targetSize: 2,
		onGround: false,
		mergeMeshes: false,
		...options
	};

	// convert array to Vector3 if needed
	let worldPos: BABYLON.Vector3;
	if (position instanceof BABYLON.Vector3) {
		worldPos = position.clone();
	} else {
		const x = position[0] ?? 0;
		const y = position[1] ?? 0;
		const z = position[2] ?? 0;
		worldPos = new BABYLON.Vector3(x, y, z);
	}

	// if onGround, raycast down to find terrain height
	if (opts.onGround) {
		const ray = new BABYLON.Ray(
			new BABYLON.Vector3(worldPos.x, 100, worldPos.z),
			new BABYLON.Vector3(0, -1, 0),
			200
		);
		const hit = scene.pickWithRay(ray, (mesh) => mesh.name === 'ground');
		if (hit?.hit && hit.pickedPoint) {
			worldPos.y = hit.pickedPoint.y;
		} else {
			worldPos.y = 0;
		}
	}

	// Handle both local files and full URLs
	let rootUrl = '';
	let fileName = modelName;
	
	if (modelName.startsWith('http://') || modelName.startsWith('https://')) {
		// Full URL: split into root and filename
		const lastSlash = modelName.lastIndexOf('/');
		rootUrl = modelName.substring(0, lastSlash + 1);
		fileName = modelName.substring(lastSlash + 1);
	} else {
		// Local file: use /static directory
		rootUrl = '/';
		fileName = modelName;
	}
	
	try {
		const beforeCount = scene.meshes.length;
		const beforeCams = scene.cameras.length;
		const beforeLights = scene.lights.length;

		// Load the GLB
		await BABYLON.SceneLoader.AppendAsync(rootUrl, fileName, scene);

		// Get all nodes added by the import (meshes, transform nodes, skeletons)
		const addedNodes = scene.transformNodes.slice(beforeCount > scene.transformNodes.length ? 0 : beforeCount);
		const addedMeshes = scene.meshes.slice(beforeCount).filter((m) => m instanceof BABYLON.Mesh) as BABYLON.Mesh[];

		// Remove any appended cameras/lights
		scene.cameras.slice(beforeCams).forEach((c) => { try { c.dispose(); } catch (e) {} });
		scene.lights.slice(beforeLights).forEach((l) => { if (l.name !== 'dir') try { l.dispose(); } catch (e) {} });

		if (!addedMeshes.length) {
			console.warn(`No meshes loaded from '${modelName}'`);
			return { added: 0 };
		}

		const shadowGen = (scene.metadata as any)?.shadowGen as BABYLON.ShadowGenerator | undefined;
		if (shadowGen) {
			addedMeshes.forEach((mesh) => {
				mesh.receiveShadows = true;
				shadowGen.addShadowCaster(mesh, true);
			});
		}

		// Create root transform node
		const modelRoot = new BABYLON.TransformNode(`${modelName}_root`, scene);

		// Find the GLB-imported root node (__root__ TransformNode) — parent only it,
		// so we don't break the animated glTF hierarchy.
		const glbRoot = scene.transformNodes.find(
			(n) => (n.name === '__root__' || n.name === fileName.replace('.glb', '')) && !n.parent
		);
		if (glbRoot) {
			glbRoot.setParent(modelRoot);
		} else {
			// Fallback: find top-level meshes (no parent) and parent them
			const topLevelMeshes = addedMeshes.filter((m) => !m.parent);
			topLevelMeshes.forEach((m) => m.setParent(modelRoot));
		}

		// Compute bounding box
		const min = new BABYLON.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
		const max = new BABYLON.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
		addedMeshes.forEach((m) => {
			if (!m.getBoundingInfo) return;
			const bi = m.getBoundingInfo();
			min.copyFrom(BABYLON.Vector3.Minimize(min, bi.boundingBox.minimumWorld));
			max.copyFrom(BABYLON.Vector3.Maximize(max, bi.boundingBox.maximumWorld));
		});

		const center = min.add(max).scale(0.5);
		const size = max.subtract(min);
		const maxDim = Math.max(size.x, size.y, size.z) || 1;

		// Apply scaling
		if (opts.scaleFactor) {
			modelRoot.scaling = new BABYLON.Vector3(opts.scaleFactor, opts.scaleFactor, opts.scaleFactor);
		} else {
			const autoScale = opts.targetSize / maxDim;
			if (maxDim < 0.5) {
				modelRoot.scaling = new BABYLON.Vector3(autoScale, autoScale, autoScale);
			}
		}

		// Position the model
		const lowestY = min.y;
		const raise = worldPos.y - lowestY;
		modelRoot.position = new BABYLON.Vector3(worldPos.x - center.x, raise, worldPos.z - center.z);

		// Optional camera focus
		if (opts.focusCamera) {
			const camera = scene.activeCamera as BABYLON.ArcRotateCamera;
			if (camera) {
				try {
					camera.target = center;
					const boundingRadius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
					camera.radius = Math.max(5, boundingRadius * 6);
				} catch (e) {}
			}
		}

		console.log(`✓ Model '${modelName}' placed at`, worldPos);
		return { added: addedMeshes.length, min, max, center, modelRoot };
	} catch (err) {
		console.error(`✗ Failed to place model '${modelName}'`, err);
		throw err;
	}
}

/**
 * Place model in front of camera (along camera view direction)
 */
export async function placeModelInFrontOfCamera(
	scene: BABYLON.Scene,
	modelName: string,
	distanceInFront: number = 6,
	options?: { scaleFactor?: number; onGround?: boolean; targetSize?: number }
) {
	const camera = scene.activeCamera as BABYLON.ArcRotateCamera;
	const cameraPos = camera.position.clone();
	const cameraDir = camera.getDirection(BABYLON.Axis.Z);
	const worldPos = cameraPos.add(cameraDir.scale(distanceInFront));
	
	return placeModel(scene, modelName, worldPos, { ...options, focusCamera: false });
}
