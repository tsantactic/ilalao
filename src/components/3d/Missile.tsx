import React from "react";

export default function Missile({ position = [0, 0, 0], scale = 1 }: any) {
  return (
    <mesh position={position} scale={scale}>
      <cylinderGeometry args={[0.08, 0.08, 1.6, 12]} />
      <meshStandardMaterial color="#ffd54f" />
    </mesh>
  );
}
