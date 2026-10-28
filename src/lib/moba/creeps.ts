import * as BABYLON from "@babylonjs/core";

export class Creep {
    public rootNode: BABYLON.TransformNode;
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

    constructor(
        public scene: BABYLON.Scene,
        public spawnPosition: BABYLON.Vector3,
        targetPosition: BABYLON.Vector3,
        public isLeader: boolean = false
    ) {
        this.targetPosition = targetPosition.clone();

        this.rootNode = new BABYLON.TransformNode("creepRoot", this.scene);
        this.rootNode.position = spawnPosition.clone();

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
        areaRadius: number = 6
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

            const creep = new Creep(scene, spawnPoint, targetPosition, index === 0);
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
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync("", "/", file, this.scene);
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
        const pos = this.rootNode.position;
        const dx = this.targetPosition.x - pos.x;
        const dz = this.targetPosition.z - pos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < 1.0) {
            this.onReachDestination();
        } else {
            const stepLength = (this.speed * deltaTime) / distance;
            pos.x += dx * stepLength;
            pos.z += dz * stepLength;
            this.rootNode.rotation.y = Math.atan2(dx, dz);
        }

        this.separate(deltaTime);
    }

    /** Push away from nearby creeps so they don't overlap. */
    private separate(deltaTime: number) {
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
            pos.x += nx * push;
            pos.z += nz * push;
        }
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