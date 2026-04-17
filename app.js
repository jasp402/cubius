import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    gridSize: 8,
    floorSize: 30,
    cubeSize: 0.96,
    gridUnit: 1,
    maxLevels: 5,
    snapDuration: 450,
    bounceHeight: 1.5,
    colors: {
        palette: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6', '#FF8C42'],
        levels: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6', '#FF8C42'],
        ghost: '#ffffff',
        placeholder: '#ffffff',
        groundBlocked: 0x161628,
        groundAllowed: 0x23264a,
        gridBlockedMain: 0x303457,
        gridBlockedSub: 0x222640,
        gridAllowedMain: 0x7588ff,
        gridAllowedSub: 0x4d5eb8,
        background: 0x0f0e17,
    }
};

// ============================================
// FIGURES DATA
// ============================================
const FIGURES = {
    stairs: {
        name: 'Escalera',
        positions: [
            { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
            { x: 2, y: 1, z: 0 }, { x: 2, y: 1, z: 1 },
            { x: 2, y: 2, z: 1 }
        ],
        blockColors: ['#FF6B6B', '#FF8C42', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6']
    },
    lshape: {
        name: 'Letra L',
        positions: [
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            { x: 0, y: 2, z: 0 },
            { x: 1, y: 2, z: 0 }
        ],
        blockColors: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF']
    },
    cross: {
        name: 'Cruz',
        positions: [
                        { x: 1, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 1 },
                        { x: 1, y: 0, z: 2 }
        ],
        blockColors: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6']
    },
    tower: {
        name: 'Torre',
        positions: [
            { x: 1, y: 0, z: 1 },
            { x: 1, y: 1, z: 1 },
            { x: 1, y: 2, z: 1 },
            { x: 0, y: 2, z: 1 }, { x: 2, y: 2, z: 1 },
            { x: 1, y: 3, z: 1 }
        ],
        blockColors: ['#4D96FF', '#6BCB77', '#FFD93D', '#FF6B6B', '#FF8C42', '#9B59B6']
    },
    cube2x2: {
        name: 'Cubo 2x2x2',
        positions: [
            { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 },
            { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 },
            { x: 0, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }
        ],
        blockColors: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9B59B6', '#FF8C42', '#FF6B6B', '#FFD93D']
    },
    pyramid: {
        name: 'Piramide',
        positions: [
            // Base 3x3
            { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 1 },
            { x: 0, y: 0, z: 2 }, { x: 1, y: 0, z: 2 }, { x: 2, y: 0, z: 2 },
            // Level 1 (centered offset)
            { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 },
            { x: 0, y: 1, z: 1 }, { x: 1, y: 1, z: 1 },
            // Top
            { x: 0, y: 2, z: 0 }
        ],
        blockColors: [
            '#FF6B6B', '#FF6B6B', '#FF6B6B',
            '#FFD93D', '#FFD93D', '#FFD93D',
            '#6BCB77', '#6BCB77', '#6BCB77',
            '#4D96FF', '#4D96FF',
            '#9B59B6', '#9B59B6',
            '#FF8C42'
        ]
    }
};

// ============================================
// APPLICATION STATE
// ============================================
const state = {
    mode: 1,
    selectedColor: CONFIG.colors.palette[0],

    // Cubes shared between modes
    cubes: [],

    // Ghost / preview cube
    ghostCube: null,
    ghostGridPos: null,

    // Mode 2
    currentFigure: 'stairs',
    figureTargets: [],
    trayBlocks: [],
    isDragging: false,
    dragColor: null,
    dragBlockIndex: -1,

    // Mode 3
    countView: 'all',
    originalColors: new Map(),

    // Animation
    tweens: [],

    // Raycaster
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
};

// ============================================
// THREE.JS GLOBALS
// ============================================
let scene, camera, renderer, controls;
let groundPlane;
let cubeGeometry, edgeGeometry;
let placeholderGroup, figureGroup;
let gizmoScene, gizmoCamera, gizmoRoot;

function getPlacementAreaSize() {
    return CONFIG.gridSize * CONFIG.gridUnit;
}

function getPlacementAreaCenter() {
    return ((CONFIG.gridSize - 1) * CONFIG.gridUnit) / 2;
}

function getBoardWorldOffset() {
    return -getPlacementAreaCenter();
}

function getBoardWorldCenter() {
    return getBoardWorldOffset() + getPlacementAreaCenter();
}

function worldToGrid(wx, wz) {
    const boardOffset = getBoardWorldOffset();
    return {
        x: Math.round((wx - boardOffset) / CONFIG.gridUnit),
        z: Math.round((wz - boardOffset) / CONFIG.gridUnit),
    };
}

function focusBoardTarget(y = 0) {
    const boardCenter = getBoardWorldCenter();
    controls.target.set(boardCenter, y, boardCenter);
}

function getCenteredFigurePositions(positions) {
    if (!positions || positions.length === 0) return [];

    const xs = positions.map(pos => pos.x);
    const zs = positions.map(pos => pos.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);

    const width = maxX - minX + 1;
    const depth = maxZ - minZ + 1;
    const startX = Math.floor((CONFIG.gridSize - width) / 2);
    const startZ = Math.floor((CONFIG.gridSize - depth) / 2);

    return positions.map(pos => ({
        x: startX + (pos.x - minX),
        y: pos.y,
        z: startZ + (pos.z - minZ),
    }));
}

function styleGridHelper(grid, opacity) {
    grid.material.transparent = true;
    grid.material.opacity = opacity;
    grid.material.depthWrite = false;
}

function createGizmoLabel(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(64, 64, 42, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 68);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.46, 0.46, 0.46);
    return sprite;
}

function createNavigationGizmo() {
    gizmoScene = new THREE.Scene();
    gizmoCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
    gizmoCamera.position.set(0, 0, 4.8);

    gizmoRoot = new THREE.Group();
    gizmoScene.add(gizmoRoot);

    const axisDefs = [
        { dir: new THREE.Vector3(1, 0, 0), color: '#ff5b5b', label: 'X' },
        { dir: new THREE.Vector3(0, 1, 0), color: '#58d68d', label: 'Y' },
        { dir: new THREE.Vector3(0, 0, 1), color: '#5dade2', label: 'Z' },
    ];

    axisDefs.forEach(({ dir, color, label }) => {
        const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), 1.2, color, 0.28, 0.16);
        gizmoRoot.add(arrow);

        const sprite = createGizmoLabel(label, color);
        sprite.position.copy(dir.clone().multiplyScalar(1.45));
        gizmoRoot.add(sprite);
    });

    const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 16),
        new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.95,
            depthTest: false,
            depthWrite: false,
        })
    );
    gizmoRoot.add(center);
}

