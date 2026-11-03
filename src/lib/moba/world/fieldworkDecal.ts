import * as BABYLON from "@babylonjs/core";
import fieldwork from "./fieldwork.json";

type Station = {
  station: string;
  coordinates: { x: number; y: number; z: number };
  highlights: string[];
};

const Stations: Station[] = fieldwork;

const StationCoordinates: Array<[number, number, number]> = Stations.map(
  ({ coordinates }) => [coordinates.x, coordinates.y, coordinates.z],
);

const BLUE = new BABYLON.Color3(0.52, 0.82, 1);

export class FieldworkDecal {
  static createGroundDecals(scene: BABYLON.Scene, ground: BABYLON.Mesh) {
    for (const station of Stations) {
      const decal = BABYLON.MeshBuilder.CreateDisc(
        `station-${station.station}`,
        {
          radius: 3,
          tessellation: 32,
        },
        scene,
      );

      decal.position = new BABYLON.Vector3(
        station.coordinates.x,
        0.15,
        station.coordinates.z,
      );
      decal.rotation.x = Math.PI / 2;

      const material = new BABYLON.StandardMaterial(
        `station-material-${station.station}`,
        scene,
      );
      material.diffuseColor = BLUE;
      material.emissiveColor = new BABYLON.Color3(0.18, 0.35, 0.6);
      material.alpha = 0.9;
      material.zOffset = -2;
      decal.material = material;
    }

    this.createRouteConnections(scene);
  }

  static createRouteConnections(scene: BABYLON.Scene) {
    const routeMaterial = new BABYLON.StandardMaterial("fieldwork-route-material", scene);
    routeMaterial.diffuseColor = BLUE;
    routeMaterial.emissiveColor = BLUE;
    routeMaterial.alpha = 0.95;

    for (let i = 0; i < Stations.length - 1; i++) {
      const current = Stations[i];
      const next = Stations[i + 1];

      const start = new BABYLON.Vector3(current.coordinates.x, 0.2, current.coordinates.z);
      const end = new BABYLON.Vector3(next.coordinates.x, 0.2, next.coordinates.z);

      const dashedLine = BABYLON.MeshBuilder.CreateDashedLines(
        `route-${current.station}-${next.station}`,
        {
          points: [start, end],
          dashSize: 1.2,
          gapSize: 1,
          updatable: false,
        },
        scene,
      );
      dashedLine.material = routeMaterial;

      // no arrow in the middle of the circle; keep the route as a clean same-color dashed line
    }
  }
}
