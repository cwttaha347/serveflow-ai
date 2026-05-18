
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Points, PointMaterial } from '@react-three/drei';
import { isWebGLAvailable } from '../utils/webgl';
import ErrorBoundary from './ErrorBoundary';

const POINT_COUNT = 5000;
const SPHERE_RADIUS = 1.5;

/** Uniform points on a sphere — avoids maath inSphere NaN values. */
function createSpherePoints(count, radius) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = radius * Math.cbrt(Math.random());
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        const idx = i * 3;
        positions[idx] = Number.isFinite(x) ? x : 0;
        positions[idx + 1] = Number.isFinite(y) ? y : 0;
        positions[idx + 2] = Number.isFinite(z) ? z : 0;
    }
    return positions;
}

function CssFallback() {
    return (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-blob" />
            <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl animate-blob animation-delay-2000" />
            <div className="absolute bottom-1/4 left-1/3 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[100px] animate-blob animation-delay-4000" />
            <div
                className="absolute inset-0 opacity-30"
                style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, #ffa0e0 1px, transparent 0)',
                    backgroundSize: '40px 40px',
                }}
            />
        </div>
    );
}

function Stars({ paused }) {
    const ref = useRef();
    const sphere = useMemo(() => createSpherePoints(POINT_COUNT, SPHERE_RADIUS), []);

    useFrame((_, delta) => {
        if (paused || !ref.current) return;
        ref.current.rotation.x -= delta / 10;
        ref.current.rotation.y -= delta / 15;
    });

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={sphere} stride={3} frustumCulled={false}>
                <PointMaterial
                    transparent
                    color="#ffa0e0"
                    size={0.005}
                    sizeAttenuation
                    depthWrite={false}
                />
            </Points>
        </group>
    );
}

const Hero3D = () => {
    const webglSupported = useMemo(() => isWebGLAvailable(), []);
    const [webglLost, setWebglLost] = useState(false);
    const [tabHidden, setTabHidden] = useState(
        () => typeof document !== 'undefined' && document.hidden,
    );

    useEffect(() => {
        const onVisibility = () => setTabHidden(document.hidden);
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    const onGlCreated = useCallback((state) => {
        const canvas = state.gl.domElement;
        const onLost = (event) => {
            event.preventDefault();
            setWebglLost(true);
        };
        canvas.addEventListener('webglcontextlost', onLost, false);
    }, []);

    const useFallback = !webglSupported || webglLost;
    const pauseAnimation = tabHidden || webglLost;

    if (useFallback) {
        return <CssFallback />;
    }

    return (
        <div className="absolute inset-0 z-0">
            <ErrorBoundary fallback={<CssFallback />}>
                <Canvas
                    camera={{ position: [0, 0, 1] }}
                    dpr={[1, 1.5]}
                    frameloop={pauseAnimation ? 'never' : 'always'}
                    gl={{ powerPreference: 'low-power', antialias: false }}
                    onCreated={onGlCreated}
                >
                    <Stars paused={pauseAnimation} />
                </Canvas>
            </ErrorBoundary>
        </div>
    );
};

export default Hero3D;
