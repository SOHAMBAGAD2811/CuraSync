"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
  RotateCcw,
  Eye,
  Maximize2,
  Sparkles,
  ChevronDown,
  Layers,
  Play,
  Pause,
} from "lucide-react";
import type { CompartmentNumber } from "@/lib/types/database";

interface Dispenser3DCanvasProps {
  pendingCompartment?: number | null;
  activeOpening?: number | null;
  onLidClick?: (compNum: CompartmentNumber) => void;
  className?: string;
  showControls?: boolean;
}

export function Dispenser3DCanvas({
  pendingCompartment = null,
  activeOpening = null,
  onLidClick,
  className = "",
  showControls = true,
}: Dispenser3DCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredComp, setHoveredComp] = useState<number | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [cameraView, setCameraView] = useState<"iso" | "top" | "front">("iso");
  const [openStates, setOpenStates] = useState<{ [key: number]: boolean }>({
    1: false,
    2: false,
    3: false,
  });

  const openStatesRef = useRef<{ [key: number]: boolean }>({
    1: false,
    2: false,
    3: false,
  });

  const pendingRef = useRef<number | null>(pendingCompartment);
  useEffect(() => {
    pendingRef.current = pendingCompartment;
  }, [pendingCompartment]);

  // Handle external trigger
  useEffect(() => {
    if (activeOpening) {
      openStatesRef.current[activeOpening] = true;
      setOpenStates((prev) => ({ ...prev, [activeOpening]: true }));
      const timer = setTimeout(() => {
        openStatesRef.current[activeOpening] = false;
        setOpenStates((prev) => ({ ...prev, [activeOpening]: false }));
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [activeOpening]);

  // Audio click synthesizer (gentle haptic tick)
  const playClickSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // Audio autoplay may be disabled by browser
    }
  }, []);

  const toggleCompartment = useCallback(
    (compNum: CompartmentNumber) => {
      playClickSound();
      const nextState = !openStatesRef.current[compNum];
      openStatesRef.current[compNum] = nextState;
      setOpenStates((prev) => ({ ...prev, [compNum]: nextState }));
      if (onLidClick) {
        onLidClick(compNum);
      }
    },
    [onLidClick, playClickSound]
  );

  // References for camera transitions
  const targetCamPos = useRef<{ x: number; y: number; z: number }>({
    x: 0,
    y: 3.5,
    z: 5.6,
  });

  const setViewAngle = (view: "iso" | "top" | "front") => {
    setCameraView(view);
    if (view === "iso") {
      targetCamPos.current = { x: 0, y: 3.5, z: 5.6 };
    } else if (view === "top") {
      targetCamPos.current = { x: 0, y: 6.2, z: 1.5 };
      // Also open lids in top view so user inspects pills!
      openStatesRef.current = { 1: true, 2: true, 3: true };
      setOpenStates({ 1: true, 2: true, 3: true });
    } else if (view === "front") {
      targetCamPos.current = { x: 0, y: 0.8, z: 5.8 };
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 360;

    // 1. Scene
    const scene = new THREE.Scene();

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    camera.position.set(0, 3.5, 5.6);
    camera.lookAt(0, 0, 0);

    // 3. Renderer (High performance, zero shadow maps)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // smooth without GPU throttle
    container.appendChild(renderer.domElement);

    // 4. Lighting (Optimized for clean medical look)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.8);
    hemiLight.position.set(0, 10, 0);
    scene.add(hemiLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.6);
    mainLight.position.set(5, 8, 6);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.6);
    fillLight.position.set(-6, 4, -3);
    scene.add(fillLight);

    // 5. Contact Shadow (Zero GPU cost baked radial shadow)
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sCtx = shadowCanvas.getContext("2d");
    if (sCtx) {
      const gradient = sCtx.createRadialGradient(128, 128, 30, 128, 128, 120);
      gradient.addColorStop(0, "rgba(15, 23, 42, 0.22)");
      gradient.addColorStop(0.5, "rgba(15, 23, 42, 0.08)");
      gradient.addColorStop(1, "rgba(15, 23, 42, 0)");
      sCtx.fillStyle = gradient;
      sCtx.fillRect(0, 0, 256, 256);
    }
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(8.5, 5.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.76;
    scene.add(shadowPlane);

    // 6. Dispenser 3D Group
    const dispenserGroup = new THREE.Group();
    scene.add(dispenserGroup);

    // Medical grade white chassis
    const bodyGeo = new THREE.BoxGeometry(5.4, 1.25, 3.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.02,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    dispenserGroup.add(body);

    // Base Accent Tray (CuraSync Teal/Sky rim)
    const baseGeo = new THREE.BoxGeometry(5.5, 0.16, 3.5);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.3,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.66;
    dispenserGroup.add(base);

    // Front LCD Screen Console (1602 LCD Display)
    const lcdBezelGeo = new THREE.BoxGeometry(2.7, 0.58, 0.05);
    const lcdBezelMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
    });
    const lcdBezel = new THREE.Mesh(lcdBezelGeo, lcdBezelMat);
    lcdBezel.position.set(0, -0.05, 1.71);
    dispenserGroup.add(lcdBezel);

    const lcdScreenGeo = new THREE.BoxGeometry(2.45, 0.42, 0.02);
    const lcdScreenMat = new THREE.MeshStandardMaterial({
      color: 0x064e3b,
      emissive: 0x10b981,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });
    const lcdScreen = new THREE.Mesh(lcdScreenGeo, lcdScreenMat);
    lcdScreen.position.set(0, -0.05, 1.74);
    dispenserGroup.add(lcdScreen);

    // 7. Compartments, Lids, LEDs & 3D Medicine Pills
    const compXPositions = [-1.65, 0, 1.65];
    const lidPivots: THREE.Group[] = [];
    const lidMeshes: THREE.Mesh[] = [];
    const ledMeshes: THREE.Mesh[] = [];

    const ledColors = [
      { color: 0xef4444, emissive: 0xef4444 }, // C1 Red
      { color: 0x10b981, emissive: 0x10b981 }, // C2 Green
      { color: 0xffffff, emissive: 0xffffff }, // C3 White
    ];

    compXPositions.forEach((xPos, idx) => {
      const compNum = idx + 1;
      const ledCfg = ledColors[idx];

      // Well recess
      const cavityGeo = new THREE.BoxGeometry(1.3, 0.8, 1.7);
      const cavityMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.6,
      });
      const cavity = new THREE.Mesh(cavityGeo, cavityMat);
      cavity.position.set(xPos, 0.35, 0.35);
      dispenserGroup.add(cavity);

      // Hinged Lid Pivot (Hinge along back edge z = -0.5)
      const pivot = new THREE.Group();
      pivot.position.set(xPos, 0.65, -0.5);
      dispenserGroup.add(pivot);

      // Lid Mesh
      const lidGeo = new THREE.BoxGeometry(1.35, 0.08, 1.8);
      const lidMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.25,
        transparent: true,
        opacity: 0.94,
      });
      const lid = new THREE.Mesh(lidGeo, lidMat);
      lid.position.set(0, 0, 0.9);
      (lid as any).userData = { compartment: compNum };
      pivot.add(lid);

      // Handle on lid front
      const handleGeo = new THREE.BoxGeometry(0.5, 0.05, 0.16);
      const handleMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.2,
      });
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.position.set(0, 0.05, 1.75);
      lid.add(handle);

      lidPivots.push(pivot);
      lidMeshes.push(lid);

      // LED Diode Sphere in front of compartment
      const ledGeo = new THREE.SphereGeometry(0.13, 16, 16);
      const ledMat = new THREE.MeshStandardMaterial({
        color: ledCfg.color,
        emissive: ledCfg.emissive,
        emissiveIntensity: 0.25,
        roughness: 0.1,
      });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(xPos, 0.65, 1.4);
      dispenserGroup.add(led);
      ledMeshes.push(led);

      // 3D Medicine Pills inside compartment!
      if (compNum === 1) {
        // C1: Red & White Capsules
        const capGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.45, 12);
        const capRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2 });
        const capWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
        const pill1 = new THREE.Mesh(capGeo, capRedMat);
        pill1.rotation.z = Math.PI / 3;
        pill1.rotation.x = 0.2;
        pill1.position.set(xPos - 0.15, 0.25, 0.3);
        dispenserGroup.add(pill1);

        const pill2 = new THREE.Mesh(capGeo, capWhiteMat);
        pill2.rotation.z = -Math.PI / 4;
        pill2.rotation.x = -0.15;
        pill2.position.set(xPos + 0.18, 0.25, 0.4);
        dispenserGroup.add(pill2);
      } else if (compNum === 2) {
        // C2: Round White Tablets
        const tabGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16);
        const tabMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        const tab1 = new THREE.Mesh(tabGeo, tabMat);
        tab1.position.set(xPos - 0.18, 0.22, 0.25);
        dispenserGroup.add(tab1);

        const tab2 = new THREE.Mesh(tabGeo, tabMat);
        tab2.position.set(xPos + 0.15, 0.22, 0.45);
        tab2.rotation.x = 0.3;
        dispenserGroup.add(tab2);
      } else {
        // C3: Golden Oval Caplets
        const ovalGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.5, 12);
        const ovalMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25 });
        const oval1 = new THREE.Mesh(ovalGeo, ovalMat);
        oval1.rotation.z = Math.PI / 2.3;
        oval1.position.set(xPos, 0.25, 0.35);
        dispenserGroup.add(oval1);
      }
    });

    // 8. Fluid Free 360° Drag & Smooth Damping
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let rotY = -0.2;
    let rotX = 0.25;
    let targetRotY = -0.2;
    let targetRotX = 0.25;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        prevX = e.clientX;
        prevY = e.clientY;

        targetRotY += dx * 0.009;
        targetRotX = Math.max(-0.25, Math.min(1.1, targetRotX + dy * 0.009));
      } else {
        // Hover raycasting
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(lidMeshes, false);
        if (hits.length > 0) {
          const comp = hits[0].object.userData?.compartment;
          setHoveredComp(comp || null);
          container.style.cursor = "pointer";
        } else {
          setHoveredComp(null);
          container.style.cursor = isDragging ? "grabbing" : "grab";
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!isDragging) return;
      isDragging = false;
      container.style.cursor = "grab";

      // Check click threshold
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(lidMeshes, false);
      if (hits.length > 0) {
        const comp = hits[0].object.userData?.compartment;
        if (comp) {
          toggleCompartment(comp as CompartmentNumber);
        }
      }
    };

    const canvas = renderer.domElement;
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Touch Support
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevX = e.touches[0].clientX;
        prevY = e.touches[0].clientY;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - prevX;
      const dy = e.touches[0].clientY - prevY;
      prevX = e.touches[0].clientX;
      prevY = e.touches[0].clientY;
      targetRotY += dx * 0.009;
      targetRotX = Math.max(-0.25, Math.min(1.1, targetRotX + dy * 0.009));
    };
    const onTouchEnd = () => {
      isDragging = false;
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    // Resize listener
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 9. 60 FPS Render Loop
    let animId: number;
    const startTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startTime) * 0.001;

      // Smooth camera interpolation for view presets
      camera.position.x += (targetCamPos.current.x - camera.position.x) * 0.08;
      camera.position.y += (targetCamPos.current.y - camera.position.y) * 0.08;
      camera.position.z += (targetCamPos.current.z - camera.position.z) * 0.08;
      camera.lookAt(0, 0, 0);

      // Auto rotation if active
      if (autoRotate && !isDragging) {
        targetRotY += 0.006;
      }

      // Smooth chassis rotation
      rotY += (targetRotY - rotY) * 0.12;
      rotX += (targetRotX - rotX) * 0.12;
      dispenserGroup.rotation.y = rotY;
      dispenserGroup.rotation.x = rotX;

      // Animate Lids opening / closing with spring feel
      lidPivots.forEach((pivot, idx) => {
        const compNum = idx + 1;
        const isOpen = openStatesRef.current[compNum];
        const targetAngle = isOpen ? -Math.PI * 0.44 : 0;
        pivot.rotation.x += (targetAngle - pivot.rotation.x) * 0.16;
      });

      // Animate LEDs
      ledMeshes.forEach((mesh, idx) => {
        const compNum = idx + 1;
        const isPending = pendingRef.current === compNum;
        const mat = mesh.material as THREE.MeshStandardMaterial;

        if (isPending) {
          const pulse = (Math.sin(elapsed * 7) + 1) / 2;
          mat.emissiveIntensity = 0.4 + pulse * 1.6;
        } else {
          mat.emissiveIntensity = 0.25;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
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
  }, [autoRotate, toggleCompartment]);

  return (
    <div className={`relative w-full h-[340px] sm:h-[390px] select-none ${className}`}>
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Interactive Controls Toolbar */}
      {showControls && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 p-1 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-sm text-xs">
          {/* Camera View Switcher */}
          <button
            onClick={() => setViewAngle("iso")}
            className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              cameraView === "iso"
                ? "bg-sky-50 text-sky-700 border border-sky-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Isometric 3D View"
          >
            3D View
          </button>
          <button
            onClick={() => setViewAngle("top")}
            className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              cameraView === "top"
                ? "bg-sky-50 text-sky-700 border border-sky-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Inspect Pills inside Compartments"
          >
            Top (Pills)
          </button>
          <button
            onClick={() => setViewAngle("front")}
            className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              cameraView === "front"
                ? "bg-sky-50 text-sky-700 border border-sky-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Front Panel LCD & LEDs"
          >
            Front
          </button>

          {/* Auto-Rotate Toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
              autoRotate
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
            title={autoRotate ? "Pause Auto-Rotation" : "Start Auto-Rotation"}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* Hover Tooltip when hovering over a lid */}
      {hoveredComp && (
        <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-xs font-bold text-white shadow-lg border border-white/20 animate-in fade-in zoom-in-95">
          👉 Click to {openStates[hoveredComp] ? "close" : "open"} Compartment {hoveredComp}
        </div>
      )}

      {/* Floating Bottom Quick Action Bar for Lids */}
      {showControls && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-md">
          <button
            onClick={() => toggleCompartment(1)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              openStates[1]
                ? "bg-red-500 text-white shadow-xs"
                : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block border border-white/50" />
            <span>C1 {openStates[1] ? "Open" : "Closed"}</span>
          </button>

          <button
            onClick={() => toggleCompartment(2)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              openStates[2]
                ? "bg-emerald-500 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block border border-white/50" />
            <span>C2 {openStates[2] ? "Open" : "Closed"}</span>
          </button>

          <button
            onClick={() => toggleCompartment(3)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              openStates[3]
                ? "bg-slate-700 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-white border border-slate-400 inline-block" />
            <span>C3 {openStates[3] ? "Open" : "Closed"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
