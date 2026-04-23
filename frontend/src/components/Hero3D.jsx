
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useState, useMemo } from 'react';
import { Points, PointMaterial } from '@react-three/drei';
import * as random from 'maath/random/dist/maath-random.esm';
import { isWebGLAvailable } from '../utils/webgl';
import ErrorBoundary from './ErrorBoundary';

function Stars(props) {
    const ref = useRef();
    const [sphere] = useState(() => {
        const raw = random.inSphere(new Float32Array(5000), { radius: 1.5 });
        for (let i = 0; i < raw.length; i += 1) {
            if (!Number.isFinite(raw[i])) raw[i] = 0;
        }
        return raw;
    });

    useFrame((state, delta) => {
        if (!ref.current) return;
        ref.current.rotation.x -= delta / 10;
        ref.current.rotation.y -= delta / 15;
    });

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={sphere} stride={3} frustumCulled={false} {...props}>
                <PointMaterial
                    transparent
                    color="#ffa0e0"
                    size={0.005}
                    sizeAttenuation={true}
                    depthWrite={false}
                />
            </Points>
        </group>
    );
}

const Hero3D = () => {
    const webglSupported = useMemo(() => isWebGLAvailable(), []);

    if (!webglSupported) {
        return (
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                {/* CSS Fallback Stars */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-blob"></div>
                <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-1/4 left-1/3 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[100px] animate-blob animation-delay-4000"></div>

                {/* Static Star-like particles using CSS */}
                <div className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage: 'radial-gradient(circle at 2px 2px, #ffa0e0 1px, transparent 0)',
                        backgroundSize: '40px 40px'
                    }}>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 z-0">
            <ErrorBoundary fallback={
                <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                    {/* Minimal fallback if Three.js crashes during runtime */}
                </div>
            }>
                <Canvas camera={{ position: [0, 0, 1] }} gl={{ powerPreference: "low-power", antialias: false }}>
                    <Stars />
                </Canvas>
            </ErrorBoundary>
        </div>
    )
}

export default Hero3D;
