import '@babylonjs/core/Debug/debugLayer'

import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'

import './style.css'

// create canvas and engine
const canvas = document.createElement('canvas')
canvas.id = 'renderCanvas'
canvas.style.width = '100%'
canvas.style.height = '100%'
document.getElementById('app').appendChild(canvas)

const engine = new Engine(canvas, true)
const scene = new Scene(engine)

// Camera: ArcRotateCamera gives easier control; we'll lock rotation and use it as a tilted camera
const TILT_DEG = 45
const DEFAULT_HEIGHT = 30
const MIN_HEIGHT = 12
const MAX_HEIGHT = 120
const PAN_LIMIT = 80

// ArcRotateCamera parameters: alpha, beta, radius, target
// alpha: rotation around Y (we want behind the target on +Z), so alpha = 0
// beta: polar angle from Y axis; beta = PI/2 - tilt
const alpha = 0
const beta = Math.PI / 2 - (TILT_DEG * Math.PI / 180)
let radius = DEFAULT_HEIGHT / Math.tan((TILT_DEG * Math.PI) / 180)

const camera = new ArcRotateCamera('cam', alpha, beta, radius, new Vector3(0, 1.5, 0), scene)
camera.attachControl(canvas, true)
camera.lowerRadiusLimit = 10
camera.upperRadiusLimit = 200
camera.wheelPrecision = 50
camera.useAutoRotationBehavior = false

// Prevent camera from going below the ground by clamping beta (polar) angle
// beta is measured from +Y axis: beta < PI/2 keeps camera above the horizon
camera.lowerBetaLimit = 0.3 // don't go too close to top-down
camera.upperBetaLimit = Math.PI / 2 - 0.05 // stay above the plane

// Lock rotation so user can't rotate camera around the target (MOBA-style)
camera.allowUpsideDown = false
camera.panningSensibility = 1000
camera.panningInertia = 0.6

// Lights
const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
hemi.intensity = 0.6

const dir = new DirectionalLight('dir', new Vector3(-1, -2, 1), scene)
dir.position = new Vector3(-10, 40, 10)
dir.intensity = 0.01

// Ground
const ground = MeshBuilder.CreateGround('ground', { width: 200, height: 200 }, scene)
const groundMat = new StandardMaterial('gmat', scene)
groundMat.diffuseColor = new Color3(0.12, 0.14, 0.16)
ground.material = groundMat

// Hero placeholder
const hero = MeshBuilder.CreateBox('hero', { width: 1.5, height: 3, depth: 1 }, scene)
const heroMat = new StandardMaterial('hmat', scene)
heroMat.diffuseColor = new Color3(1, 0.34, 0.34)
hero.material = heroMat
hero.position = new Vector3(0, 1.5, 0)

// Simple pan/zoom behaviour (ArcRotateCamera supports panning)
// We'll override some behaviour to clamp panning and maintain MOBA feel
let targetOffset = new Vector3(0, 0, 0)

scene.onBeforeRenderObservable.add(() => {
	// Smoothly follow hero+offset
	const desiredTarget = hero.position.add(targetOffset)
	// lerp target
	const t = 0.08
	camera.target = Vector3.Lerp(camera.target, desiredTarget, t)

	// Make sure the camera target never drops below the ground plane (y = 0)
	if (camera.target.y < 0) {
		camera.target.y = 0
	}
})

// Pointer drag to pan (left mouse or single touch)
let isPointerDown = false
let lastX = 0
let lastY = 0
canvas.addEventListener('pointerdown', (e) => {
	if (e.button !== 0) return
	isPointerDown = true
	lastX = e.clientX
	lastY = e.clientY
})
window.addEventListener('pointermove', (e) => {
	if (!isPointerDown) return
	const dx = (e.clientX - lastX) / window.innerWidth
	const dy = (e.clientY - lastY) / window.innerHeight
	const panSpeed = 60
	targetOffset.x -= dx * panSpeed
	targetOffset.z += dy * panSpeed
	targetOffset.x = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, targetOffset.x))
	targetOffset.z = Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, targetOffset.z))
	lastX = e.clientX
	lastY = e.clientY
})
window.addEventListener('pointerup', () => (isPointerDown = false))

// Wheel zoom adjusts radius and keeps tilt
canvas.addEventListener('wheel', (e) => {
	const delta = Math.sign(e.deltaY)
	const zoomFactor = delta > 0 ? 1.08 : 1 / 1.08
	radius *= zoomFactor
	radius = Math.max(10, Math.min(200, radius))
	camera.radius = radius
})

// Resize
window.addEventListener('resize', () => {
	engine.resize()
})

engine.runRenderLoop(() => {
	hero.rotation.y += 0.005
	scene.render()
})