function renderNavigationGizmo() {
    if (!gizmoScene || !gizmoCamera || !gizmoRoot) return;

    const size = renderer.getSize(new THREE.Vector2());
    const gizmoSize = Math.max(84, Math.min(108, Math.round(Math.min(size.x, size.y) * 0.16)));
    const margin = Math.max(14, Math.round(gizmoSize * 0.22));
    const x = size.x - gizmoSize - margin;
    const y = margin;

    gizmoRoot.quaternion.copy(camera.quaternion).invert();

    renderer.clearDepth();
    renderer.setScissorTest(true);
    renderer.setScissor(x, y, gizmoSize, gizmoSize);
    renderer.setViewport(x, y, gizmoSize, gizmoSize);
    renderer.render(gizmoScene, gizmoCamera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, size.x, size.y);
}

// ============================================
// EASING FUNCTIONS
// ============================================
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function easeOutBounce(t) {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

function easeOutElastic(t) {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
}

// ============================================
// TWEEN SYSTEM
// ============================================
function addTween(object, properties, duration, easing, onComplete) {
    const tween = {
        object,
        startValues: {},
        endValues: properties,
        duration,
        easing: easing || easeOutCubic,
        startTime: performance.now(),
        onComplete: onComplete || null,
    };
    for (const key in properties) {
        if (typeof properties[key] === 'number') {
            tween.startValues[key] = object[key];
        }
    }
    state.tweens.push(tween);
    return tween;
}

function updateTweens() {
    const now = performance.now();
    for (let i = state.tweens.length - 1; i >= 0; i--) {
        const tw = state.tweens[i];
        const elapsed = now - tw.startTime;
        const progress = Math.min(elapsed / tw.duration, 1);
        const eased = tw.easing(progress);

        for (const key in tw.endValues) {
            if (typeof tw.endValues[key] === 'number' && typeof tw.startValues[key] === 'number') {
                tw.object[key] = tw.startValues[key] + (tw.endValues[key] - tw.startValues[key]) * eased;
            }
        }

        if (progress >= 1) {
            if (tw.onComplete) tw.onComplete();
            state.tweens.splice(i, 1);
        }
    }
}

// ============================================
// THREE.JS INITIALIZATION
// ============================================
function initScene() {
    const container = document.getElementById('canvas-container');
    const boardCenter = getBoardWorldCenter();

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.background);
    scene.fog = new THREE.FogExp2(CONFIG.colors.background, 0.035);

    // Camera (orthographic for isometric)
    const aspect = container.clientWidth / container.clientHeight;
    const frustum = 8;
    camera = new THREE.OrthographicCamera(
        -frustum * aspect, frustum * aspect,
        frustum, -frustum,
        0.1, 100
    );
    camera.position.set(8, 8, 8);
    camera.lookAt(boardCenter, 0, boardCenter);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.autoClear = false;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.mouseButtons = {
        LEFT: null,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.touches = {
        ONE: null,
        TWO: THREE.TOUCH.DOLLY_ROTATE,
    };
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minPolarAngle = 0.2;
    focusBoardTarget();
    controls.enablePan = true;

    // Lights
    const ambientLight = new THREE.AmbientLight(0x6655aa, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff5e6, 2.5);
    dirLight.position.set(8, 16, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -12;
    dirLight.shadow.camera.right = 12;
    dirLight.shadow.camera.top = 12;
    dirLight.shadow.camera.bottom = -12;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0x8899ff, 0x443322, 0.5);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x4466ff, 0.6);
    rimLight.position.set(-6, 4, -8);
    scene.add(rimLight);

    // Shared geometries
    cubeGeometry = new THREE.BoxGeometry(CONFIG.cubeSize, CONFIG.cubeSize, CONFIG.cubeSize);
    edgeGeometry = new THREE.EdgesGeometry(cubeGeometry);

    // Groups for mode 2
    placeholderGroup = new THREE.Group();
    placeholderGroup.name = 'placeholders';
    scene.add(placeholderGroup);

    figureGroup = new THREE.Group();
    figureGroup.name = 'figureCubes';
    scene.add(figureGroup);

    // Ground & grid
    createGround();
    createNavigationGizmo();

    // Resize handler
    window.addEventListener('resize', onResize);
}

