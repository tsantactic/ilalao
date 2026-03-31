import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";

export default function BomberPlane({ position = [0, 1.2, 0], rotation = [0, 0, 0], scale = 1 }: any) {
  const ref = useRef<any>();
  useFrame(() => {
    if (ref.current) ref.current.rotation.y += 0.002;
  });
  return (
    <group ref={ref} position={position} scale={scale} rotation={rotation}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.6, 0.2, 6]} />
        <meshStandardMaterial color="#8d6e63" />
      </mesh>
      <mesh position={[0, 0.25, -2.8]}>
        <coneGeometry args={[0.5, 1.2, 12]} />
        <meshStandardMaterial color="#6d4c41" />
      </mesh>
      <mesh position={[0.8, 0, -1.2]}>
        <boxGeometry args={[0.4, 0.1, 2.4]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
      <mesh position={[-0.8, 0, -1.2]}>
        <boxGeometry args={[0.4, 0.1, 2.4]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
    </group>
  );
}
