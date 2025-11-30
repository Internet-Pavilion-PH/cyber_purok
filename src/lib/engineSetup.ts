import * as BABYLON from '@babylonjs/core';

/**
 * Initialize WebGPU engine with fallback to WebGL
 */
export async function initEngine(
	canvas: HTMLCanvasElement
): Promise<BABYLON.Engine | BABYLON.WebGPUEngine> {
	try {
		const webGPUSupported = await BABYLON.WebGPUEngine.IsSupportedAsync;
		if (webGPUSupported) {
			console.log('🚀 Initializing WebGPU engine...');
			const webGPUEngine = new BABYLON.WebGPUEngine(canvas);
			await webGPUEngine.initAsync();
			console.log('✓ WebGPU engine ready');
			return webGPUEngine;
		} else {
			console.log('⚠ WebGPU not supported, falling back to WebGL');
			return new BABYLON.Engine(canvas, true);
		}
	} catch (e) {
		console.warn('⚠ WebGPU initialization failed, falling back to WebGL:', e);
		return new BABYLON.Engine(canvas, true);
	}
}
