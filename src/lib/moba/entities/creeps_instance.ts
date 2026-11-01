import * as BABYLON from "@babylonjs/core";

export class Creep {
    public rootNode: BABYLON.Mesh;
    public mesh?: BABYLON.TransformNode;
    private instance?: BABYLON.InstantiatedEntries;
    private static containers = new Map<string, Promise<BABYLON.AssetContainer>>();
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

        // An empty Mesh (not a TransformNode) so it can use moveWithCollisions.
        this.rootNode = new BABYLON.Mesh("creepRoot", this.scene);
        this.rootNode.ellipsoid = new BABYLON.Vector3(2, 3, 2);
        this.rootNode.ellipsoidOffset = new BABYLON.Vector3(0, 3, 0);
        this.rootNode.isPickable = false;
        this.rootNode.position = spawnPosition.clone();

        this.id = Creep.nextId++;
        Creep.active.add(this);
        this.ready = this.createCreep();
        this.startMovement();
    }

    /** Load both creep models once; call this during the loading screen. */
    public static preload(scene: BABYLON.Scene): Promise<unknown> {
        return Promise.all(["Ate_Tanod.glb", "Kuya_Tanod.glb"].map((f) => Creep.loadContainer(scene, f)));
    }

    private static loadContainer(scene: BABYLON.Scene, file: string) {
        let promise = Creep.containers.get(file);
        if (!promise) {
            promise = BABYLON.SceneLoader.LoadAssetContainerAsync("/creeps/", file, scene);
            promise.catch(() => Creep.containers.delete(file));
            Creep.containers.set(file, promise);
        }
        return promise;
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
            const container = await Creep.loadContainer(this.scene, file);
            if (!this.isAlive) return;

            this.instance = container.instantiateModelsToScene((name) => `${name}_${this.id}`, false);
            const root = this.instance.rootNodes[0] as BABYLON.TransformNode;
            root.parent = this.rootNode;
            root.scaling.scaleInPlace(Creep.MODEL_SCALE);
            this.mesh = root;
            this.meshes = root.getChildMeshes();
            for (const m of this.meshes) m.receiveShadows = true;
            this.animationGroups = this.instance.animationGroups;
            this.playAnimation(this.hasArrived ? "Idle" : "Walk");

            // Desync walk cycles so creeps don't move in lockstep.
            const walk = this.animationGroups.find((g) => g.name === "Walk");
            if (walk && !this.hasArrived) walk.goToFrame(walk.from + Math.random() * (walk.to - walk.from));
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
        const step = BABYLON.Vector3.Zero();

        if (distance < 1.0) {
            this.onReachDestination();
        } else {
            const stepLength = (this.speed * deltaTime) / distance;
            step.x = dx * stepLength;
            step.z = dz * stepLength;
            this.rootNode.rotation.y = Math.atan2(dx, dz);
        }

        this.separate(deltaTime, step);

        // Slide along solid meshes (checkCollisions) instead of passing through them.
        const y = pos.y;
        this.rootNode.moveWithCollisions(step);
        this.rootNode.position.y = y;
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

        this.instance?.dispose();
        this.rootNode.dispose();
    }
}