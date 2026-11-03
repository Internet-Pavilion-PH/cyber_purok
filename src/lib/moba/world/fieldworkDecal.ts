import * as BABYLON from "@babylonjs/core";
import fieldwork from "./fieldwork.json";

type Station = {
  station: string;
  coordinates: { x: number; y: number; z: number };
  highlights: string[];
};

const Stations: Station[] = fieldwork;

const StationCoordinates: Array<[number, number, number]> = Stations.map(
  ({ coordinates }) => [coordinates.x, coordinates.y, coordinates.z]
);

export class FieldworkDecal {
  static createGroundDecals(scene: BABYLON.Scene, ground: BABYLON.Mesh) {
    for (const station of Stations) {
      const decal = BABYLON.MeshBuilder.CreateDecal(
        `station-${station.station}`,
        ground,
        {
          position: new BABYLON.Vector3(
            station.coordinates.x,
            0,
            station.coordinates.z
          ),
          normal: new BABYLON.Vector3(0, 1, 0),
          size: new BABYLON.Vector3(8, 8, 8),
        }
      );

      const material = new BABYLON.StandardMaterial(
        `station-material-${station.station}`,
        scene
      );
      material.diffuseColor = new BABYLON.Color3(1, 0.25, 0.25);
      material.emissiveColor = new BABYLON.Color3(0.45, 0.1, 0.1);
      material.alpha = 0.9;
      material.zOffset = -2;
      decal.material = material;
    }
  }
}
