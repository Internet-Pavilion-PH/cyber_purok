
<script lang="ts">
	import { onMount } from 'svelte';
	import * as BABYLON from '@babylonjs/core';
	import '@babylonjs/loaders/glTF';
	import { CustomLoadingScreen } from '$lib/CustomLoadingScreen';
	import { placeModel } from '$lib/placeModel';
	import assetList from '$lib/assetList.json';
	import { initEngine } from '$lib/engineSetup';
	import { initScene, startRenderLoop } from '$lib/sceneSetup';

	type AssetEntry = {
		type?: 'model' | 'billboard';
		link: string;
		filename?: string;
		position: [number, number, number];
		scaleFactor?: number;
		onGround?: boolean;
		targetSize?: number;
		mergeMeshes?: boolean;
		width?: number;
		height?: number;
		labelColor?: string;
	};

	let canvas: HTMLCanvasElement | undefined;
	let engine: BABYLON.Engine | BABYLON.WebGPUEngine | undefined;
	let scene: BABYLON.Scene | undefined;
	let camera: BABYLON.ArcRotateCamera | undefined;

	// debug string for camera info shown on-screen
	let cameraDebug = '';
	let rendererInfo = '';
	// Set this to false in code to hide UI overlays.
	let showUi = false;

	// auto-rotate settings
	let autoRotate = true;
	const rotateSpeed = 0.1;

	onMount(() => {
		if (!canvas) return;

		(async () => {
			engine = await initEngine(canvas);
			if (!engine) return;

			BABYLON.SceneLoader.ShowLoadingScreen = true;
			engine.loadingScreen = new CustomLoadingScreen(`/cyber_purok.png`);

			const result = await initScene(engine, {
				heightmapUrl: '/heightmap.png',
				groundMaterial: 'grass',
				cameraPosition: [43.43, 11.64, -1.32],
				logoUrl: '/cyber_purok.png',
				autoRotate,
				rotateSpeed
			});

			scene = result.scene;
			camera = result.camera;

			if (!scene) return;
			const assets = assetList as unknown as AssetEntry[];
			for (const asset of assets) {
				await placeModel(scene, asset.link, asset.position, {
					scaleFactor: asset.scaleFactor,
					onGround: asset.onGround,
					targetSize: asset.targetSize,
					mergeMeshes: asset.mergeMeshes
				});
			}

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

{#if showUi}
	<!-- Camera debug overlay -->
	{#if cameraDebug}
	<div class="cam-debug">{cameraDebug}</div>
	{/if}

	<!-- Small render info below camera debug -->
	{#if rendererInfo}
	<div class="render-small">{rendererInfo}</div>
	{/if}
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

	/* right-side renderer-info removed; using .render-small on the left */

	.render-small {
		position: fixed;
		left: 12px;
		top: 64px; /* place below the cam-debug box */
		background: rgba(0,0,0,0.6);
		color: #9ef;
		padding: 6px 8px;
		font-family: monospace;
		font-size: 11px;
		border-radius: 6px;
		z-index: 9999;
		white-space: nowrap;
	}

</style>

