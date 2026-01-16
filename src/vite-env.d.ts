/// <reference types="vite/client" />

// Asset imports - Vite resolves these to URLs
declare module '*.hdr' {
  const src: string;
  export default src;
}

declare module '*.exr' {
  const src: string;
  export default src;
}

declare module '*.obj' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.glb' {
  const src: string;
  export default src;
}

declare module '*.gltf' {
  const src: string;
  export default src;
}
