import * as BABYLON from '@babylonjs/core';
import '@babylonjs/materials';


export interface SceneConfig {
	heightmapUrl: string;
	logoUrl: string;
	/** choose 'grid' (default) or 'grass' for the ground material */
	groundMaterial?: 'grass' | 'grid';
	cameraPosition?: [number, number, number];
	autoRotate?: boolean;
	rotateSpeed?: number;
}

interface StartRenderLoopOptions {
	autoRotate?: boolean;
	rotateSpeed?: number;
	onCameraUpdate?: (info: {
		alpha: number;
		beta: number;
		radius: number;
		position: BABYLON.Vector3;
		fps: number;
		rendererType: string;
	}) => void;
}

/**
 * Initialize the complete Babylon scene with lights, ground, camera, and billboard
 */
export async function initScene(
	engine: BABYLON.Engine | BABYLON.WebGPUEngine,
	config: SceneConfig
) {
	const scene = new BABYLON.Scene(engine);

	// MOBA-friendly camera: 55° tilt
	const camera = new BABYLON.ArcRotateCamera(
		'camera',
		-Math.PI / 2,
		(55 * Math.PI) / 180,
		20,
		BABYLON.Vector3.Zero(),
		scene
	);
	camera.attachControl(engine.getRenderingCanvas(), true);

	// Set initial camera position if provided
	if (config.cameraPosition) {
		try {
			camera.setPosition(
				new BABYLON.Vector3(
					config.cameraPosition[0],
					config.cameraPosition[1],
					config.cameraPosition[2]
				)
			);
		} catch (e) {
			console.warn('failed to set initial camera position', e);
		}
	}

	camera.lowerRadiusLimit = 8;
	camera.upperRadiusLimit = 45;
	camera.lowerBetaLimit = (30 * Math.PI) / 180; // 30°
	camera.upperBetaLimit = (75 * Math.PI) / 180; // 75°

	// Lights
	const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
	hemi.intensity = 0.6;

	const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-1, -2, -1), scene);
	dir.position = new BABYLON.Vector3(50, 100, 50);
	dir.intensity = 0.8;

	// Ground with heightmap
	const ground = BABYLON.Mesh.CreateGroundFromHeightMap
		? BABYLON.Mesh.CreateGroundFromHeightMap(
				'ground',
				config.heightmapUrl,
				200,
				200,
				300,
				0,
				20,
				scene,
				false,
				() => {
					// Apply selected ground material when heightmap is ready.
					// Default: GridMaterial; optional: procedural Grass (loaded dynamically).
					(async () => {
						const { GridMaterial } = await import('@babylonjs/materials');

						if (config.groundMaterial === 'grass') {
							try {
								const proc = await import('@babylonjs/procedural-textures');
								const GrassProc: any = (proc as any).GrassProceduralTexture || (proc as any).GrassProceduralTexture;
								if (GrassProc) {
									const grassMat = new BABYLON.StandardMaterial('grassMat', scene);
									const grassTex = new GrassProc('grassTex', 50, scene);
									grassMat.ambientTexture = grassTex;
									grassMat.backFaceCulling = false;
									ground.material = grassMat;
									ground.receiveShadows = true;
									return;
								}
							} catch (e) {
								console.warn('Failed to load procedural textures, falling back to GridMaterial', e);
							}
						}

						// Default grid material
						const grid = new GridMaterial('groundMaterial', scene);
						grid.majorUnitFrequency = 4;
						grid.minorUnitVisibility = 0.45;
						grid.gridRatio = 4;
						grid.backFaceCulling = false;
						// subtle dark base color
						grid.mainColor = new BABYLON.Color3(0.2, 0.2, 0.25);
						// neon green grid lines
						const neonGreen = new BABYLON.Color3(0.0, 1.0, 0.2);
						grid.lineColor = neonGreen;
						// ensure lines can emit for GlowLayer to pick them up
						try {
							// GridMaterial exposes emissiveColor in some versions
							(grid as any).emissiveColor = neonGreen;
						} catch (e) {}
						ground.material = grid;
						ground.receiveShadows = true;
					})();
				}
		  )
		: BABYLON.MeshBuilder.CreateGround('ground', { width: 200, height: 200 }, scene);

	// Shadow generator
	const shadowGen = new BABYLON.ShadowGenerator(1024, dir);
	shadowGen.useBlurExponentialShadowMap = true;

	// Billboard label
	const boxHeight = 2;
	const labelPlane = BABYLON.MeshBuilder.CreatePlane(
		'labelPlane',
		{ width: 10, height: 5 },
		scene
	);
	labelPlane.position = new BABYLON.Vector3(0, boxHeight + 1.2, 0);
	labelPlane.isPickable = false;

	const dt = new BABYLON.DynamicTexture('labelDt', { width: 512, height: 256 }, scene, false);
	dt.hasAlpha = true;
	dt.updateURL(config.logoUrl);

	const labelMat = new BABYLON.StandardMaterial('labelMat', scene);
	labelMat.diffuseTexture = dt;
	labelMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
	labelMat.backFaceCulling = false;
	labelMat.diffuseTexture.hasAlpha = true;
	labelPlane.material = labelMat;
	labelPlane.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;

	return { scene, camera, ground, labelPlane };
}

/**
 * Start render loop with camera constraints and auto-rotation
 */
export function startRenderLoop(
	engine: BABYLON.Engine | BABYLON.WebGPUEngine,
	scene: BABYLON.Scene,
	camera: BABYLON.ArcRotateCamera,
	options?: StartRenderLoopOptions
) {
	const opts = {
		autoRotate: false,
		rotateSpeed: 0.1,
		...options
	};

	const groundY = 0;
	let lastCamUpdate = 0;

	engine.runRenderLoop(() => {
		if (!scene) return;

		// Clamp camera target to ground level
		try {
			if (camera.target && camera.target.y < groundY) camera.target.y = groundY;
		} catch (e) {}

		// Ensure camera position stays above ground
		try {
			const pos = camera.position;
			if (pos.y < groundY + 0.5) {
				camera.setPosition(new BABYLON.Vector3(pos.x, groundY + 0.5, pos.z));
			}
		} catch (e) {}

		// Auto-rotate camera
		if (opts.autoRotate && engine) {
			try {
				const dtSec = (engine.getDeltaTime?.() || 16) / 1000;
				camera.alpha += opts.rotateSpeed * dtSec;
			} catch (e) {}
		}

		// Camera update callback (~10Hz)
		if (opts.onCameraUpdate) {
			const now = Date.now();
			if (now - lastCamUpdate > 100) {
				lastCamUpdate = now;
				try {
					const fps = engine.getFps?.() || 0;
					const rendererType = (engine as any).isWebGPU ? 'WebGPU' : 'WebGL';
					opts.onCameraUpdate({
						alpha: camera.alpha,
						beta: camera.beta,
						radius: camera.radius,
						position: camera.position.clone(),
						fps,
						rendererType
					});
				} catch (e) {}
			}
		}

		scene.render();
	});
}