function createGround() {
    const placementSize = getPlacementAreaSize();
    const boardCenter = getBoardWorldCenter();

    // Base floor (out-of-bounds area)
    const groundGeo = new THREE.PlaneGeometry(CONFIG.floorSize, CONFIG.floorSize);
    const groundMat = new THREE.MeshStandardMaterial({
        color: CONFIG.colors.groundBlocked,
        roughness: 0.9,
        metalness: 0.1,
    });
    groundPlane = new THREE.Mesh(groundGeo, groundMat);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -0.005;
    groundPlane.receiveShadow = true;
    groundPlane.name = 'ground';
    scene.add(groundPlane);

    // Highlight playable placement area
    const allowedArea = new THREE.Mesh(
        new THREE.PlaneGeometry(placementSize, placementSize),
        new THREE.MeshStandardMaterial({
            color: CONFIG.colors.groundAllowed,
            roughness: 0.85,
            metalness: 0.08,
            transparent: true,
            opacity: 0.96,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
        })
    );
    allowedArea.rotation.x = -Math.PI / 2;
    allowedArea.position.set(boardCenter, -0.004, boardCenter);
    allowedArea.receiveShadow = true;
    scene.add(allowedArea);

    // Full floor grid
    const floorGrid = new THREE.GridHelper(
        CONFIG.floorSize,
        CONFIG.floorSize / CONFIG.gridUnit,
        CONFIG.colors.gridBlockedMain,
        CONFIG.colors.gridBlockedSub
    );
    floorGrid.position.y = 0.001;
    styleGridHelper(floorGrid, 0.55);
    scene.add(floorGrid);

    // Playable area grid aligned with the cube placement cells
    const placementGrid = new THREE.GridHelper(
        placementSize,
        CONFIG.gridSize,
        CONFIG.colors.gridAllowedMain,
        CONFIG.colors.gridAllowedSub
    );
    placementGrid.position.set(boardCenter, 0.002, boardCenter);
    styleGridHelper(placementGrid, 0.95);
    scene.add(placementGrid);
}

function onResize() {
    const container = document.getElementById('canvas-container');
    const w = container.clientWidth;
    const h = container.clientHeight;
    const aspect = w / h;
    const frustum = 8;

    camera.left = -frustum * aspect;
    camera.right = frustum * aspect;
    camera.top = frustum;
    camera.bottom = -frustum;
    camera.updateProjectionMatrix();

    renderer.setSize(w, h);
}

// ============================================
// CUBE FACTORY
// ============================================
function createCubeMesh(color, options = {}) {
    const {
        transparent = false,
        opacity = 1,
        wireframe = false,
        emissive = 0x000000,
        emissiveIntensity = 0,
    } = options;

    const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.35,
        metalness: 0.05,
        transparent,
        opacity,
        wireframe,
        emissive,
        emissiveIntensity,
    });

    const mesh = new THREE.Mesh(cubeGeometry, mat);
    mesh.castShadow = !transparent;
    mesh.receiveShadow = !transparent;

    // Edge outline
    const edgeMat = new THREE.LineBasicMaterial({
        color: transparent ? 0xffffff : 0x000000,
        transparent: true,
        opacity: transparent ? 0.5 : 0.15,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMat);
    mesh.add(edges);

    return mesh;
}

