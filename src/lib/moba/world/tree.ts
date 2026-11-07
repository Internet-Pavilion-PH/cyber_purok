import * as BABYLON from "@babylonjs/core";

export class Tree {
    public rootNode: BABYLON.TransformNode;
    public foliageSubdivisions: number;

    constructor(
        public scene: BABYLON.Scene,
        public position: BABYLON.Vector3,
        public trunkHeight: number = 10,
        public trunkRadius: number = 2,
        foliageSubdivisions: number = 1,
    ) {
        this.foliageSubdivisions = foliageSubdivisions;
        this.rootNode = new BABYLON.TransformNode("treeRoot", this.scene);
        this.rootNode.position = this.position.clone();
        this.createTree();
    }

    private createTree() {
        const trunkMaterial = new BABYLON.StandardMaterial("treeTrunkMaterial", this.scene);
        trunkMaterial.diffuseColor = new BABYLON.Color3(0.28, 0.2, 0.14);
        trunkMaterial.specularColor = new BABYLON.Color3(0.1, 0.08, 0.04);

        const foliageMaterial = new BABYLON.StandardMaterial("foliageMaterial", this.scene);
        const foliageTexture = new BABYLON.Texture("/images/texture/trees.png", this.scene);
        foliageTexture.uScale = 1;
        foliageTexture.vScale = 1;

        foliageMaterial.diffuseTexture = foliageTexture;
        foliageMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        foliageMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0);
        foliageMaterial.backFaceCulling = false;

        const trunkPrototype = BABYLON.MeshBuilder.CreateCylinder(
            "treeTrunkPrototype",
            {
                height: this.trunkHeight * 2,
                diameterTop: this.trunkRadius * 1.1,
                diameterBottom: this.trunkRadius * 1.4,
                tessellation: 12,
            },
            this.scene,
        );
        trunkPrototype.material = trunkMaterial;
        trunkPrototype.parent = this.rootNode;
        trunkPrototype.position = new BABYLON.Vector3(0, this.trunkHeight, 0);
        trunkPrototype.isVisible = false;
        trunkPrototype.doNotSyncBoundingInfo = true;

        const foliagePrototype = BABYLON.MeshBuilder.CreateIcoSphere(
            "treeFoliagePrototype",
            { radius: Math.max(4, this.trunkHeight * 1.2), subdivisions: this.foliageSubdivisions },
            this.scene,
        );
        foliagePrototype.material = foliageMaterial;
        foliagePrototype.parent = this.rootNode;
        foliagePrototype.position = new BABYLON.Vector3(0, this.trunkHeight * 2.2, 0);
        foliagePrototype.isVisible = false;
        foliagePrototype.doNotSyncBoundingInfo = true;

        const trunk = trunkPrototype.createInstance("treeTrunkInstance");
        trunk.parent = this.rootNode;
        trunk.position = new BABYLON.Vector3(0, this.trunkHeight, 0);
        trunk.material = trunkMaterial;

        const foliage = foliagePrototype.createInstance("treeFoliageInstance");
        foliage.parent = this.rootNode;
        foliage.position = new BABYLON.Vector3(0, this.trunkHeight * 2.2, 0);
        foliage.material = foliageMaterial;
    }
}