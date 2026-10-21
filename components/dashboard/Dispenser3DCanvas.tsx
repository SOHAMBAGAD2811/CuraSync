"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { CompartmentNumber } from "@/lib/types/database";

interface Dispenser3DCanvasProps {
  pendingCompartment?: number | null;
  activeOpening?: number | null;
  onLidClick?: (compNum: CompartmentNumber) => void;
  className?: string;
}

export function Dispenser3DCanvas({
  pendingCompartment = null,
  activeOpening = null,
  onLidClick,
  className = "",
}: Dispenser3DCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hintVisible, setHintVisible] = useState(true);

  // Keep track of open lid states: 1, 2, 3
  const openStatesRef = useRef<{ [key: number]: boolean }>({
    1: false,
    2: false,
    3: false,
  });

  // Track pending compartment for LED pulsing
  const pendingRef = useRef<number | null>(pendingCompartment);
  useEffect(() => {
    pendingRef.current = pendingCompartment;
  }, [pendingCompartment]);

  // Handle external lid opening trigger
  useEffect(() => {
    if (activeOpening) {
      openStatesRef.current[activeOpening] = true;
      const timer = setTimeout(() => {
        openStatesRef.current[activeOpening] = false;
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [activeOpening]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 340;

    // 1. Scene
    const scene = new THREE.Scene();

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 3.8, 5.8);
    camera.lookAt(0, 0, 0);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(4, 7, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const softFill = new THREE.DirectionalLight(0xe0f2fe, 0.8);
    softFill.position.set(-4, 3, -3);
    scene.add(softFill);

    // 5. Ground Shadow Plane
    const shadowPlaneGeo = new THREE.PlaneGeometry(12, 12);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.12 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.76;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // 6. Dispenser Main Group
    const dispenserGroup = new THREE.Group();
    scene.add(dispenserGroup);

    // Main Chassis: Medical grade matte white rounded look
    const bodyGeo = new THREE.BoxGeometry(5.4, 1.2, 3.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.04,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    dispenserGroup.add(body);

    // Base Accent Tray (Soft Medical Cyan/Teal border)
    const baseGeo = new THREE.BoxGeometry(5.5, 0.18, 3.5);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.3,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.65;
    base.castShadow = true;
    dispenserGroup.add(base);

    // Front LCD Screen Console (1602 LCD Display)
    const lcdBezelGeo = new THREE.BoxGeometry(2.6, 0.55, 0.05);
    const lcdBezelMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
    });
    const lcdBezel = new THREE.Mesh(lcdBezelGeo, lcdBezelMat);
    lcdBezel.position.set(0, -0.08, 1.71);
    dispenserGroup.add(lcdBezel);

    const lcdScreenGeo = new THREE.BoxGeometry(2.35, 0.4, 0.02);
    const lcdScreenMat = new THREE.MeshStandardMaterial({
      color: 0x064e3b,
      emissive: 0x10b981,
      emissiveIntensity: 0.45,
      roughness: 0.2,
    });
    const lcdScreen = new THREE.Mesh(lcdScreenGeo, lcdScreenMat);
    lcdScreen.position.set(0, -0.08, 1.74);
    dispenserGroup.add(lcdScreen);

    // 7. 3 Compartments with Lids & LEDs
    const compXPositions = [-1.65, 0, 1.65];
    const lidPivots: THREE.Group[] = [];
    const ledMeshes: THREE.Mesh[] = [];
    const ledLights: THREE.PointLight[] = [];

    // Hardware config: C1 Red, C2 Green, C3 White
    const ledConfigs = [
      { color: 0xef4444, emissive: 0xef4444, lightColor: 0xff2222 },
      { color: 0x10b981, emissive: 0x10b981, lightColor: 0x10b981 },
      { color: 0xffffff, emissive: 0xffffff, lightColor: 0xffffff },
    ];

    compXPositions.forEach((xPos, idx) => {
      const compNum = idx + 1;
      const cfg = ledConfigs[idx];

      // Well recess border / well top
      const wellBorderGeo = new THREE.BoxGeometry(1.35, 0.06, 1.85);
      const wellBorderMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.4,
      });
      const wellBorder = new THREE.Mesh(wellBorderGeo, wellBorderMat);
      wellBorder.position.set(xPos, 0.61, 0.35);
      dispenserGroup.add(wellBorder);

      // Compartment interior cavity
      const cavityGeo = new THREE.BoxGeometry(1.2, 0.7, 1.7);
      const cavityMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.6,
      });
      const cavity = new THREE.Mesh(cavityGeo, cavityMat);
      cavity.position.set(xPos, 0.3, 0.35);
      dispenserGroup.add(cavity);

      // Hinged Lid Pivot Group (Hinge along back edge at z = -0.5)
      const pivot = new THREE.Group();
      pivot.position.set(xPos, 0.64, -0.5);
      dispenserGroup.add(pivot);

      // Actual Lid geometry offset from pivot
      const lidGeo = new THREE.BoxGeometry(1.3, 0.08, 1.8);
      const lidMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.05,
        transparent: true,
        opacity: 0.95,
      });
      const lid = new THREE.Mesh(lidGeo, lidMat);
      lid.position.set(0, 0, 0.9); // Center lid forward from hinge
      lid.castShadow = true;
      (lid as any).userData = { compartment: compNum };
      pivot.add(lid);

      // Small handle / lip on front edge of lid
      const lipGeo = new THREE.BoxGeometry(0.5, 0.04, 0.15);
      const lipMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.3,
      });
      const lip = new THREE.Mesh(lipGeo, lipMat);
      lip.position.set(0, 0.05, 1.75);
      lid.add(lip);

      lidPivots.push(pivot);

      // Physical LED Diode Sphere in front of each compartment
      const ledGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const ledMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        emissive: cfg.emissive,
        emissiveIntensity: 0.3,
        roughness: 0.1,
      });
      const ledMesh = new THREE.Mesh(ledGeo, ledMat);
      ledMesh.position.set(xPos, 0.64, 1.4);
      dispenserGroup.add(ledMesh);
      ledMeshes.push(ledMesh);

      // Point Light to illuminate the chassis & lid
      const pLight = new THREE.PointLight(cfg.lightColor, 0.4, 2.5);
      pLight.position.set(xPos, 0.8, 1.4);
      dispenserGroup.add(pLight);
      ledLights.push(pLight);
    });

    // 8. Interaction: Raycasting & Rotation Controls
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotationY = -0.15;
    let targetRotationX = 0.2;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      setHintVisible(false);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      targetRotationY += deltaX * 0.008;
      targetRotationX = Math.max(-0.1, Math.min(0.6, targetRotationX + deltaY * 0.008));
    };

    const onMouseUp = (e: MouseEvent) => {
      isDragging = false;

      // Click detection for lids
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        const comp = hit.object.userData?.compartment;
        if (comp) {
          openStatesRef.current[comp] = !openStatesRef.current[comp];
          if (onLidClick) onLidClick(comp as CompartmentNumber);
          break;
        }
      }
    };

    const canvas = renderer.domElement;
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Touch support for mobile devices
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
        setHintVisible(false);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - prevMouseX;
      const deltaY = e.touches[0].clientY - prevMouseY;
      prevMouseX = e.touches[0].clientX;
      prevMouseY = e.touches[0].clientY;
      targetRotationY += deltaX * 0.008;
      targetRotationX = Math.max(-0.1, Math.min(0.6, targetRotationX + deltaY * 0.008));
    };
    const onTouchEnd = () => {
      isDragging = false;
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    // 9. Resize Handling
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 10. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth chassis rotation interpolation
      dispenserGroup.rotation.y += (targetRotationY - dispenserGroup.rotation.y) * 0.08;
      dispenserGroup.rotation.x += (targetRotationX - dispenserGroup.rotation.x) * 0.08;

      // Animate Lids opening / closing (-75 degrees on X-axis)
      lidPivots.forEach((pivot, idx) => {
        const compNum = idx + 1;
        const isOpen = openStatesRef.current[compNum];
        const targetAngle = isOpen ? -Math.PI * 0.42 : 0;
        pivot.rotation.x += (targetAngle - pivot.rotation.x) * 0.12;
      });

      // Animate LED Pulses according to hardware state
      ledMeshes.forEach((mesh, idx) => {
        const compNum = idx + 1;
        const isPending = pendingRef.current === compNum;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const pLight = ledLights[idx];

        if (isPending) {
          // Pulsing emissive glow
          const pulse = (Math.sin(elapsedTime * 6) + 1) / 2; // 0 to 1
          mat.emissiveIntensity = 0.5 + pulse * 1.5;
          pLight.intensity = 0.8 + pulse * 2.2;
        } else {
          // Idle low glow
          mat.emissiveIntensity = 0.25;
          pLight.intensity = 0.25;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [onLidClick]);

  return (
    <div className={`relative w-full h-[320px] sm:h-[360px] select-none ${className}`}>
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Interaction Hint Badge */}
      {hintVisible && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900/75 backdrop-blur-md text-[11px] font-medium text-white shadow-md border border-white/20 transition-opacity">
          🖱️ Drag to rotate 3D Dispenser &bull; Click lids to open
        </div>
      )}
    </div>
  );
}
