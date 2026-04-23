/**
 * Check if WebGL is available in the current browser environment.
 * @returns {boolean} True if WebGL 1 or 2 is available.
 */
export const isWebGLAvailable = () => {
    try {
        const canvas = document.createElement('canvas');
        return !!(
            window.WebGLRenderingContext &&
            (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
        );
    } catch {
        return false;
    }
};

/**
 * Check if WebGL 2 is available.
 * @returns {boolean} True if WebGL 2 is available.
 */
export const isWebGL2Available = () => {
    try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
    } catch {
        return false;
    }
};
