import * as BABYLON from "@babylonjs/core";

export class Creep {
    public rootNode: BABYLON.TransformNode;
    public mesh!: BABYLON.Mesh;

    public speed: number = 8;
    public targetPosition: BABYLON.Vector3;
    public isAlive: boolean = true;

    private renderObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;

    constructor(
        public scene: BABYLON.Scene,
        public spawnPosition: BABYLON.Vector3,
        targetPosition: BABYLON.Vector3,
        public size: { height: number; width: number; depth: number } = { height: 5, width: 2, depth: 2 }
    ) {
        this.targetPosition = targetPosition.clone();

        this.rootNode = new BABYLON.TransformNode("creepRoot", this.scene);
        this.rootNode.position = spawnPosition.clone();

        this.createCreep();
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

            const creep = new Creep(scene, spawnPoint, targetPosition);
            creep.mesh.receiveShadows = true;
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

    private createCreep() {
        this.mesh = BABYLON.MeshBuilder.CreateBox("creep", this.size, this.scene);
        this.mesh.position = new BABYLON.Vector3(0, this.size.height / 2, 0);
        this.mesh.parent = this.rootNode;
    }

    private startMovement() {
        this.renderObserver = this.scene.onBeforeRenderObservable.add(() => {
            if (!this.isAlive) return;

            const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
            this.move(deltaTime);
        });
    }

    private move(deltaTime: number) {
        const currentPos = this.rootNode.position;
        const direction = this.targetPosition.subtract(currentPos);
        direction.y = 0;

        const distance = direction.length();

        if (distance < 1.0) {
            this.onReachDestination();
            return;
        }

        direction.normalize();
        const step = direction.scale(this.speed * deltaTime);
        this.rootNode.position.addInPlace(step);

        const angle = Math.atan2(direction.x, direction.z);
        this.rootNode.rotation = new BABYLON.Vector3(0, angle, 0);
    }

    private onReachDestination() {
        this.destroy();
    }

    public destroy() {
        this.isAlive = false;

        if (this.renderObserver) {
            this.scene.onBeforeRenderObservable.remove(this.renderObserver);
            this.renderObserver = null;
        }

        this.rootNode.dispose();
    }
}