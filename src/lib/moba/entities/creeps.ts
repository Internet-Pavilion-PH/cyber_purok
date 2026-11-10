import * as BABYLON from "@babylonjs/core";
import { getTerrainHeight } from "../world/terrainHeight";

export class Creep {
    public rootNode: BABYLON.Mesh;
    public mesh?: BABYLON.AbstractMesh;
    public meshes: BABYLON.AbstractMesh[] = [];
    /** Resolves once the GLB model has loaded. */
    public ready: Promise<void>;

    private static active = new Set<Creep>();
    private static nextId = 1;
    private static readonly SEPARATION_RADIUS = 6;
    private static readonly SEPARATION_RADIUS_SQ = 36;
    private static readonly SEPARATION_STRENGTH = 6;
    private static readonly MODEL_SCALE = 5;
    private id: number;
    private animationGroups: BABYLON.AnimationGroup[] = [];
    private hasArrived = false;

    public speed: number = 8;
    public targetPosition: BABYLON.Vector3;
    public isAlive: boolean = true;

    private renderObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;
    private spawnDelaySeconds = 0;
    private avoidSeconds = 0;
    private avoidDirection = new BABYLON.Vector3(0, 0, 1);
    private blockCount = 0;

    constructor(
        public scene: BABYLON.Scene,
        public spawnPosition: BABYLON.Vector3,
        targetPosition: BABYLON.Vector3,
        public isLeader: boolean = false,
        spawnDelayMs: number = 0,
    ) {
        this.targetPosition = targetPosition.clone();
        this.spawnDelaySeconds = spawnDelayMs / 1000;

        // An empty Mesh (not a TransformNode) so it can use moveWithCollisions.
        this.rootNode = new BABYLON.Mesh("creepRoot", this.scene);
        this.rootNode.ellipsoid = new BABYLON.Vector3(2, 3, 2);
        this.rootNode.ellipsoidOffset = new BABYLON.Vector3(0, 3, 0);
        this.rootNode.isPickable = false;
        this.rootNode.position = spawnPosition.clone();
        this.rootNode.setEnabled(this.spawnDelaySeconds <= 0);
        this.rootNode.isVisible = this.spawnDelaySeconds <= 0;

        this.id = Creep.nextId++;
        Creep.active.add(this);
        this.ready = this.createCreep();
        this.startMovement();
    }

    /**
     * Spawn a group of creeps in a loose formation around the start point.
     */
    public static spawnGroup(
        scene: BABYLON.Scene,
        spawnZoneCenter: BABYLON.Vector3,
        targetPosition: BABYLON.Vector3,
        groupSize: number = 3,
        areaRadius: number = 6,
        staggerMs: number = 0,
    ): Creep[] {
        const laneDirection = targetPosition.subtract(spawnZoneCenter);
        const normalizedLane = laneDirection.lengthSquared() > 0
            ? laneDirection.normalize()
            : new BABYLON.Vector3(0, 0, 1);
        const lateralDirection = new BABYLON.Vector3(-normalizedLane.z, 0, normalizedLane.x);

        return Array.from({ length: groupSize }, (_, index) => {
            const frontCount = 2;
            const formationIndex = index < frontCount ? index - (frontCount - 1) / 2 : -0.5;
            const laneOffset = index < frontCount ? index * 6 : 9;
            const lateralOffset = formationIndex * 2.8;
            const jitter = (Math.random() - 0.5) * areaRadius * 0.5;

            const spawnPoint = new BABYLON.Vector3(
                spawnZoneCenter.x + normalizedLane.x * (-laneOffset) + lateralDirection.x * lateralOffset + jitter,
                spawnZoneCenter.y,
                spawnZoneCenter.z + normalizedLane.z * (-laneOffset) + lateralDirection.z * lateralOffset + jitter,
            );

            const creep = new Creep(scene, spawnPoint, targetPosition, index === 0, index * staggerMs);
            creep.speed = 7.5 + index * 0.2;
            creep.targetPosition = new BABYLON.Vector3(
                targetPosition.x + normalizedLane.x * (index * 2.5) + lateralDirection.x * (formationIndex * 1.2),
                targetPosition.y,
                targetPosition.z + normalizedLane.z * (index * 2.5) + lateralDirection.z * (formationIndex * 1.2),
            );

            return creep;
        });
    }

    /**
     * Static helper to spawn a single creep at a random position inside a specified zone.
     */
    public static spawnInArea(
        scene: BABYLON.Scene,
        spawnZoneCenter: BABYLON.Vector3,
        targetPosition: BABYLON.Vector3,
        areaRadius: number = 6
    ): Creep {
        const offsetX = (Math.random() - 0.5) * 2 * areaRadius;
        const offsetZ = (Math.random() - 0.5) * 2 * areaRadius;

        const spawnPoint = new BABYLON.Vector3(
            spawnZoneCenter.x + offsetX,
            spawnZoneCenter.y,
            spawnZoneCenter.z + offsetZ
        );

        return new Creep(scene, spawnPoint, targetPosition);
    }

