// --- 3D Soft-Body Verlet Physics Engine ---
let nodes = [];
let springs = [];
let bounds = 300; // -300 to 300 on all axes
let gravity = 0.2;
let stiffness = 0.85; // Slightly less stiff for more jiggle
let bounce = 0.8;
let friction = 0.98; // More dampening for jelly feel

const ITERATIONS = 12;

let intervalId = null;

onmessage = function(e) {
    const data = e.data;
    if (data.type === 'init') {
        initMesh(data.size, data.spacing);
    } else if (data.type === 'stop') {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    } else if (data.type === 'start') {
        if (!intervalId) {
            intervalId = setInterval(() => {
                if (nodes.length > 0) {
                    updatePhysics();
                    
                    // Prepare arrays for transfer
                    let posArray = new Float32Array(nodes.length * 3);
                    for (let i = 0; i < nodes.length; i++) {
                        posArray[i * 3] = nodes[i].x;
                        posArray[i * 3 + 1] = nodes[i].y;
                        posArray[i * 3 + 2] = nodes[i].z;
                    }

                    postMessage({
                        type: 'render',
                        positions: posArray,
                        springs: springs.map(s => [s.a, s.b])
                    });
                }
            }, 1000 / 60);
        }
    } else if (data.type === 'kick') {
        for (let n of nodes) {
            n.oldY = n.y + Math.random() * 20 + 20; // Kick upwards
            n.oldX = n.x + (Math.random() - 0.5) * 20;
            n.oldZ = n.z + (Math.random() - 0.5) * 20;
        }
    }
};

function initMesh(size, spacing) {
    nodes = [];
    springs = [];

    let offset = (size * spacing) / 2;

    // Create Nodes (3D Lattice)
    for (let z = 0; z < size; z++) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                let px = x * spacing - offset;
                let py = y * spacing - offset - 100; // start slightly high
                let pz = z * spacing - offset;
                
                nodes.push({
                    x: px, y: py, z: pz,
                    oldX: px, oldY: py, oldZ: pz
                });
            }
        }
    }

    const getIdx = (x, y, z) => z * size * size + y * size + x;

    // Calculate Surface Faces (Triangles)
    let faces = [];
    const addFace = (v0, v1, v2, v3) => {
        faces.push(v0, v1, v2, v0, v2, v3);
    };

    for (let i = 0; i < size - 1; i++) {
        for (let j = 0; j < size - 1; j++) {
            addFace(getIdx(i, j, 0), getIdx(i+1, j, 0), getIdx(i+1, j+1, 0), getIdx(i, j+1, 0)); // Z=0
            addFace(getIdx(i, j, size-1), getIdx(i, j+1, size-1), getIdx(i+1, j+1, size-1), getIdx(i+1, j, size-1)); // Z=max
            addFace(getIdx(i, 0, j), getIdx(i, 0, j+1), getIdx(i+1, 0, j+1), getIdx(i+1, 0, j)); // Y=0
            addFace(getIdx(i, size-1, j), getIdx(i+1, size-1, j), getIdx(i+1, size-1, j+1), getIdx(i, size-1, j+1)); // Y=max
            addFace(getIdx(0, i, j), getIdx(0, i+1, j), getIdx(0, i+1, j+1), getIdx(0, i, j+1)); // X=0
            addFace(getIdx(size-1, i, j), getIdx(size-1, i, j+1), getIdx(size-1, i+1, j+1), getIdx(size-1, i+1, j)); // X=max
        }
    }
    
    postMessage({ type: 'mesh', faces: faces });

    // Create Springs
    for (let z = 0; z < size; z++) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                let idx = getIdx(x, y, z);

                // Structural Springs (Right, Down, Back)
                if (x < size - 1) addSpring(idx, getIdx(x + 1, y, z), stiffness);
                if (y < size - 1) addSpring(idx, getIdx(x, y + 1, z), stiffness);
                if (z < size - 1) addSpring(idx, getIdx(x, y, z + 1), stiffness);

                // Shear Springs (Diagonals in 3 planes)
                if (x < size - 1 && y < size - 1) {
                    addSpring(idx, getIdx(x + 1, y + 1, z), stiffness);
                    addSpring(getIdx(x + 1, y, z), getIdx(x, y + 1, z), stiffness);
                }
                if (y < size - 1 && z < size - 1) {
                    addSpring(idx, getIdx(x, y + 1, z + 1), stiffness);
                    addSpring(getIdx(x, y + 1, z), getIdx(x, y, z + 1), stiffness);
                }
                if (x < size - 1 && z < size - 1) {
                    addSpring(idx, getIdx(x + 1, y, z + 1), stiffness);
                    addSpring(getIdx(x + 1, y, z), getIdx(x, y, z + 1), stiffness);
                }

                // Bending Springs
                if (x < size - 2) addSpring(idx, getIdx(x + 2, y, z), stiffness * 0.5);
                if (y < size - 2) addSpring(idx, getIdx(x, y + 2, z), stiffness * 0.5);
                if (z < size - 2) addSpring(idx, getIdx(x, y, z + 2), stiffness * 0.5);
            }
        }
    }
}

