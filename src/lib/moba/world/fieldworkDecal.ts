import * as BABYLON from "@babylonjs/core";
import fieldwork from "../fieldwork.json";

type Station = {
  station: string;
  coordinates: { x: number; y: number; z: number };
  highlights: string[];
};

const Stations: Station[] = fieldwork;

const BLUE = new BABYLON.Color3(0.52, 0.82, 1);

const DISC_RADIUS = 3;
const DISC_RINGS = 4;
const DISC_SEGMENTS = 32;
const DISC_LIFT = 0.3;
const ROUTE_LIFT = 0.4;
const ROUTE_SAMPLE_STEP = 3;

type HeightSampler = (x: number, z: number) => number;

const createHeightSampler = (ground: BABYLON.Mesh): HeightSampler => {
  const groundMesh = ground as BABYLON.GroundMesh;
  return (x, z) => groundMesh.getHeightAtCoordinates?.(x, z) ?? 0;
};

export class FieldworkDecal {
  static createGroundDecals(scene: BABYLON.Scene, ground: BABYLON.Mesh) {
    const sampleHeight = createHeightSampler(ground);

    for (const station of Stations) {
      const decal = this.createTerrainDisc(
        scene,
        `station-${station.station}`,
        station.coordinates.x,
        station.coordinates.z,
        sampleHeight,
      );

      const material = new BABYLON.StandardMaterial(
        `station-material-${station.station}`,
        scene,
      );
      material.diffuseColor = BLUE;
      material.emissiveColor = new BABYLON.Color3(0.18, 0.35, 0.6);
      material.alpha = 0.9;
      material.backFaceCulling = false;
      material.zOffset = -2;
      decal.material = material;
      decal.isPickable = false;
    }

    this.createRouteConnections(scene, sampleHeight);
  }

  /** A disc whose vertices each follow the terrain, so bumps never poke through it. */
  private static createTerrainDisc(
    scene: BABYLON.Scene,
    name: string,
    cx: number,
    cz: number,
    sampleHeight: HeightSampler,
  ) {
    const positions: number[] = [cx, sampleHeight(cx, cz) + DISC_LIFT, cz];
    const indices: number[] = [];

    for (let ring = 1; ring <= DISC_RINGS; ring++) {
      const r = (DISC_RADIUS * ring) / DISC_RINGS;
      for (let s = 0; s < DISC_SEGMENTS; s++) {
        const a = (s / DISC_SEGMENTS) * Math.PI * 2;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        positions.push(x, sampleHeight(x, z) + DISC_LIFT, z);
      }
    }

    const ringStart = (ring: number) => 1 + (ring - 1) * DISC_SEGMENTS;
    for (let s = 0; s < DISC_SEGMENTS; s++) {
      const next = (s + 1) % DISC_SEGMENTS;
      indices.push(0, ringStart(1) + next, ringStart(1) + s);
    }
    for (let ring = 1; ring < DISC_RINGS; ring++) {
      const inner = ringStart(ring);
      const outer = ringStart(ring + 1);
      for (let s = 0; s < DISC_SEGMENTS; s++) {
        const next = (s + 1) % DISC_SEGMENTS;
        indices.push(inner + s, inner + next, outer + s);
        indices.push(inner + next, outer + next, outer + s);
      }
    }

    const normals: number[] = [];
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);

    const mesh = new BABYLON.Mesh(name, scene);
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.applyToMesh(mesh);
    return mesh;
  }

  static createRouteConnections(scene: BABYLON.Scene, sampleHeight: HeightSampler) {
    const routeMaterial = new BABYLON.StandardMaterial("fieldwork-route-material", scene);
    routeMaterial.diffuseColor = BLUE;
    routeMaterial.emissiveColor = BLUE;
    routeMaterial.alpha = 0.95;

    for (let i = 0; i < Stations.length - 1; i++) {
      const current = Stations[i];
      const next = Stations[i + 1];

      const dx = next.coordinates.x - current.coordinates.x;
      const dz = next.coordinates.z - current.coordinates.z;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / ROUTE_SAMPLE_STEP));

      // Sample along the segment so the line hugs the terrain instead of cutting through it.
      const points: BABYLON.Vector3[] = [];
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = current.coordinates.x + dx * t;
        const z = current.coordinates.z + dz * t;
        points.push(new BABYLON.Vector3(x, sampleHeight(x, z) + ROUTE_LIFT, z));
      }

      const dashedLine = BABYLON.MeshBuilder.CreateDashedLines(
        `route-${current.station}-${next.station}`,
        {
          points,
          dashSize: 1.2,
          gapSize: 1,
          updatable: false,
        },
        scene,
      );
      dashedLine.material = routeMaterial;
      dashedLine.isPickable = false;
    }
  }
}
