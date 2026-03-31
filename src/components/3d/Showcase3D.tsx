import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { MissileCarrier, BomberBase, BomberPlane as BomberPlaneModel, Missile as MissileModel, NuclearBomb } from '../../../model_';

export default function Showcase3D() {
  return (
    <div style={{ width: "100%", height: 480 }}>
      <Canvas camera={{ position: [0, 6, 10], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <gridHelper args={[40, 40, `#333`, `#111`]} />
        <group position={[-4, 0, 0]}>
          <MissileCarrier />
        </group>
        <group position={[4, 0, -2]} scale={[0.7, 0.7, 0.7]}>
          <BomberBase />
        </group>
        <group position={[0, 1.6, -6]} scale={0.9}>
          <BomberPlaneModel />
        </group>
        <group position={[2, 1, 2]}>
          <MissileModel />
        </group>
        <group position={[-2, 1, 2]}>
          <NuclearBomb />
        </group>
        <OrbitControls />
        <Environment preset="sunset" />
      </Canvas>
    </div>
  );
}
