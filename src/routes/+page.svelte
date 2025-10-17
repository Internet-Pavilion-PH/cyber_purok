
<script lang="ts">
	import { onMount } from 'svelte';
	import * as BABYLON from '@babylonjs/core';

	let canvas: HTMLCanvasElement | undefined;
	let engine: BABYLON.Engine | undefined;
	let scene: BABYLON.Scene | undefined;

	onMount(() => {
		if (!canvas) return;

		engine = new BABYLON.Engine(canvas, true);
		scene = new BABYLON.Scene(engine);

		// MOBA-friendly camera: 55° tilt
		const camera = new BABYLON.ArcRotateCamera('camera', -Math.PI / 2, (55 * Math.PI) / 180, 20, BABYLON.Vector3.Zero(), scene);
		camera.attachControl(canvas, true);
		camera.lowerRadiusLimit = 8;
		camera.upperRadiusLimit = 45;
		camera.lowerBetaLimit = (30 * Math.PI) / 180; // 30°
		camera.upperBetaLimit = (75 * Math.PI) / 180; // 75°

		const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
		hemi.intensity = 0.6;
		// Directional light for shadows
		const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-1, -2, -1), scene);
		dir.position = new BABYLON.Vector3(50, 100, 50);
		dir.intensity = 0.8;

		// Create ground from a height map image. Place your height map at `static/textures/heightMap.png`.
		// Using the older CreateGroundFromHeightMap API (positional arguments) as requested.
		// width=100, height=100, subdivisions=100, minHeight=0, maxHeight=10
		const ground = BABYLON.Mesh.CreateGroundFromHeightMap
			? BABYLON.Mesh.CreateGroundFromHeightMap('ground', '/heightmap.png', 100, 100, 100, 0, 10, scene, false, () => {
					// once the height map is ready, apply GridMaterial dynamically
					import('@babylonjs/materials').then(({ GridMaterial }) => {
						const grid = new GridMaterial('groundMaterial', scene);
						grid.majorUnitFrequency = 4;
						grid.minorUnitVisibility = 0.45;
						grid.gridRatio = 4;
						grid.backFaceCulling = false;
						grid.mainColor = new BABYLON.Color3(0.2, 0.2, 0.25);
						grid.lineColor = new BABYLON.Color3(0.7, 0.7, 0.7);
						ground.material = grid;
						ground.receiveShadows = true;
					});
				})
			: // fallback: create a flat ground if CreateGroundFromHeightMap isn't available
				BABYLON.MeshBuilder.CreateGround('ground', { width: 200, height: 200 }, scene);

		// Add an orange rectangular cube at the origin, sitting on the ground
		const boxHeight = 2;
		const box = BABYLON.MeshBuilder.CreateBox('box', { width: 2, height: boxHeight, depth: 1 }, scene);
		box.position = new BABYLON.Vector3(0, boxHeight / 2, 0);
		const boxMat = new BABYLON.StandardMaterial('boxMat', scene);
		boxMat.diffuseColor = new BABYLON.Color3(1, 0.55, 0); // orange
		box.material = boxMat;

		// Shadow generator
		const shadowGen = new BABYLON.ShadowGenerator(1024, dir);
		shadowGen.useBlurExponentialShadowMap = true;
		shadowGen.addShadowCaster(box);

			const groundY = 0;
			engine.runRenderLoop(() => {
				if (!scene) return;
				// clamp target y so camera looks at or above the ground
				try {
					if (camera.target && camera.target.y < groundY) camera.target.y = groundY;
				} catch (e) {}

				// ensure camera position is above ground; if below, push it up along camera direction
				try {
					const pos = camera.position;
					if (pos.y < groundY + 0.5) {
						// nudge camera up
						camera.setPosition(new BABYLON.Vector3(pos.x, groundY + 0.5, pos.z));
					}
				} catch (e) {}

				scene.render();
			});

		const onResize = () => engine && engine.resize();
		window.addEventListener('resize', onResize);

		return () => {
			window.removeEventListener('resize', onResize);
			engine && engine.dispose();
		};
	});
</script>

<div class="container">
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.container {
		width: 100vw;
		height: 100vh;
		overflow: hidden;
	}

	canvas {
		width: 100%;
		height: 100%;
		display: block;
		outline: none;
	}
</style>