function createPlaceholderMesh() {
    // Semi-transparent cube with dashed edge appearance
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.08,
        roughness: 0.5,
    });

    const mesh = new THREE.Mesh(cubeGeometry, mat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    // Bright dashed edges
    const edgeMat = new THREE.LineDashedMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        dashSize: 0.12,
        gapSize: 0.08,
        linewidth: 1,
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMat);
    edges.computeLineDistances();
    mesh.add(edges);

    return mesh;
}

// ============================================
// CUBE PLACEMENT & MANAGEMENT
// ============================================
function gridToWorld(gx, gy, gz) {
    const boardOffset = getBoardWorldOffset();
    return new THREE.Vector3(
        boardOffset + gx * CONFIG.gridUnit,
        gy * CONFIG.gridUnit + CONFIG.cubeSize / 2,
        boardOffset + gz * CONFIG.gridUnit
    );
}

function isPositionOccupied(x, y, z) {
    return state.cubes.some(c =>
        c.gridPos.x === x && c.gridPos.y === y && c.gridPos.z === z
    );
}

function getPlacementPosition(intersect) {
    if (!intersect || !intersect.object) return null;

    if (intersect.object.name === 'ground') {
        const p = intersect.point;
        const { x: gx, z: gz } = worldToGrid(p.x, p.z);
        if (gx < 0 || gx >= CONFIG.gridSize || gz < 0 || gz >= CONFIG.gridSize) return null;
        return { x: gx, y: 0, z: gz };
    }

    if (intersect.object.userData.isCube || intersect.object.parent?.userData?.isCube) {
        const target = intersect.object.userData.isCube ? intersect.object : intersect.object.parent;
        const normal = intersect.face.normal.clone();
        // Transform to world space (cubes are not rotated, so this is fine)
        const cubePos = target.userData.gridPos;
        const nx = cubePos.x + Math.round(normal.x);
        const ny = cubePos.y + Math.round(normal.y);
        const nz = cubePos.z + Math.round(normal.z);

        if (ny < 0 || ny >= CONFIG.maxLevels) return null;
        if (nx < 0 || nx >= CONFIG.gridSize || nz < 0 || nz >= CONFIG.gridSize) return null;

        return { x: nx, y: ny, z: nz };
    }

    return null;
}

function placeCubeAnimated(gx, gy, gz, color, group) {
    const mesh = createCubeMesh(color);
    const worldPos = gridToWorld(gx, gy, gz);
    mesh.position.copy(worldPos);
    mesh.position.y += CONFIG.bounceHeight; // Start above
    mesh.userData.isCube = true;
    mesh.userData.gridPos = { x: gx, y: gy, z: gz };

    const targetGroup = group || scene;
    targetGroup.add(mesh);

    const cubeData = {
        mesh,
        gridPos: { x: gx, y: gy, z: gz },
        color,
        group: targetGroup,
    };
    state.cubes.push(cubeData);

    // Magnetic snap animation (fall + bounce)
    const startY = mesh.position.y;
    const targetY = worldPos.y;

    // Phase 1: fall down
    addTween(mesh.position, { y: targetY }, CONFIG.snapDuration, easeOutBounce, () => {
        // Phase 2: small wobble on X and Z
        addTween(mesh.scale, { x: 1.08, z: 1.08 }, 100, easeOutCubic, () => {
            addTween(mesh.scale, { x: 1, z: 1 }, 150, easeOutElastic);
        });
        addTween(mesh.scale, { y: 0.92 }, 100, easeOutCubic, () => {
            addTween(mesh.scale, { y: 1 }, 200, easeOutElastic);
        });
    });

    return cubeData;
}

