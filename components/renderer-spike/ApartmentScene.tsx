"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { FireSpikeState } from "@/lib/renderer-spike/types";
import { SmokeParticles } from "./SmokeParticles";

interface ApartmentSceneProps {
  state: FireSpikeState;
  debugColliders: boolean;
  activeTarget: string | null;
}

export const ApartmentScene: React.FC<ApartmentSceneProps> = ({ state, debugColliders, activeTarget }) => {
  const doorGroupRef = useRef<THREE.Group>(null);

  // Animate door rotation when doorOpen is toggled
  useFrame((_, delta) => {
    if (doorGroupRef.current) {
      const targetRotation = state.doorOpen ? -Math.PI / 2 : 0; // Rotate 90 deg open
      doorGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        doorGroupRef.current.rotation.y,
        targetRotation,
        delta * 6
      );
    }
  });

  const isTargeted = (id: string) => activeTarget === id;

  return (
    <>
      {/* Exponential Fog for smoke */}
      <fogExp2 attach="fog" args={["#111115", state.smokeDensity]} />

      {/* Ambient and Key Lighting */}
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[2, 2.7, 1]}
        intensity={0.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Hallway Point Light (Warm/Fire Light outside door) */}
      <pointLight
        position={[0, 1.6, -3.2]}
        intensity={state.hallwayLightIntensity * 1.5}
        color={state.doorOpen ? "#ff4500" : "#ffaa44"}
        distance={8}
      />

      {/* Static Colliders: Floor, Ceiling, Walls */}
      {/* Floor */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.1, 0]}>
        <mesh receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[6, 0.2, 5]} />
          <meshStandardMaterial color="#2d251e" roughness={0.7} />
        </mesh>
      </RigidBody>

      {/* Ceiling */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, 2.9, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[6, 0.2, 5]} />
          <meshStandardMaterial color="#1a1a20" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* Left Wall (X = -3.0) */}
      <RigidBody type="fixed" colliders="cuboid" position={[-3.1, 1.4, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.2, 2.8, 5]} />
          <meshStandardMaterial color="#333842" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Right Wall with Window Cutout (X = 3.0) */}
      <RigidBody type="fixed" colliders="cuboid" position={[3.1, 1.4, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.2, 2.8, 5]} />
          <meshStandardMaterial color="#333842" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Front Wall (Z = 2.5) */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, 1.4, 2.6]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[6, 2.8, 0.2]} />
          <meshStandardMaterial color="#2b303c" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Back Wall with Door Frame (Z = -2.5) */}
      <RigidBody type="fixed" colliders="cuboid" position={[-1.8, 1.4, -2.6]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2.4, 2.8, 0.2]} />
          <meshStandardMaterial color="#2b303c" roughness={0.8} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" position={[1.8, 1.4, -2.6]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2.4, 2.8, 0.2]} />
          <meshStandardMaterial color="#2b303c" roughness={0.8} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid" position={[0, 2.5, -2.6]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.2, 0.6, 0.2]} />
          <meshStandardMaterial color="#2b303c" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Hallway Volume outside door */}
      <mesh position={[0, 1.4, -4.0]}>
        <boxGeometry args={[4, 2.8, 3]} />
        <meshStandardMaterial color="#110500" side={THREE.BackSide} />
      </mesh>

      {/* Bedroom Door (Hinged at left post [-0.5, 0, -2.45]) */}
      <group position={[-0.5, 0, -2.45]} ref={doorGroupRef}>
        <RigidBody
          type={state.doorOpen ? "kinematicPosition" : "fixed"}
          colliders="cuboid"
          position={[0.5, 1.1, 0]}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.0, 2.2, 0.08]} />
            <meshStandardMaterial
              color={
                isTargeted("bedroom-door")
                  ? "#ffdd66"
                  : state.doorInspected
                  ? "#ff4422"
                  : "#664422"
              }
              emissive={
                state.doorInspected ? (state.doorOpen ? "#ff2200" : "#aa2200") : "#000000"
              }
              emissiveIntensity={state.doorInspected ? 0.6 : 0}
              roughness={0.5}
            />
          </mesh>
          {/* Door Handle */}
          <mesh position={[0.4, 0, 0.06]}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshStandardMaterial color="#cccccc" metalness={0.8} roughness={0.2} />
          </mesh>
        </RigidBody>
      </group>

      {/* Bed (Static Furniture) */}
      <RigidBody type="fixed" colliders="cuboid" position={[-1.8, 0.4, 0.5]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.8, 0.6, 2.0]} />
          <meshStandardMaterial color="#3a4b66" roughness={0.6} />
        </mesh>
        {/* Pillow */}
        <mesh position={[0, 0.35, -0.7]}>
          <boxGeometry args={[1.4, 0.15, 0.4]} />
          <meshStandardMaterial color="#eeeeee" />
        </mesh>
      </RigidBody>

      {/* Signal Cloth on Bed */}
      <mesh position={[-1.5, 0.72, 0.5]}>
        <boxGeometry args={[0.5, 0.02, 0.5]} />
        <meshStandardMaterial
          color={isTargeted("signal-cloth") ? "#ffff00" : "#ff0044"}
          emissive={isTargeted("signal-cloth") ? "#ffaa00" : "#000000"}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Nightstand (Static Furniture) */}
      <RigidBody type="fixed" colliders="cuboid" position={[-0.5, 0.35, 1.8]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.6, 0.7, 0.6]} />
          <meshStandardMaterial color="#4a3728" roughness={0.5} />
        </mesh>
      </RigidBody>

      {/* Emergency Phone on Nightstand */}
      <mesh position={[-0.5, 0.72, 1.8]}>
        <boxGeometry args={[0.12, 0.015, 0.22]} />
        <meshStandardMaterial
          color={isTargeted("phone") ? "#00ffff" : "#111111"}
          emissive={isTargeted("phone") ? "#00aaff" : "#112233"}
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* Flashlight on Nightstand */}
      <mesh position={[-0.3, 0.72, 1.8]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.25, 16]} />
        <meshStandardMaterial
          color={isTargeted("flashlight") ? "#ffff00" : "#ffffaa"}
          metalness={0.7}
        />
      </mesh>

      {/* Bedroom Window (Right Wall) */}
      <RigidBody type="fixed" colliders="cuboid" position={[2.95, 1.4, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.05, 1.2, 1.5]} />
          <meshStandardMaterial
            color={isTargeted("window") ? "#aaffff" : "#88ccff"}
            transparent
            opacity={0.6}
            roughness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* Smoke Alarm (Ceiling) */}
      <mesh position={[0, 2.75, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.06, 24]} />
        <meshStandardMaterial
          color={isTargeted("smoke-alarm") ? "#ffea00" : "#ffffff"}
          emissive="#ff0000"
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Smoke Under Door Cue Mesh (Floor) */}
      <mesh position={[0, 0.02, -2.3]}>
        <planeGeometry args={[1.1, 0.3]} />
        <meshBasicMaterial
          color={isTargeted("smoke-under-door") ? "#ffdd88" : "#888888"}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* Smoke Particles System */}
      <SmokeParticles density={state.smokeDensity} reducedMotion={state.reducedMotion} />
    </>
  );
};
