import React from 'react';
import { GroupProps } from '@react-three/fiber';

// Troop 3D Models

export const TroopSoldat = (props: GroupProps & { selected?: boolean }) => {
  const { selected, ...groupProps } = props;
  return (
    <group {...groupProps}>
      {/* Body */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.4, 0.6, 0.3]} />
        <meshStandardMaterial color={selected ? '#00ffff' : '#1976d2'} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#fdbcb4" />
      </mesh>

      {/* Weapon */}
      <mesh position={[0.2, 0.5, 0]}>
        <boxGeometry args={[0.1, 0.4, 0.05]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Selection highlight */}
      {selected && (
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshStandardMaterial color="cyan" wireframe transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
};

export const TroopSniper = (props: GroupProps & { selected?: boolean }) => {
  const { selected, ...groupProps } = props;
  return (
    <group {...groupProps}>
      {/* Body */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.35, 0.6, 0.3]} />
        <meshStandardMaterial color={selected ? '#00ffff' : '#0ea5e9'} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* Long rifle */}
      <mesh position={[0.25, 0.55, 0]}>
        <boxGeometry args={[0.6, 0.15, 0.08]} />
        <meshStandardMaterial color="#000" />
      </mesh>

      {/* Selection highlight */}
      {selected && (
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial color="cyan" wireframe transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
};

export const TroopTank = (props: GroupProps & { selected?: boolean }) => {
  const { selected, ...groupProps } = props;
  return (
    <group {...groupProps}>
      {/* Tracks */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[1.0, 0.3, 1.2]} />
        <meshStandardMaterial color="#3e2723" />
      </mesh>

      {/* Turret */}
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[0.6, 0.5, 0.8]} />
        <meshStandardMaterial color={selected ? '#00ffff' : '#33691e'} />
      </mesh>

      {/* Cannon */}
      <mesh position={[0.4, 0.7, 0]}>
        <boxGeometry args={[0.6, 0.2, 0.2]} />
        <meshStandardMaterial color="#1b5e20" />
      </mesh>

      {/* Selection highlight */}
      {selected && (
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshStandardMaterial color="cyan" wireframe transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
};

export const TroopDrone = (props: GroupProps & { selected?: boolean }) => {
  const { selected, ...groupProps } = props;
  return (
    <group {...groupProps}>
      {/* Body */}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={selected ? '#00ffff' : 'rgba(16,185,129,0.95)'} emissive="#10b981" />
      </mesh>

      {/* Propellers */}
      {[[-0.5, 0.4, -0.4], [0.5, 0.4, -0.4], [-0.5, 0.4, 0.4], [0.5, 0.4, 0.4]].map((pos, i) => (
        <mesh key={`propeller-${i}`} position={pos as any}>
          <boxGeometry args={[0.3, 0.05, 0.3]} />
          <meshStandardMaterial color="rgba(0,0,0,0.3)" />
        </mesh>
      ))}

      {/* Selection highlight */}
      {selected && (
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshStandardMaterial color="cyan" wireframe transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
};

export const TroopMissileCarrier = (props: GroupProps & { selected?: boolean }) => {
  const { selected, ...groupProps } = props;
  return (
    <group {...groupProps}>
      {/* Châssis principal */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[1.2, 0.5, 2]} />
        <meshStandardMaterial color={selected ? '#00ffff' : 'darkolivegreen'} />
      </mesh>

      {/* Rampe de lancement (inclinée) */}
      <mesh position={[0, 0.65, -0.25]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.6, 0.3, 1.8]} />
        <meshStandardMaterial color="gray" />
      </mesh>

      {/* Missile ready to fire */}
      <mesh position={[0, 0.85, -0.25]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 1.4, 16]} />
        <meshStandardMaterial color="darkred" />
      </mesh>

      {/* Wheels */}
      {[-0.7, 0.7].map((x) =>
        [-0.8, 0, 0.8].map((z) => (
          <mesh key={`wheel-${x}-${z}`} position={[x, 0.15, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.2, 0.2, 0.15, 16]} />
            <meshStandardMaterial color="black" />
          </mesh>
        ))
      )}

      {/* Selection highlight */}
      {selected && (
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[1.2, 16, 16]} />
          <meshStandardMaterial color="cyan" wireframe transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
};
