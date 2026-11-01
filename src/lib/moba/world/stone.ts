import * as BABYLON from "@babylonjs/core";


export class Stone {
    constructor(
        public scene: BABYLON.Scene,
        // One point = a single stone; two points = a row of stones from the first to the second.
        public position: BABYLON.Vector3 | [BABYLON.Vector3, BABYLON.Vector3],
        public height: number,
    ) {}

    public createStone(): BABYLON.TransformNode {
        const size = Math.max(4, this.height * 1.2);
        const material = this.createMaterial();

        if (!Array.isArray(this.position)) {
            return this.createSingle("stone", this.position, size, material);
        }

        const [start, end] = this.position;
        const root = new BABYLON.TransformNode("stoneFence", this.scene);
        const spacing = size * 1.6;
        const count = Math.max(2, Math.ceil(BABYLON.Vector3.Distance(start, end) / spacing) + 1);

        for (let i = 0; i < count; i++) {
            const point = BABYLON.Vector3.Lerp(start, end, i / (count - 1));
            const stone = this.createSingle(`stone_${i}`, point, size, material);
            stone.rotation.y = Math.random() * Math.PI * 2;
            stone.parent = root;
        }
        return root;
    }

    private createSingle(
        name: string,
        position: BABYLON.Vector3,
        size: number,
        material: BABYLON.Material,
    ): BABYLON.Mesh {
        // Type 2 = dodecahedron; uneven axes make it read as a chunky boulder.
        const mesh = BABYLON.MeshBuilder.CreatePolyhedron(
            name,
            { type: 2, sizeX: size, sizeY: size * 0.75, sizeZ: size * 0.9 },
            this.scene,
        );
        mesh.convertToFlatShadedMesh();
        mesh.checkCollisions = true;
        mesh.material = material;
        mesh.position = position.clone();
        return mesh;
    }

    private createMaterial(): BABYLON.StandardMaterial {
        const material = new BABYLON.StandardMaterial("stoneMaterial", this.scene);
        material.diffuseColor = new BABYLON.Color3(0.58, 0.61, 0.64);
        material.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15);
        material.ambientColor = new BABYLON.Color3(0.25, 0.25, 0.25);
        return material;
    }
}