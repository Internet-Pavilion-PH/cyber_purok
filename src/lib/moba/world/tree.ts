import * as BABYLON from "@babylonjs/core";

export class Tree {
    public rootNode: BABYLON.TransformNode;

    constructor(
        public scene: BABYLON.Scene,
        public position: BABYLON.Vector3,
        public trunkHeight: number = 10,
        public trunkRadius: number = 2,
    ) {
        this.rootNode = new BABYLON.TransformNode("treeRoot", this.scene);
        this.rootNode.position = this.position.clone();
        this.createTree();
    }

    private createTree() {
        const trunk = BABYLON.MeshBuilder.CreateCylinder(
            "trunk",
            {
                height: this.trunkHeight * 2,
                diameterTop: this.trunkRadius * 1.1,
                diameterBottom: this.trunkRadius * 1.4,
                tessellation: 12,
            },
            this.scene,
        );
        trunk.parent = this.rootNode;
        trunk.position = new BABYLON.Vector3(0, this.trunkHeight, 0);

        const foliage = BABYLON.MeshBuilder.CreateIcoSphere(
            "foliage",
            { radius: Math.max(4, this.trunkHeight * 1.2), subdivisions: 1 },
            this.scene,
        );
        foliage.parent = this.rootNode;
        foliage.position = new BABYLON.Vector3(0, this.trunkHeight * 2.2, 0);

        const foliageMaterial = new BABYLON.StandardMaterial("foliageMaterial", this.scene);
        foliageMaterial.diffuseColor = new BABYLON.Color3(0.05, 0.35, 0.15);
        foliageMaterial.emissiveColor = new BABYLON.Color3(0.03, 0.12, 0.05);
        foliage.material = foliageMaterial;
    }
}