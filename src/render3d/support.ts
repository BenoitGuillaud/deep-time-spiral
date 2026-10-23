/** Names of WebGL renderers that draw in software, on the processor instead of a graphics chip. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render driver/i;

/**
 * True if this browser can draw WebGL. Kept free of three.js so the check costs nothing to load.
 *
 * Unless `allowSoftware` is set, WebGL drawn in software (no graphics chip, or a blocked driver)
 * counts as unavailable: there each 3D frame can take half a second, so the smooth 2D view is the
 * better experience.
 */
export function webglAvailable(allowSoftware = false): boolean {
  try {
    const canvas = document.createElement('canvas');
    const options: WebGLContextAttributes = { failIfMajorPerformanceCaveat: !allowSoftware };
    // three.js needs WebGL 2; asking only for it is also the cheaper check.
    const gl = canvas.getContext('webgl2', options);
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return allowSoftware || !SOFTWARE_RENDERER.test(renderer);
  } catch {
    return false;
  }
}
