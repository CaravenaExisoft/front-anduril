import * as THREE from "three";

const COMPONENT_TYPE_ARRAYS = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};
const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

// Parser mínimo de GLB: separa el contenedor binario en el chunk JSON (la
// escena/accessors/bufferViews) y el chunk BIN (los datos crudos). No usamos
// GLTFLoader para evitar su dependencia de blob: URLs para las texturas.
function parseGlb(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = dv.getUint32(8, true);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < length) {
    const chunkLength = dv.getUint32(offset, true);
    const chunkType = dv.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (chunkType === 0x4e4f534a) {
      // 'JSON'
      json = JSON.parse(new TextDecoder("utf-8").decode(bytes.subarray(chunkStart, chunkStart + chunkLength)));
    } else if (chunkType === 0x004e4942) {
      // 'BIN\0'
      bin = bytes.subarray(chunkStart, chunkStart + chunkLength);
    }
    offset = chunkStart + chunkLength;
  }
  return { json, bin };
}

function readAccessor(gltf, bin, accessorIndex) {
  const accessor = gltf.accessors[accessorIndex];
  const bufferView = gltf.bufferViews[accessor.bufferView];
  const ArrayType = COMPONENT_TYPE_ARRAYS[accessor.componentType];
  const numComponents = TYPE_COMPONENTS[accessor.type];
  const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  const count = accessor.count * numComponents;
  // slice() (no subarray) copia a un ArrayBuffer propio desde el byte 0, así
  // el TypedArray queda bien alineado sin importar el offset original.
  const slice = bin.slice(byteOffset, byteOffset + count * ArrayType.BYTES_PER_ELEMENT);
  return new ArrayType(slice.buffer);
}

function uint8ArrayToBase64(bytes) {
  const CHUNK = 0x8000;
  const parts = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(""));
}

function imageDataUri(gltf, bin, imageIndex) {
  const image = gltf.images[imageIndex];
  const bufferView = gltf.bufferViews[image.bufferView];
  const bytes = bin.subarray(bufferView.byteOffset || 0, (bufferView.byteOffset || 0) + bufferView.byteLength);
  const mimeType = image.mimeType || "image/png";
  return `data:${mimeType};base64,${uint8ArrayToBase64(bytes)}`;
}

function loadGltfTexture(gltf, bin, textureIndex, onReady) {
  const textureDef = gltf.textures[textureIndex];
  const dataUri = imageDataUri(gltf, bin, textureDef.source);
  const img = new Image();
  img.onload = () => {
    const texture = new THREE.Texture(img);
    // glTF define el origen UV arriba-a-la-izquierda; Three.js asume
    // abajo-a-la-izquierda (heredado de OpenGL) salvo que se desactive
    // flipY — GLTFLoader siempre lo hace, y al armar la Texture a mano hay
    // que replicarlo o la textura queda muestreada al revés.
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    onReady(texture);
  };
  img.src = dataUri;
}

function buildTemplate(gltf, bin) {
  const primitive = gltf.meshes[0].primitives[0];
  const attrs = primitive.attributes;
  const indices = readAccessor(gltf, bin, primitive.indices);
  const positions = readAccessor(gltf, bin, attrs.POSITION);
  const uvs = attrs.TEXCOORD_0 !== undefined ? readAccessor(gltf, bin, attrs.TEXCOORD_0) : null;

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (uvs) geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const materialDef = (gltf.materials && gltf.materials[primitive.material]) || {};
  const pbr = materialDef.pbrMetallicRoughness || {};
  // Sin metallicRoughnessTexture propio, el factor del glTF exportado es un
  // default del exportador (metal totalmente rugoso = mate), no una
  // elección real — un valor fijo más brilloso se ve mejor.
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.65,
    roughness: 0.2,
    side: materialDef.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });

  if (pbr.baseColorTexture) {
    loadGltfTexture(gltf, bin, pbr.baseColorTexture.index, (texture) => {
      material.map = texture;
      material.needsUpdate = true;
    });
  }

  const box = geometry.boundingBox;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.sub(center);

  const wrapper = new THREE.Group();
  wrapper.add(mesh);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  wrapper.scale.setScalar(2.7 / maxDim);
  wrapper.userData.material = material;

  return wrapper;
}