function disposeObjectMaterials(object) {
    object.traverse(child => {
        if (!child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(material => material?.dispose());
    });
}

function removeCube(cubeData) {
    if (!cubeData) return false;

    const cubeIndex = state.cubes.indexOf(cubeData);
    if (cubeIndex === -1) return false;

    state.cubes.splice(cubeIndex, 1);
    cubeData.group.remove(cubeData.mesh);
    state.originalColors.delete(cubeData.mesh);

    if (cubeData.group === figureGroup) {
        const target = state.figureTargets.find(t =>
            t.pos.x === cubeData.gridPos.x &&
            t.pos.y === cubeData.gridPos.y &&
            t.pos.z === cubeData.gridPos.z
        );
        if (target) {
            target.filled = false;
            target.filledMesh = null;
            if (target.placeholderMesh) target.placeholderMesh.visible = true;
        }
    }

    disposeObjectMaterials(cubeData.mesh);
    return true;
}

function removeLastCube() {
    if (state.cubes.length === 0) return;
    removeCube(state.cubes[state.cubes.length - 1]);
}

function clearAllCubes() {
    while (state.cubes.length > 0) removeCube(state.cubes[state.cubes.length - 1]);
    state.originalColors.clear();
}

// ============================================
// GHOST CUBE (PLACEMENT PREVIEW)
// ============================================
function createGhostCube() {
    const mesh = createCubeMesh(CONFIG.colors.ghost, {
        transparent: true,
        opacity: 0.3,
        emissive: 0xffffff,
        emissiveIntensity: 0.2,
    });
    mesh.visible = false;
    mesh.userData.isGhost = true;
    scene.add(mesh);
    state.ghostCube = mesh;
}

function updateGhostCube(gridPos) {
    if (!state.ghostCube) return;

    if (!gridPos || isPositionOccupied(gridPos.x, gridPos.y, gridPos.z)) {
        state.ghostCube.visible = false;
        state.ghostGridPos = null;
        return;
    }

    const worldPos = gridToWorld(gridPos.x, gridPos.y, gridPos.z);
    state.ghostCube.position.copy(worldPos);
    state.ghostCube.visible = true;
    state.ghostGridPos = gridPos;
}

function hideGhostCube() {
    if (state.ghostCube) {
        state.ghostCube.visible = false;
        state.ghostGridPos = null;
    }
}

// ============================================
// MODE 1: PLACE CUBES
// ============================================
function setupMode1() {
    clearAllCubes();
    clearPlaceholders();
    focusBoardTarget();
    createGhostCube();
    document.getElementById('blocks-tray').classList.add('hidden');
}

function handleMode1Click(event) {
    if (state.ghostGridPos && !isPositionOccupied(state.ghostGridPos.x, state.ghostGridPos.y, state.ghostGridPos.z)) {
        const pos = state.ghostGridPos;
        placeCubeAnimated(pos.x, pos.y, pos.z, state.selectedColor);
    }
}

function handleMode1MouseMove(event) {
    const ndc = getMouseNDC(event);
    state.raycaster.setFromCamera(ndc, camera);

    const targets = [groundPlane, ...state.cubes.map(c => c.mesh)];
    const intersects = state.raycaster.intersectObjects(targets, false);

    if (intersects.length > 0) {
        const pos = getPlacementPosition(intersects[0]);
        updateGhostCube(pos);
    } else {
        hideGhostCube();
    }
}

// ============================================
// MODE 2: FILL FIGURE
// ============================================
function setupMode2() {
    clearAllCubes();
    if (state.ghostCube) {
        scene.remove(state.ghostCube);
        state.ghostCube = null;
    }
    loadFigure(state.currentFigure);
    document.getElementById('blocks-tray').classList.remove('hidden');
}

function clearPlaceholders() {
    while (placeholderGroup.children.length > 0) {
        const child = placeholderGroup.children[0];
        placeholderGroup.remove(child);
        child.material?.dispose();
    }
    state.figureTargets = [];
}

function clearFigureCubes() {
    // Remove cubes placed in figure mode
    state.cubes = state.cubes.filter(c => {
        if (c.group === figureGroup) {
            figureGroup.remove(c.mesh);
            c.mesh.material.dispose();
            return false;
        }
        return true;
    });
}

function loadFigure(figureName) {
    clearPlaceholders();
    clearFigureCubes();
    document.getElementById('completion-modal').classList.add('hidden');

    const figure = FIGURES[figureName];
    if (!figure) return;
    const centeredPositions = getCenteredFigurePositions(figure.positions);

    state.currentFigure = figureName;
    state.figureTargets = [];

    // Create placeholder meshes
    centeredPositions.forEach((pos, idx) => {
        const phMesh = createPlaceholderMesh();
        const worldPos = gridToWorld(pos.x, pos.y, pos.z);
        phMesh.position.copy(worldPos);
        phMesh.userData = { isPlaceholder: true, index: idx, gridPos: { ...pos } };
        placeholderGroup.add(phMesh);

        state.figureTargets.push({
            pos: { ...pos },
            filled: false,
            placeholderMesh: phMesh,
            filledMesh: null,
            color: figure.blockColors[idx] || CONFIG.colors.palette[idx % CONFIG.colors.palette.length],
        });
    });

    // Center camera on figure
    const avgX = centeredPositions.reduce((s, p) => s + p.x, 0) / centeredPositions.length;
    const avgZ = centeredPositions.reduce((s, p) => s + p.z, 0) / centeredPositions.length;
    const worldTarget = gridToWorld(avgX, 0, avgZ);
    controls.target.set(worldTarget.x, 0.5, worldTarget.z);

    // Create tray blocks
    createTrayBlocks(figure);

    updateProgress();
}

function createTrayBlocks(figure) {
    const trayEl = document.getElementById('tray-blocks');
    trayEl.innerHTML = '';
    state.trayBlocks = [];

    figure.positions.forEach((pos, idx) => {
        const color = figure.blockColors[idx] || CONFIG.colors.palette[idx % CONFIG.colors.palette.length];
        const blockEl = document.createElement('div');
        blockEl.className = 'tray-block';
        blockEl.style.backgroundColor = color;
        blockEl.dataset.color = color;
        blockEl.dataset.index = idx;

        // Drag events
        blockEl.addEventListener('mousedown', (e) => startDrag(e, color, idx));
        blockEl.addEventListener('touchstart', (e) => startDragTouch(e, color, idx), { passive: false });

        trayEl.appendChild(blockEl);
        state.trayBlocks.push({ element: blockEl, color, used: false });
    });
}

function startDrag(event, color, index) {
    event.preventDefault();
    state.isDragging = true;
    state.dragColor = color;
    state.dragBlockIndex = index;

    const ghost = document.getElementById('drag-ghost');
    ghost.style.backgroundColor = color;
    ghost.style.left = event.clientX + 'px';
    ghost.style.top = event.clientY + 'px';
    ghost.classList.add('visible');

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
}

function startDragTouch(event, color, index) {
    event.preventDefault();
    const touch = event.touches[0];
    state.isDragging = true;
    state.dragColor = color;
    state.dragBlockIndex = index;

    const ghost = document.getElementById('drag-ghost');
    ghost.style.backgroundColor = color;
    ghost.style.left = touch.clientX + 'px';
    ghost.style.top = touch.clientY + 'px';
    ghost.classList.add('visible');

    document.addEventListener('touchmove', onDragMoveTouch, { passive: false });
    document.addEventListener('touchend', onDragEndTouch);
}

function onDragMove(event) {
    if (!state.isDragging) return;

    const ghost = document.getElementById('drag-ghost');
    ghost.style.left = event.clientX + 'px';
    ghost.style.top = event.clientY + 'px';

    highlightNearestPlaceholder(event.clientX, event.clientY);
}

function onDragMoveTouch(event) {
    event.preventDefault();
    if (!state.isDragging) return;
    const touch = event.touches[0];

    const ghost = document.getElementById('drag-ghost');
    ghost.style.left = touch.clientX + 'px';
    ghost.style.top = touch.clientY + 'px';

    highlightNearestPlaceholder(touch.clientX, touch.clientY);
}

function highlightNearestPlaceholder(clientX, clientY) {
    // Reset all placeholder highlights
    state.figureTargets.forEach(t => {
        if (!t.filled && t.placeholderMesh) {
            t.placeholderMesh.material.opacity = 0.08;
            t.placeholderMesh.material.emissive = new THREE.Color(0x000000);
            t.placeholderMesh.material.emissiveIntensity = 0;
        }
    });

    // Raycast to find nearest placeholder
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };
    state.raycaster.setFromCamera(ndc, camera);

    const placeholderMeshes = state.figureTargets
        .filter(t => !t.filled)
        .map(t => t.placeholderMesh);

    const intersects = state.raycaster.intersectObjects(placeholderMeshes, false);

    if (intersects.length > 0) {
        const hit = intersects[0].object;
        hit.material.opacity = 0.35;
        hit.material.emissive = new THREE.Color(state.dragColor);
        hit.material.emissiveIntensity = 0.4;
    }
}

