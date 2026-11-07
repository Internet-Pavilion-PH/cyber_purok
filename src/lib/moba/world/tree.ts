import * as BABYLON from "@babylonjs/core";

export class Tree {
    public rootNode: BABYLON.TransformNode;
    public foliageSubdivisions: number;
    public trunkHeight: number;
    public trunkRadius: number;
    public trunkMesh: BABYLON.Mesh;
    public foliageMesh: BABYLON.Mesh;

    constructor(
        public scene: BABYLON.Scene,
        public position: BABYLON.Vector3,
        public trunkHeightOverride: number = 10,
        public trunkRadiusOverride: number = 2,
        foliageSubdivisions: number = 1,
    ) {
        this.trunkHeight = trunkHeightOverride;
        this.trunkRadius = trunkRadiusOverride;
        this.foliageSubdivisions = foliageSubdivisions;
        this.rootNode = new BABYLON.TransformNode(`treeRoot_${Math.random().toString(36).slice(2, 9)}`, this.scene);
        this.rootNode.position = this.position.clone();

        const trunkMaterial = new BABYLON.StandardMaterial(`treeTrunkMaterial_${this.rootNode.name}`, this.scene);
        trunkMaterial.diffuseColor = new BABYLON.Color3(0.28, 0.2, 0.14);
        trunkMaterial.specularColor = new BABYLON.Color3(0.1, 0.08, 0.04);

        const foliageMaterial = new BABYLON.StandardMaterial(`foliageMaterial_${this.rootNode.name}`, this.scene);
        const foliageTexture = new BABYLON.Texture("/images/texture/trees.png", this.scene);
        foliageTexture.uScale = 1;
        foliageTexture.vScale = 1;
        foliageMaterial.diffuseTexture = foliageTexture;
        foliageMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        foliageMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0);
        foliageMaterial.backFaceCulling = false;

        this.trunkMesh = BABYLON.MeshBuilder.CreateCylinder(
            `treeTrunk_${this.rootNode.name}`,
            {
                height: this.trunkHeight * 2,
                diameterTop: this.trunkRadius * 1.1,
                diameterBottom: this.trunkRadius * 1.4,
                tessellation: 12,
            },
            this.scene,
        );
        this.trunkMesh.material = trunkMaterial;
        this.trunkMesh.parent = this.rootNode;
        this.trunkMesh.position = new BABYLON.Vector3(0, this.trunkHeight, 0);

        this.foliageMesh = BABYLON.MeshBuilder.CreateIcoSphere(
            `treeFoliage_${this.rootNode.name}`,
            { radius: Math.max(4, this.trunkHeight * 1.2), subdivisions: this.foliageSubdivisions },
            this.scene,
        );
        this.foliageMesh.material = foliageMaterial;
        this.foliageMesh.parent = this.rootNode;
        this.foliageMesh.position = new BABYLON.Vector3(0, this.trunkHeight * 2.2, 0);
    }
}