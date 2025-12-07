import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],

//added for babylonjs optimization
optimizeDeps: {
    include: [
      '@babylonjs/core',
      '@babylonjs/loaders',
      '@babylonjs/materials',
      '@babylonjs/procedural-textures'
    ]
  }



});