function onDragEnd(event) {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    finishDrag(event.clientX, event.clientY);
}

function onDragEndTouch(event) {
    document.removeEventListener('touchmove', onDragMoveTouch);
    document.removeEventListener('touchend', onDragEndTouch);
    const touch = event.changedTouches[0];
    finishDrag(touch.clientX, touch.clientY);
}

function finishDrag(clientX, clientY) {
    const ghost = document.getElementById('drag-ghost');
    ghost.classList.remove('visible');
    state.isDragging = false;

    // Find which placeholder was hit
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };
    state.raycaster.setFromCamera(ndc, camera);

    const placeholderMeshes = state.figureTargets
        .filter(t => !t.filled)
        .map(t => t.placeholderMesh);

    const intersects = state.raycaster.intersectObjects(placeholderMeshes, false);

    if (intersects.length > 0) {
        const hitMesh = intersects[0].object;
        const targetIndex = hitMesh.userData.index;
        const target = state.figureTargets[targetIndex];

        if (target && !target.filled) {
            // Fill this position
            target.filled = true;
            target.placeholderMesh.visible = false;

            const cubeData = placeCubeAnimated(
                target.pos.x, target.pos.y, target.pos.z,
                state.dragColor,
                figureGroup
            );
            target.filledMesh = cubeData.mesh;

            // Mark tray block as used
            const blockIdx = state.dragBlockIndex;
            if (state.trayBlocks[blockIdx]) {
                state.trayBlocks[blockIdx].used = true;
                state.trayBlocks[blockIdx].element.classList.add('used');
            }

            updateProgress();
        }
    }

    // Reset highlights
    state.figureTargets.forEach(t => {
        if (!t.filled && t.placeholderMesh) {
            t.placeholderMesh.material.opacity = 0.08;
            t.placeholderMesh.material.emissive = new THREE.Color(0x000000);
            t.placeholderMesh.material.emissiveIntensity = 0;
        }
    });

    state.dragColor = null;
    state.dragBlockIndex = -1;
}

