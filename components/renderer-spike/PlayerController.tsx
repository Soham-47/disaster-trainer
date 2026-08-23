"use client";

import React, { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { RigidBody, CapsuleCollider, RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { FireSpikeState, SpikeAction } from "@/lib/renderer-spike/types";
import { getTargetInteractiveObject, INTERACTIVE_OBJECTS } from "@/lib/renderer-spike/interactive-objects";

interface PlayerControllerProps {
  state: FireSpikeState;
  dispatch: React.Dispatch<SpikeAction>;
  onTargetChange: (target: string | null) => void;
  pointerLocked: boolean;
  setPointerLocked: (locked: boolean) => void;
}

export const PlayerController: React.FC<PlayerControllerProps> = ({
  state,
  dispatch,
  onTargetChange,
  pointerLocked,
  setPointerLocked,
}) => {
  const { camera, gl } = useThree();
  const rigidBodyRef = useRef<RapierRigidBody>(null);

  // Local movement state
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const yawRef = useRef(state.playerYaw);
  const pitchRef = useRef(state.playerPitch);
  const targetRef = useRef<string | null>(null);

  // Sync external state updates (e.g. checkpoint restore) to local physics body
  useEffect(() => {
    if (rigidBodyRef.current) {
      rigidBodyRef.current.setTranslation(
        {
          x: state.playerPosition[0],
          y: state.playerPosition[1] - (state.crouched ? 0.5 : 0.8),
          z: state.playerPosition[2],
        },
        true
      );
    }
    yawRef.current = state.playerYaw;
    pitchRef.current = state.playerPitch;
  }, [state.checkpoint, state.playerPosition, state.crouched]);

  // Pointer lock & keyboard listeners
  useEffect(() => {
    const canvasEl = gl.domElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;

      if (e.code === "ControlLeft" || e.code === "ControlRight") {
        dispatch({ type: "TOGGLE_CROUCH" });
      }

      if (e.code === "KeyE") {
        // Trigger interaction on target
        if (targetRef.current) {
          const obj = INTERACTIVE_OBJECTS[targetRef.current as keyof typeof INTERACTIVE_OBJECTS];
          if (obj) {
            // Check if hot door decisions apply
            if (obj.id === "bedroom-door" && state.doorInspected && !state.doorOpen) {
              dispatch({ type: "EXECUTE_INTERACTION", objectId: obj.id, interaction: "open-door" });
            } else {
              dispatch({ type: "EXECUTE_INTERACTION", objectId: obj.id, interaction: obj.interaction });
            }
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    const handleBlur = () => {
      keysPressed.current = {};
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        keysPressed.current = {};
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvasEl) {
        const sensitivity = 0.0022;
        yawRef.current -= e.movementX * sensitivity;
        pitchRef.current -= e.movementY * sensitivity;

        // Clamp pitch to [-85 deg, 85 deg]
        const maxPitch = (85 * Math.PI) / 180;
        pitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, pitchRef.current));
      }
    };

    const handlePointerLockChange = () => {
      const isLocked = document.pointerLockElement === canvasEl;
      setPointerLocked(isLocked);
      if (!isLocked) {
        keysPressed.current = {};
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, [gl, dispatch, state.doorInspected, state.doorOpen, setPointerLocked]);

  // Main per-frame physics & camera update loop
  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;

    // Arrow keys fallback for camera look
    const lookSpeed = 1.5 * delta;
    if (keysPressed.current["ArrowLeft"]) yawRef.current += lookSpeed;
    if (keysPressed.current["ArrowRight"]) yawRef.current -= lookSpeed;
    if (keysPressed.current["ArrowUp"]) pitchRef.current += lookSpeed;
    if (keysPressed.current["ArrowDown"]) pitchRef.current -= lookSpeed;

    const maxPitch = (85 * Math.PI) / 180;
    pitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, pitchRef.current));

    // Calculate movement direction relative to camera yaw
    const moveSpeed = state.crouched ? 1.2 : 2.3; // 1.2 m/s crouched, 2.3 m/s walking
    let moveX = 0;
    let moveZ = 0;

    if (keysPressed.current["KeyW"]) moveZ -= 1;
    if (keysPressed.current["KeyS"]) moveZ += 1;
    if (keysPressed.current["KeyA"]) moveX -= 1;
    if (keysPressed.current["KeyD"]) moveX += 1;

    // Normalize movement vector
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) {
      moveX /= len;
      moveZ /= len;
    }

    // Transform by camera yaw
    const forwardX = -Math.sin(yawRef.current);
    const forwardZ = -Math.cos(yawRef.current);
    const rightX = Math.cos(yawRef.current);
    const rightZ = -Math.sin(yawRef.current);

    const worldVx = (forwardX * moveZ + rightX * moveX) * moveSpeed;
    const worldVz = (forwardZ * moveZ + rightZ * moveX) * moveSpeed;

    // Current position
    const curPos = rigidBodyRef.current.translation();
    const targetX = Math.max(-2.8, Math.min(2.8, curPos.x + worldVx * delta));
    const targetZ = Math.max(-2.3, Math.min(2.3, curPos.z + worldVz * delta));
    const eyeHeight = state.crouched ? 1.05 : 1.7;

    // Set kinematic translation
    rigidBodyRef.current.setNextKinematicTranslation({
      x: targetX,
      y: eyeHeight - (state.crouched ? 0.5 : 0.8),
      z: targetZ,
    });

    // Update camera transform locally
    camera.position.set(targetX, eyeHeight, targetZ);
    camera.rotation.set(0, 0, 0);
    camera.rotation.order = "YXZ";
    camera.rotation.y = yawRef.current;
    camera.rotation.x = pitchRef.current;

    // Raycast center reticle target
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);

    const currentPosTuple: [number, number, number] = [targetX, eyeHeight, targetZ];
    const cameraDirTuple: [number, number, number] = [cameraDir.x, cameraDir.y, cameraDir.z];

    const targetObj = getTargetInteractiveObject(currentPosTuple, cameraDirTuple);
    const targetId = targetObj ? targetObj.id : null;

    if (targetRef.current !== targetId) {
      targetRef.current = targetId;
      onTargetChange(targetId);
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[state.playerPosition[0], state.playerPosition[1] - 0.8, state.playerPosition[2]]}
    >
      <CapsuleCollider args={[state.crouched ? 0.35 : 0.6, 0.3]} />
    </RigidBody>
  );
};
