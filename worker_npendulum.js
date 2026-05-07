// --- N-Pendulum Physics Worker ---
let N = 4;
let lengths = [];
let masses = [];
let angles = [];
let aVels = [];

const g = 981;
let mu = [], coeffMatrix = [];

// Energy Tracking
let initialEnergy = 0, currentEnergy = 0, groundLevel = 0;

// Interaction
let draggedMass = -1;
let isPaused = true;
let targetX = 0, targetY = 0;

// Worker Message Handler
onmessage = function(e) {
    const data = e.data;
    
    switch (data.type) {
        case 'init':
            initPendulum(data.N, data.l);
            break;
        case 'pause':
            isPaused = data.isPaused;
            break;
        case 'drag':
            draggedMass = data.draggedMass;
            targetX = data.targetX;
            targetY = data.targetY;
            break;
        case 'release':
            if (draggedMass !== -1) {
                // Readjust initial energy after user intervention
                initialEnergy = calculateTotalEnergy();
                draggedMass = -1;
            }
            break;
    }
};

function initPendulum(newN, l) {
    N = newN;
    lengths = [];
    masses = [];
    angles = [];
    aVels = [];
    groundLevel = 0;
    draggedMass = -1;

    for (let i = 0; i < N; i++) {
        lengths.push(l);
        masses.push(10);
        angles.push(Math.PI / 2); // Start horizontal
        aVels.push(0);
        groundLevel -= l;
    }

    precomputeConstants();
    initialEnergy = calculateTotalEnergy();
    currentEnergy = initialEnergy;
}

function precomputeConstants() {
    mu = [];
    coeffMatrix = [];
    for (let i = 0; i < N; i++) {
        let sum = 0;
        for (let k = i; k < N; k++) sum += masses[k];
        mu[i] = sum;
    }
    for (let i = 0; i < N; i++) {
        coeffMatrix[i] = [];
        for (let j = 0; j < N; j++) {
            let maxIdx = Math.max(i, j);
            coeffMatrix[i][j] = mu[maxIdx] * lengths[i] * lengths[j];
        }
    }
}

function calculateTotalEnergy() {
    if (N === 0) return 0;
    let K = 0, U = 0;
    for (let i = 0; i < N; i++) {
        let vx = 0, vy = 0, y_pos = 0;
        for (let k = 0; k <= i; k++) {
            vx += lengths[k] * aVels[k] * Math.cos(angles[k]);
            vy += -lengths[k] * aVels[k] * Math.sin(angles[k]);
            y_pos += -lengths[k] * Math.cos(angles[k]);
        }
        K += 0.5 * masses[i] * (vx * vx + vy * vy);
        U += masses[i] * g * (y_pos - groundLevel);
    }
    return K + U;
}

function rk4Step(dt) {
    const clone = (arr) => arr.slice();
    let a1 = calculateAccelerations(angles, aVels);
    let k1v = clone(a1), k1p = clone(aVels);
    let midA1 = angles.map((a, i) => a + k1p[i] * (dt / 2));
    let midV1 = aVels.map((v, i) => v + k1v[i] * (dt / 2));
    let a2 = calculateAccelerations(midA1, midV1);
    let k2v = clone(a2), k2p = clone(midV1);
    let midA2 = angles.map((a, i) => a + k2p[i] * (dt / 2));
    let midV2 = aVels.map((v, i) => v + k2v[i] * (dt / 2));
    let a3 = calculateAccelerations(midA2, midV2);
    let k3v = clone(a3), k3p = clone(midV2);
    let endA = angles.map((a, i) => a + k3p[i] * dt);
    let endV = aVels.map((v, i) => v + k3v[i] * dt);
    let a4 = calculateAccelerations(endA, endV);
    let k4v = clone(a4), k4p = clone(endV);

    for (let i = 0; i < N; i++) {
        aVels[i] += (dt / 6) * (k1v[i] + 2 * k2v[i] + 2 * k3v[i] + k4v[i]);
        angles[i] += (dt / 6) * (k1p[i] + 2 * k2p[i] + 2 * k3p[i] + k4p[i]);
    }
}

function calculateAccelerations(theta, omega) {
    let M = [], C = [];

    // Interaction Spring Force Calculations
    let fx = 0, fy = 0;
    if (draggedMass !== -1) {
        let mx = 0, my = 0;
        for (let m = 0; m <= draggedMass; m++) {
            mx += lengths[m] * Math.sin(theta[m]);
            my += lengths[m] * Math.cos(theta[m]);
        }
        let vx = 0, vy = 0;
        for (let m = 0; m <= draggedMass; m++) {
            vx += lengths[m] * omega[m] * Math.cos(theta[m]);
            vy += -lengths[m] * omega[m] * Math.sin(theta[m]);
        }

        let K_spring = 20000;
        let D_spring = 500;

        fx = K_spring * (targetX - mx) - D_spring * vx;
        fy = K_spring * (targetY - my) - D_spring * vy;
    }

    for (let i = 0; i < N; i++) {
        M[i] = [];
        let Ci = -mu[i] * g * lengths[i] * Math.sin(theta[i]);
        let centrifugal = 0;

        for (let j = 0; j < N; j++) {
            let diff = theta[i] - theta[j];
            M[i][j] = coeffMatrix[i][j] * Math.cos(diff);
            if (i === j) M[i][j] += 1e-6; // Regularization
            centrifugal += coeffMatrix[i][j] * Math.sin(diff) * omega[j] * omega[j];
        }

        let externalTorque = 0;
        if (draggedMass !== -1 && i <= draggedMass) {
            externalTorque = fx * lengths[i] * Math.cos(theta[i]) - fy * lengths[i] * Math.sin(theta[i]);
        }

        C.push([Ci - centrifugal + externalTorque]);
    }
    return fastMatrixSolve(M, C);
}

function fastMatrixSolve(M, C) {
    let n = M.length;
    for (let i = 0; i < n; i++) {
        let maxRow = i;
        for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;

        [M[i], M[maxRow]] = [M[maxRow], M[i]];
        [C[i], C[maxRow]] = [C[maxRow], C[i]];

        for (let k = i + 1; k < n; k++) {
            let factor = M[k][i] / M[i][i];
            for (let j = i; j < n; j++) M[k][j] -= factor * M[i][j];
            C[k][0] -= factor * C[i][0];
        }
    }
    let result = [];
    for (let i = n - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < n; j++) sum += M[i][j] * result[j];
        result[i] = (C[i][0] - sum) / M[i][i];
    }
    return result;
}

// Physics Loop - running continuously
setInterval(() => {
    if (N === 0 || lengths.length === 0) return;
    
    if (!isPaused || draggedMass !== -1) {
        let subSteps = 5;
        let dt = 0.015 / subSteps;
        for (let step = 0; step < subSteps; step++) {
            rk4Step(dt);
        }
    }

    currentEnergy = calculateTotalEnergy();
    
    // Post the state back to the main thread
    postMessage({
        type: 'state',
        angles: angles,
        lengths: lengths,
        masses: masses,
        currentEnergy: currentEnergy,
        initialEnergy: initialEnergy
    });
}, 1000 / 60); // 60 FPS update rate