    private async createCreep() {
        const file = this.isLeader ? "Ate_Tanod.glb" : "Kuya_Tanod.glb";
        const rootUrl = "/creeps/";
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", rootUrl, file, this.scene);
            if (!this.isAlive) {
                result.meshes.forEach((m) => m.dispose());
                return;
            }
            this.mesh = result.meshes[0];
            this.mesh.parent = this.rootNode;
            this.mesh.scaling.scaleInPlace(Creep.MODEL_SCALE);
            this.meshes = result.meshes;
            for (const m of this.meshes) m.receiveShadows = true;
            this.animationGroups = result.animationGroups;
            this.playAnimation(this.hasArrived ? "Idle" : "Walk");
        } catch (error) {
            console.error("Failed to load creep model", file, error);
        }
    }

    private startMovement() {
        const engine = this.scene.getEngine();
        this.renderObserver = this.scene.onBeforeRenderObservable.add(() => {
            if (this.isAlive) this.move(engine.getDeltaTime() / 1000);
        });
    }

    private move(deltaTime: number) {
        if (this.spawnDelaySeconds > 0) {
            this.spawnDelaySeconds = Math.max(0, this.spawnDelaySeconds - deltaTime);
            if (this.spawnDelaySeconds > 0) return;
            this.rootNode.setEnabled(true);
            this.rootNode.isVisible = true;
        }

        const pos = this.rootNode.position;
        const dx = this.targetPosition.x - pos.x;
        const dz = this.targetPosition.z - pos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const step = BABYLON.Vector3.Zero();

        if (distance < 1.0) {
            this.onReachDestination();
        } else {
            let heading = new BABYLON.Vector3(dx, 0, dz);
            if (heading.lengthSquared() > 0.0001) heading = heading.normalize();

            if (this.avoidSeconds > 0) {
                this.avoidSeconds = Math.max(0, this.avoidSeconds - deltaTime);
                heading = this.avoidDirection.clone().normalize();
            } else {
                this.blockCount = 0;
            }

            const forward = heading.scale(this.speed * deltaTime);
            step.x = forward.x;
            step.z = forward.z;
            this.rootNode.rotation.y = Math.atan2(heading.x, heading.z);
        }

        this.separate(deltaTime, step);

        const before = pos.clone();
        // Slide along solid meshes (checkCollisions) instead of passing through them.
        this.rootNode.moveWithCollisions(step);
        const moved = Math.hypot(this.rootNode.position.x - before.x, this.rootNode.position.z - before.z);
        const intended = Math.hypot(step.x, step.z);
        if (intended > 0 && moved < intended * 0.35) {
            this.turnAround();
        }
        this.rootNode.position.y = getTerrainHeight(this.rootNode.position.x, this.rootNode.position.z);
    }

    /** Push away from nearby creeps so they don't overlap. */
    private separate(deltaTime: number, step: BABYLON.Vector3) {
        const pos = this.rootNode.position;
        const radius = Creep.SEPARATION_RADIUS;
        for (const other of Creep.active) {
            if (other === this) continue;
            const dx = pos.x - other.rootNode.position.x;
            const dz = pos.z - other.rootNode.position.z;
            const distSq = dx * dx + dz * dz;
            if (distSq >= Creep.SEPARATION_RADIUS_SQ) continue;

            const dist = Math.sqrt(distSq);
            // Deterministic nudge for exactly overlapping creeps
            const nx = dist > 0.001 ? dx / dist : Math.cos(this.id);
            const nz = dist > 0.001 ? dz / dist : Math.sin(this.id);
            const push = (radius - dist) * Creep.SEPARATION_STRENGTH * deltaTime;
            step.x += nx * push;
            step.z += nz * push;
        }
    }

    private turnAround() {
        if (this.avoidSeconds > 0) return;

        const toTarget = this.targetPosition.subtract(this.rootNode.position);
        toTarget.y = 0;
        const currentHeading = toTarget.lengthSquared() > 0.0001
            ? toTarget.normalize()
            : new BABYLON.Vector3(0, 0, 1);

        const reverse = currentHeading.scale(-1);
        const lateral = new BABYLON.Vector3(-currentHeading.z, 0, currentHeading.x);
        const laneSide = (Math.random() < 0.5 ? -1 : 1) * (this.blockCount > 0 ? 1 : 0.5);
        this.avoidDirection = reverse.add(lateral.scale(laneSide)).normalize();

        this.avoidSeconds = 0.8 + Math.random() * 0.6;
        this.blockCount = Math.min(this.blockCount + 1, 3);
        if (this.blockCount > 1) this.avoidSeconds += 0.4;
    }

    private onReachDestination() {
        if (this.hasArrived) return;
        this.hasArrived = true;
        this.playAnimation("Idle");
    }

    private playAnimation(name: string) {
        for (const group of this.animationGroups) group.stop();
        this.animationGroups.find((g) => g.name === name)?.start(true);
    }

    public destroy() {
        this.isAlive = false;
        Creep.active.delete(this);

        if (this.renderObserver) {
            this.scene.onBeforeRenderObservable.remove(this.renderObserver);
            this.renderObserver = null;
        }

        this.rootNode.dispose();
    }
}