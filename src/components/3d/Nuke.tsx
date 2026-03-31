import React from "react";

export default function Nuke({ position = [0, 0, 0], scale = 1 }: any) {
  return (
    <group position={position} scale={scale}>
      <mesh>
        <sphereGeometry args={[0.7, 16, 12]} />
        <meshStandardMaterial color="#ff7043" emissive="#ff8a65" />
      </mesh>
      <mesh position={[0, -0.9, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.2, 12]} />
        <meshStandardMaterial color="#6d4c41" />
      </mesh>
    </group>
  );
}
