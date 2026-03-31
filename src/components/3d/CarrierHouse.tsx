import React from "react";

export default function CarrierHouse({ position = [0, 0, 0], scale = 1 }: any) {
  return (
    <group position={position} scale={scale}>
      {/* flight deck */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[6, 0.4, 2.4]} />
        <meshStandardMaterial color="#455a64" />
      </mesh>
      {/* island */}
      <mesh position={[1.6, 1.1, 0.4]}>
        <boxGeometry args={[1.2, 1.0, 0.8]} />
        <meshStandardMaterial color="#607d8b" />
      </mesh>
      {/* hull */}
      <mesh position={[0, 0.0, 0]}>
        <boxGeometry args={[6.2, 0.6, 2.8]} />
        <meshStandardMaterial color="#37474f" />
      </mesh>
    </group>
  );
}
