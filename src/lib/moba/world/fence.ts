import * as BABYLON from "@babylonjs/core";

export type FencePoint = {
    x: number;
    z: number;
};

export class Fence {
    public rootNode: BABYLON.TransformNode;
    public meshes: BABYLON.Mesh[] = [];

    constructor(
        public scene: BABYLON.Scene,
        public points: FencePoint[],
        public height: number = 12,
        public postRadius: number = 0.8,
        public railRadius: number = 0.35,
        public baseY: number = 0,
    ) {
        this.rootNode = new BABYLON.TransformNode("fenceRoot", this.scene);
        this.createFence();
    }

    public addShadowCasters(shadowGen: BABYLON.ShadowGenerator) {
        for (const mesh of this.meshes) {
            mesh.receiveShadows = true;
            shadowGen.addShadowCaster(mesh, true);
        }
    }

    private createFence() {
        const postMaterial = new BABYLON.StandardMaterial("bambooPostMat", this.scene);
        postMaterial.diffuseColor = new BABYLON.Color3(0.24, 0.45, 0.2);
        postMaterial.emissiveColor = new BABYLON.Color3(0.08, 0.14, 0.06);

        const railMaterial = new BABYLON.StandardMaterial("bambooRailMat", this.scene);
        railMaterial.diffuseColor = new BABYLON.Color3(0.18, 0.36, 0.16);
        railMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.1, 0.05);

        const nodeMaterial = new BABYLON.StandardMaterial("bambooNodeMat", this.scene);
        nodeMaterial.diffuseColor = new BABYLON.Color3(0.16, 0.28, 0.14);
        nodeMaterial.emissiveColor = new BABYLON.Color3(0.04, 0.08, 0.04);

        for (let i = 0; i < this.points.length; i++) {
            const point = this.points[i];
            const post = BABYLON.MeshBuilder.CreateCylinder(
                `fencePost_${i}`,
                {
                    height: this.height,
                    diameterTop: this.postRadius * 0.8,
                    diameterBottom: this.postRadius * 1.2,
                    tessellation: 12,
                },
                this.scene,
            );
            post.position = new BABYLON.Vector3(point.x, this.baseY + this.height / 2, point.z);
            post.parent = this.rootNode;
            post.material = postMaterial;
            this.meshes.push(post);

            const jointCount = Math.max(1, Math.floor(this.height / 4));
            for (let j = 1; j < jointCount; j++) {
                const joint = BABYLON.MeshBuilder.CreateCylinder(
                    `fenceJoint_${i}_${j}`,
                    {
                        height: 0.25,
                        diameterTop: this.postRadius * 1.05,
                        diameterBottom: this.postRadius * 1.12,
                        tessellation: 10,
                    },
                    this.scene,
                );
                joint.position = new BABYLON.Vector3(point.x, this.baseY + (j / jointCount) * this.height, point.z);
                joint.parent = this.rootNode;
                joint.material = nodeMaterial;
                this.meshes.push(joint);
            }
        }

        for (let i = 0; i < this.points.length - 1; i++) {
            const a = this.points[i];
            const b = this.points[i + 1];
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            const angle = Math.atan2(dz, dx);

            const railCount = Math.max(2, Math.min(4, Math.ceil(this.height / 4)));
            for (let r = 1; r <= railCount; r++) {
                const rail = BABYLON.MeshBuilder.CreateCylinder(
                    `fenceRail_${i}_${r}`,
                    {
                        height: distance,
                        diameterTop: this.railRadius * 1.1,
                        diameterBottom: this.railRadius * 1.3,
                        tessellation: 12,
                    },
                    this.scene,
                );

                rail.position = new BABYLON.Vector3(
                    (a.x + b.x) / 2,
                    this.baseY + (r / (railCount + 1)) * this.height,
                    (a.z + b.z) / 2,
                );
                rail.rotation.z = Math.PI / 2;
                rail.rotation.y = -angle;
                rail.parent = this.rootNode;
                rail.material = railMaterial;
                this.meshes.push(rail);
            }
        }
    }
}