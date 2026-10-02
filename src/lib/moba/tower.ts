import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import { get } from "svelte/store";



export class Tower {
    public rootNode: BABYLON.TransformNode;

    constructor(
        public scene: BABYLON.Scene,
        public position: BABYLON.Vector3,
        public towerWidth: number = 50,   // Outer width/depth span of the tower
        public columnWidth: number = 2,   // Width and depth of each column
        public height: number = 40,       // Height of the columns
        public angle: number = Math.PI / 4,
    ) {
        // Create a parent node centered at the given position
        this.rootNode = new BABYLON.TransformNode("towerRoot", this.scene);
        this.rootNode.position = this.position;
        this.rootNode.rotation.y = this.angle;

        this.createTower();
    }

    private createTower() {
        const baseOffset = this.towerWidth / 2;
        const poleRadius = Math.max(this.columnWidth * 0.8, 1.6);

        const leftPole = BABYLON.MeshBuilder.CreateCylinder(
            "leftPole",
            {
                height: this.height,
                diameterTop: poleRadius * 0.8,
                diameterBottom: poleRadius * 1.2,
                tessellation: 14,
            },
            this.scene,
        );
        leftPole.position = new BABYLON.Vector3(-baseOffset, this.height / 2, 0);
        leftPole.parent = this.rootNode;

        const rightPole = BABYLON.MeshBuilder.CreateCylinder(
            "rightPole",
            {
                height: this.height,
                diameterTop: poleRadius * 0.8,
                diameterBottom: poleRadius * 1.2,
                tessellation: 14,
            },
            this.scene,
        );
        rightPole.position = new BABYLON.Vector3(baseOffset, this.height / 2, 0);
        rightPole.parent = this.rootNode;

        const topBeam = BABYLON.MeshBuilder.CreateCylinder(
            "topBeam",
            {
                height: this.towerWidth * 1.1,
                diameterTop: this.columnWidth * 0.6,
                diameterBottom: this.columnWidth * 0.8,
                tessellation: 18,
            },
            this.scene,
        );
        topBeam.position = new BABYLON.Vector3(0, this.height + this.columnWidth * 0.9, 0);
        topBeam.rotation.z = Math.PI / 2;
        topBeam.parent = this.rootNode;

        const greenMaterial = new BABYLON.StandardMaterial("bambooGreen", this.scene);
        greenMaterial.diffuseColor = new BABYLON.Color3(0.24, 0.45, 0.2);
        greenMaterial.emissiveColor = new BABYLON.Color3(0.08, 0.14, 0.06);

        const nodeMaterial = new BABYLON.StandardMaterial("bambooNode", this.scene);
        nodeMaterial.diffuseColor = new BABYLON.Color3(0.18, 0.36, 0.16);
        nodeMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.1, 0.05);

        [leftPole, rightPole, topBeam].forEach((mesh) => {
            mesh.material = greenMaterial;
        });

        const stalks = [leftPole, rightPole];
        for (const stalk of stalks) {
            const segmentCount = Math.max(1, Math.ceil(this.height / 8));
            for (let i = 1; i < segmentCount; i++) {
                const segmentY = (i / segmentCount) * this.height;
                const node = BABYLON.MeshBuilder.CreateCylinder(
                    `${stalk.name}Node${i}`,
                    {
                        height: 0.25,
                        diameterTop: poleRadius * 1.04,
                        diameterBottom: poleRadius * 1.12,
                        tessellation: 12,
                    },
                    this.scene,
                );
                node.position = stalk.position.clone();
                node.position.y = segmentY;
                node.parent = this.rootNode;
                node.material = nodeMaterial;
            }
        }
    }
}