function updateProgress() {
    const total = state.figureTargets.length;
    const filled = state.figureTargets.filter(t => t.filled).length;
    const pct = total > 0 ? (filled / total) * 100 : 0;

    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-text').textContent = `${filled} / ${total} bloques`;

    if (filled === total && total > 0) {
        setTimeout(() => {
            document.getElementById('completion-modal').classList.remove('hidden');
        }, 600);
    }
}

// ============================================
// MODE 3: COUNT BLOCKS
// ============================================
function setupMode3() {
    clearPlaceholders();
    clearFigureCubes();
    document.getElementById('blocks-tray').classList.add('hidden');
    focusBoardTarget();

    if (state.ghostCube) {
        scene.remove(state.ghostCube);
        state.ghostCube = null;
    }
    createGhostCube();

    updateCount();
}

function updateCount() {
    const total = state.cubes.length;
    document.getElementById('total-count').textContent = total;

    // Level breakdown
    const breakdown = {};
    state.cubes.forEach(c => {
        const level = c.gridPos.y;
        if (!breakdown[level]) breakdown[level] = 0;
        breakdown[level]++;
    });

    const container = document.getElementById('level-breakdown');
    container.innerHTML = '';

    const maxLevel = Math.max(0, ...Object.keys(breakdown).map(Number));

    for (let lvl = 0; lvl <= maxLevel; lvl++) {
        const count = breakdown[lvl] || 0;
        const color = CONFIG.colors.levels[lvl % CONFIG.colors.levels.length];

        const item = document.createElement('div');
        item.className = 'level-item';
        item.innerHTML = `
            <div class="level-color" style="background:${color}"></div>
            <span class="level-label">Nivel ${lvl}</span>
            <span class="level-count">${count}</span>
        `;
        container.appendChild(item);
    }
}

function applyLevelColors() {
    state.cubes.forEach(c => {
        const level = c.gridPos.y;
        const color = CONFIG.colors.levels[level % CONFIG.colors.levels.length];

        if (!state.originalColors.has(c.mesh)) {
            state.originalColors.set(c.mesh, c.color);
        }

        c.mesh.material.color.set(color);
    });
}

function restoreOriginalColors() {
    state.originalColors.forEach((color, mesh) => {
        mesh.material.color.set(color);
    });
    state.originalColors.clear();
}

function handleMode3MouseMove(event) {
    const ndc = getMouseNDC(event);
    state.raycaster.setFromCamera(ndc, camera);

    const targets = [groundPlane, ...state.cubes.map(c => c.mesh)];
    const intersects = state.raycaster.intersectObjects(targets, false);

    if (intersects.length > 0) {
        const pos = getPlacementPosition(intersects[0]);
        updateGhostCube(pos);
    } else {
        hideGhostCube();
    }
}

function handleMode3Click() {
    if (state.ghostGridPos && !isPositionOccupied(state.ghostGridPos.x, state.ghostGridPos.y, state.ghostGridPos.z)) {
        const pos = state.ghostGridPos;
        const color = state.countView === 'levels'
            ? CONFIG.colors.levels[pos.y % CONFIG.colors.levels.length]
            : state.selectedColor;
        placeCubeAnimated(pos.x, pos.y, pos.z, color);
        updateCount();

        if (state.countView === 'levels') {
            applyLevelColors();
        }
    }
}

function getIntersectedCube(event) {
    if (state.cubes.length === 0) return null;

    const ndc = getMouseNDC(event);
    state.raycaster.setFromCamera(ndc, camera);

    const intersects = state.raycaster.intersectObjects(state.cubes.map(c => c.mesh), false);
    if (intersects.length === 0) return null;

    return state.cubes.find(c => c.mesh === intersects[0].object) || null;
}