function addSpring(a, b, k) {
    let dx = nodes[b].x - nodes[a].x;
    let dy = nodes[b].y - nodes[a].y;
    let dz = nodes[b].z - nodes[a].z;
    let length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    springs.push({ a: a, b: b, restLength: length, k: k });
}

function updatePhysics() {
    // 1. Apply Forces & Integrate
    for (let i = 0; i < nodes.length; i++) {
        let n = nodes[i];

        let vx = (n.x - n.oldX) * friction;
        let vy = (n.y - n.oldY) * friction;
        let vz = (n.z - n.oldZ) * friction;

        n.oldX = n.x;
        n.oldY = n.y;
        n.oldZ = n.z;

        n.x += vx;
        n.y += vy;
        n.y += gravity; // Gravity pushes down (positive Y)
        n.z += vz;
    }

    // 2. Solve Constraints
    for (let iter = 0; iter < ITERATIONS; iter++) {
        // Springs
        for (let s of springs) {
            let n1 = nodes[s.a];
            let n2 = nodes[s.b];

            let dx = n2.x - n1.x;
            let dy = n2.y - n1.y;
            let dz = n2.z - n1.z;
            let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist > 0) {
                let diff = (dist - s.restLength) / dist;
                let offsetX = dx * diff * 0.5 * s.k;
                let offsetY = dy * diff * 0.5 * s.k;
                let offsetZ = dz * diff * 0.5 * s.k;

                n1.x += offsetX;
                n1.y += offsetY;
                n1.z += offsetZ;
                
                n2.x -= offsetX;
                n2.y -= offsetY;
                n2.z -= offsetZ;
            }
        }

        // 3D Bounds (Cube from -bounds to +bounds)
        for (let i = 0; i < nodes.length; i++) {
            let n = nodes[i];

            if (n.x < -bounds) { let vx = (n.x - n.oldX) * bounce; n.x = -bounds; n.oldX = n.x + vx; }
            else if (n.x > bounds) { let vx = (n.x - n.oldX) * bounce; n.x = bounds; n.oldX = n.x + vx; }

            if (n.y < -bounds) { let vy = (n.y - n.oldY) * bounce; n.y = -bounds; n.oldY = n.y + vy; }
            else if (n.y > bounds) { let vy = (n.y - n.oldY) * bounce; n.y = bounds; n.oldY = n.y + vy; }

            if (n.z < -bounds) { let vz = (n.z - n.oldZ) * bounce; n.z = -bounds; n.oldZ = n.z + vz; }
            else if (n.z > bounds) { let vz = (n.z - n.oldZ) * bounce; n.z = bounds; n.oldZ = n.z + vz; }
        }
    }
}