// Genera un environment map liviano (sin HDR externo) para que el material
// metálico tenga algo que reflejar — sin esto se ve negro salvo en los
// brillos puntuales.
function createEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  const skyGeo = new THREE.SphereGeometry(50, 24, 24);
  const pos = skyGeo.attributes.position;
  const colorTop = new THREE.Color(0x4a6b8a);
  const colorBottom = new THREE.Color(0x03060c);
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) + 50) / 100, 0, 1);
    const c = colorBottom.clone().lerp(colorTop, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  skyGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  envScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

  const keySpot = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  keySpot.position.set(18, 22, 18);
  envScene.add(keySpot);

  const cyanSpot = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
  cyanSpot.position.set(-22, 4, 10);
  envScene.add(cyanSpot);

  const rt = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return rt.texture;
}

// Singleton compartido entre todas las instancias montadas: el GLB se
// parsea y el environment map se genera una sola vez para toda la sesión,
// sin importar cuántos <AnduriHead /> haya en pantalla.
let templatePromise = null;
let sharedEnvTexture = null;

function getTemplate(glbUrl) {
  if (!templatePromise) {
    templatePromise = fetch(glbUrl)
      .then((res) => res.arrayBuffer())
      .then((buf) => {
        const { json, bin } = parseGlb(new Uint8Array(buf));
        return buildTemplate(json, bin);
      });
  }
  return templatePromise;
}

const reduceMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let sharedMouseX = 0;
let sharedMouseY = 0;
if (typeof window !== "undefined") {
  window.addEventListener("mousemove", (e) => {
    sharedMouseX = e.clientX / window.innerWidth - 0.5;
    sharedMouseY = e.clientY / window.innerHeight - 0.5;
  });
}

// Monta el modelo animado dentro de `container` (debe tener un tamaño ya
// definido por CSS). Devuelve una función de limpieza para desmontar.
export function mountAnduriHead(container, glbUrl) {
  let disposed = false;
  let rafId = null;
  let renderer = null;

  getTemplate(glbUrl).then((template) => {
    if (disposed) return;

    const width = container.clientWidth || 40;
    const height = container.clientHeight || 40;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    if (!sharedEnvTexture) sharedEnvTexture = createEnvironment(renderer);
    scene.environment = sharedEnvTexture;
    const material = template.userData.material;
    if (material && !material.envMap) {
      material.envMap = sharedEnvTexture;
      material.envMapIntensity = 1.1;
      material.needsUpdate = true;
    }

    scene.add(new THREE.HemisphereLight(0xd6ecff, 0x0a0f16, 0.7));
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const keyLight = new THREE.PointLight(0xffffff, 1.2, 14);
    keyLight.position.set(0.6, 1.4, 4.5);
    scene.add(keyLight);

    const cyanRim = new THREE.PointLight(0x00e5ff, 0.9, 12);
    cyanRim.position.set(-2.2, 0.4, 1.5);
    scene.add(cyanRim);

    const avatarGroup = new THREE.Group();
    avatarGroup.add(template.clone());
    scene.add(avatarGroup);

    function renderFrame(t) {
      avatarGroup.position.y = Math.sin(t * 0.5) * 0.06;
      // Sesgo de reposo + deriva lenta: de frente se pierde el volumen de
      // la cara; un giro leve constante la deja siempre en 3/4, y sigue
      // reaccionando al mouse encima de eso.
      const targetY = Math.sin(t * 0.2) * 0.12 + sharedMouseX * 0.4;
      const targetX = -0.02 + Math.sin(t * 0.17) * 0.05 + sharedMouseY * 0.2;
      const ease = reduceMotion ? 1 : 0.05;
      avatarGroup.rotation.y += (targetY - avatarGroup.rotation.y) * ease;
      avatarGroup.rotation.x += (targetX - avatarGroup.rotation.x) * ease;
      renderer.render(scene, camera);
    }

    renderFrame(reduceMotion ? 1.4 : 0);

    function loop(ts) {
      if (disposed) return;
      renderFrame(ts * 0.001);
      rafId = requestAnimationFrame(loop);
    }
    if (!reduceMotion) rafId = requestAnimationFrame(loop);
  });

  return function cleanup() {
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}