function handleCanvasRightClick(event) {
    if (event.button !== 2) return;
    if (state.mode !== 1 && state.mode !== 3) return;

    const cubeData = getIntersectedCube(event);
    if (!cubeData) return;

    event.preventDefault();
    event.stopPropagation();

    removeCube(cubeData);

    if (state.mode === 3) {
        updateCount();
        if (state.countView === 'levels') applyLevelColors();
    }

    onCanvasMouseMove(event);
}

// ============================================
// MODE MANAGEMENT
// ============================================
function switchMode(mode) {
    state.mode = mode;

    // Hide all mode panels
    document.querySelectorAll('.controls-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`mode${mode}-controls`).classList.remove('hidden');

    // Update tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-mode="${mode}"]`).classList.add('active');

    // Clear ghost from previous mode
    if (state.ghostCube) {
        scene.remove(state.ghostCube);
        state.ghostCube = null;
    }

    if (mode === 1) setupMode1();
    else if (mode === 2) setupMode2();
    else if (mode === 3) setupMode3();
}

// ============================================
// EVENT HANDLERS
// ============================================
function getMouseNDC(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
}

function setupEventListeners() {
    const canvas = renderer.domElement;

    // Canvas mouse events
    canvas.addEventListener('pointerdown', handleCanvasRightClick, true);
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mode tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchMode(parseInt(tab.dataset.mode));
        });
    });

    // Mode 1 controls
    document.getElementById('btn-undo').addEventListener('click', () => {
        removeLastCube();
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
        clearAllCubes();
    });

    // Color picker (Mode 1)
    const colorPicker = document.getElementById('color-picker');
    CONFIG.colors.palette.forEach((color, idx) => {
        const btn = document.createElement('div');
        btn.className = 'color-btn' + (idx === 0 ? ' active' : '');
        btn.style.backgroundColor = color;
        btn.dataset.color = color;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedColor = color;
        });
        colorPicker.appendChild(btn);
    });

    // Mode 2 controls
    document.getElementById('figure-select').addEventListener('change', (e) => {
        loadFigure(e.target.value);
    });

    document.getElementById('btn-reset-figure').addEventListener('click', () => {
        loadFigure(state.currentFigure);
    });

    document.getElementById('btn-next-figure').addEventListener('click', () => {
        document.getElementById('completion-modal').classList.add('hidden');
        // Go to next figure
        const figureNames = Object.keys(FIGURES);
        const currentIdx = figureNames.indexOf(state.currentFigure);
        const nextIdx = (currentIdx + 1) % figureNames.length;
        const nextName = figureNames[nextIdx];
        document.getElementById('figure-select').value = nextName;
        loadFigure(nextName);
    });

    // Mode 3 controls
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.countView = btn.dataset.view;

            if (state.countView === 'levels') {
                applyLevelColors();
            } else {
                restoreOriginalColors();
            }
            updateCount();
        });
    });

    document.getElementById('btn-undo-m3').addEventListener('click', () => {
        removeLastCube();
        updateCount();
        if (state.countView === 'levels') applyLevelColors();
    });

    document.getElementById('btn-clear-m3').addEventListener('click', () => {
        clearAllCubes();
        updateCount();
    });
}

function onCanvasClick(event) {
    // Only left click places cubes
    if (event.button !== 0) return;

    if (state.mode === 1) {
        handleMode1Click(event);
    } else if (state.mode === 3) {
        handleMode3Click();
    }
}

function onCanvasMouseMove(event) {
    if (state.mode === 1) {
        handleMode1MouseMove(event);
    } else if (state.mode === 3) {
        handleMode3MouseMove(event);
    }
}

// ============================================
// ANIMATION LOOP
// ============================================
function animate() {
    requestAnimationFrame(animate);

    updateTweens();
    controls.update();

    // Ghost cube pulsing effect
    if (state.ghostCube && state.ghostCube.visible) {
        const pulse = Math.sin(performance.now() * 0.006) * 0.12 + 0.35;
        state.ghostCube.material.opacity = pulse;
    }

    // Placeholder pulsing effect
    if (state.mode === 2) {
        const t = performance.now() * 0.003;
        state.figureTargets.forEach((target, i) => {
            if (!target.filled && target.placeholderMesh) {
                const pulse = Math.sin(t + i * 0.5) * 0.04 + 0.08;
                target.placeholderMesh.material.opacity = pulse;
                // Subtle float
                const baseY = target.pos.y * CONFIG.gridUnit + CONFIG.cubeSize / 2;
                target.placeholderMesh.position.y = baseY + Math.sin(t + i) * 0.03;
            }
        });
    }

    renderer.clear();
    renderer.render(scene, camera);
    renderNavigationGizmo();
}

// ============================================
// INITIALIZATION
// ============================================
function start() {
    initScene();
    setupEventListeners();
    switchMode(1);
    animate();
}

// Wait for DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
} else {
    start();
}
