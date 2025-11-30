
<script lang="ts">
	import { onMount } from 'svelte';
	import * as BABYLON from '@babylonjs/core';
	import '@babylonjs/loaders/glTF';
	import { CustomLoadingScreen } from '$lib/CustomLoadingScreen';
	import { placeModel, placeModelInFrontOfCamera } from '$lib/placeModel';
	import { initEngine } from '$lib/engineSetup';
	import { initScene, startRenderLoop } from '$lib/sceneSetup';

	let canvas: HTMLCanvasElement | undefined;
	let engine: BABYLON.Engine | BABYLON.WebGPUEngine | undefined;
	let scene: BABYLON.Scene | undefined;
	let camera: BABYLON.ArcRotateCamera | undefined;

	// debug string for camera info shown on-screen
	let cameraDebug = '';
	let rendererInfo = '';

	// auto-rotate settings
	let autoRotate = true;
	const rotateSpeed = 0.1;

	onMount(() => {
		if (!canvas) return;

		// Initialize engine and scene asynchronously
		(async () => {
			// Initialize engine (WebGPU or WebGL)
			engine = await initEngine(canvas);

			// Set up custom loading screen
			BABYLON.SceneLoader.ShowLoadingScreen = true;
			engine.loadingScreen = new CustomLoadingScreen(`/cyber_purok.png`);

			// Initialize scene with all meshes, lights, and camera
			const result = await initScene(engine, {
				heightmapUrl: '/heightmap.png',
				logoUrl: '/cyber_purok.png',
				cameraPosition: [43.43, 11.64, -1.32],
				autoRotate,
				rotateSpeed
			});

			scene = result.scene;
			camera = result.camera;

			// Load models using simple API
			(async () => {
				// Place at position on ground (raycasts down to terrain)
				await placeModel(scene, 'salawaki_swimming.glb', [10, 0, 5], {
					scaleFactor: 0.1,
					onGround: false
				});


				await placeModel(scene, 'https://kolown.net/assets/ip25/zebra.glb', [10, 0, 5], {
					scaleFactor: 3,
					onGround: true
				});

				// Place in front of camera
				await placeModelInFrontOfCamera(scene, 'gw.glb', 6, {
					scaleFactor: 3,
					onGround: true
				});
			})();

			// Start render loop with camera constraints and debug updates
			startRenderLoop(engine, scene, camera, {
				autoRotate,
				rotateSpeed,
				onCameraUpdate: (info) => {
					cameraDebug = `alpha: ${info.alpha.toFixed(3)} | beta: ${info.beta.toFixed(3)} | radius: ${info.radius.toFixed(2)}\npos: ${info.position.x.toFixed(2)}, ${info.position.y.toFixed(2)}, ${info.position.z.toFixed(2)}`;
					rendererInfo = `${info.rendererType} | ${Math.round(info.fps)} FPS`;
				}
			});
		})();

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

<!-- Camera debug overlay -->
{#if cameraDebug}
<div class="cam-debug">{cameraDebug}</div>
{/if}

<!-- Renderer info overlay -->
{#if rendererInfo}
<div class="renderer-info">{rendererInfo}</div>
{/if}















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

	.cam-debug {
		position: fixed;
		left: 12px;
		top: 12px;
		background: rgba(0,0,0,0.6);
		color: #0f0;
		padding: 8px 10px;
		font-family: monospace;
		font-size: 12px;
		border-radius: 6px;
		z-index: 9999;
		white-space: pre-line;
	}

	.renderer-info {
		position: fixed;
		right: 12px;
		top: 12px;
		background: rgba(0,0,0,0.6);
		color: #0ff;
		padding: 8px 10px;
		font-family: monospace;
		font-size: 12px;
		border-radius: 6px;
		z-index: 9999;
	}
</style>

