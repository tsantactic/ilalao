import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";

type Props = { position?: [number, number, number]; rotation?: [number, number, number]; scale?: number };

export default function MissileTruck({ position = [0, 0.5, 0], rotation = [0, 0, 0], scale = 1 }: Props) {
  const ref = useRef<any>();
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = rotation[1];
  });
  return (
    <group ref={ref} position={position as any} scale={scale}>
      {/* chassis */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[1.8, 0.5, 1]} />
        <meshStandardMaterial color="#2b6cb0" />
      </mesh>
      {/* cabin */}
      <mesh position={[-0.6, 0.55, 0]}>
        <boxGeometry args={[0.8, 0.6, 1]} />
        <meshStandardMaterial color="#1565c0" />
      </mesh>
      {/* missile container */}
      <mesh position={[0.7, 0.7, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 1.2, 12]} />
        <meshStandardMaterial color="#c62828" />
      </mesh>
      {/* wheels */}
      {[-0.8, 0.8].map((x, i) => (
        <mesh key={i} position={[x, 0.05, -0.55]}>
          <cylinderGeometry args={[0.16, 0.16, 0.3, 12]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      ))}
      {[-0.8, 0.8].map((x, i) => (
        <mesh key={"r" + i} position={[x, 0.05, 0.55]}>
          <cylinderGeometry args={[0.16, 0.16, 0.3, 12]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      ))}
    </group>
  );
}
