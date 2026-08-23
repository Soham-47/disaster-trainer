"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface SmokeParticlesProps {
  density: number;
  reducedMotion: boolean;
}

export const SmokeParticles: React.FC<SmokeParticlesProps> = ({ density, reducedMotion }) => {
  const particleCount = useMemo(() => Math.min(250, Math.floor(density * 500) + 40), [density]);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Initialize particle offsets
  const particles = useMemo(() => {
    const data = [];
    for (let i = 0; i < 300; i++) {
      data.push({
        x: (Math.random() - 0.5) * 5.5,
        y: 1.2 + Math.random() * 1.5,
        z: (Math.random() - 0.5) * 4.5,
        scale: 0.3 + Math.random() * 0.4,
        speedX: (Math.random() - 0.5) * 0.15,
        speedY: 0.05 + Math.random() * 0.1,
        speedZ: (Math.random() - 0.5) * 0.15,
        rotSpeed: (Math.random() - 0.5) * 0.5,
        rotation: Math.random() * Math.PI * 2,
      });
    }
    return data;
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    for (let i = 0; i < particleCount; i++) {
      const p = particles[i];

      if (!reducedMotion) {
        p.y += p.speedY * delta;
        p.x += Math.sin(p.y * 2) * p.speedX * delta;
        p.rotation += p.rotSpeed * delta;

        // Wrap around room ceiling
        if (p.y > 2.7) {
          p.y = 1.0;
          p.x = (Math.random() - 0.5) * 5.5;
        }
      }

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.z = p.rotation;
      dummy.scale.set(p.scale, p.scale, p.scale);
      dummy.updateMatrix();

      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 300]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial
        color="#777777"
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </instancedMesh>
  );
};
