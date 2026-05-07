// --- Physical Pendulum & Rope Worker ---
let TOTAL_MASS = 10;
let TOTAL_LENGTH = 0;
let N = 4;
let accumulatedFrictionLoss = 0;
let lengths = [];
let masses = [];
let angles = [];
let aVels = [];

const g = 981;
let mu = [], coeffMatrix = [];

// Energy Tracking Variables
let initialEnergy = 0, currentEnergy = 0, groundLevel = 0;

// Interaction
let draggedMass = -1;
let k_bend = 0;
let d_friction = 0;
let isRopeMode = false;
let isPaused = true;
let targetX = 0, targetY = 0;

// ROPE MODE Variables (Position-Based Dynamics)
let ropeParticles = [];
let ropeSegments = [];
const ROPE_ITERATIONS = 50;

onmessage = function(e) {
    const data = e.data;
    switch (data.type) {
        case 'init_rigid':
            isRopeMode = false;
            TOTAL_LENGTH = data.totalLength;
            k_bend = data.k_bend;
            d_friction = data.d_friction;
            initPendulum(data.N);
            break;
        case 'init_rope':
            isRopeMode = true;
            TOTAL_LENGTH = data.totalLength;
            d_friction = data.d_friction;
            k_bend = 0;
            initRope(data.N);
            break;
        case 'update_params':
            k_bend = data.k_bend;
            d_friction = data.d_friction;
            if (!isRopeMode && data.recalcEnergy) {
                initialEnergy = calculateTotalEnergy();
            }
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
                if (!isRopeMode) {
                    initialEnergy = calculateTotalEnergy();
                    accumulatedFrictionLoss = 0;
                }
                draggedMass = -1;
            }
            break;
    }
};

function initPendulum(newN) {
    N = newN;
    lengths = [];
    masses = [];
    angles = [];
    aVels = [];
    groundLevel = 0;
    draggedMass = -1;
    accumulatedFrictionLoss = 0;

    let l = TOTAL_LENGTH / N;
    let m = TOTAL_MASS / N;

    for (let i = 0; i < N; i++) {
        lengths.push(l);
        masses.push(m);
        angles.push(Math.PI / 2);
        aVels.push(0);
        groundLevel -= l;
    }

    precomputeConstants();
    initialEnergy = calculateTotalEnergy();
    currentEnergy = initialEnergy;
}

function initRope(newN) {
    N = newN;
    draggedMass = -1;
    ropeParticles = [];
    ropeSegments = [];

    let l = TOTAL_LENGTH / N;
    let m = TOTAL_MASS / N;

    for (let i = 0; i <= N; i++) {
        let droop = (i > 0) ? (i * i * 0.05) : 0;
        ropeParticles.push({
            x: l * i, y: droop,
            old_x: l * i, old_y: droop,
            mass: i === 0 ? 0 : m,
            pinned: i === 0
        });
    }

    for (let i = 0; i < N; i++) {
        ropeSegments.push({
            p1: i, // Store indices instead of object references for easier worker serialization later if needed, but here we can keep it as is
            p2: i + 1,
            length: l
        });
    }

    initialEnergy = 0;
    currentEnergy = 0;
}

function precomputeConstants() {
    mu = [];
    coeffMatrix = [];
    for (let i = 0; i < N; i++) {
        let sum = 0;
        sum += masses[i] / 2;
        for (let k = i + 1; k < N; k++) sum += masses[k];
        mu[i] = sum;
    }
    for (let i = 0; i < N; i++) {
        coeffMatrix[i] = [];
        for (let j = 0; j < N; j++) {
            if (i === j) {
                let sumSelf = masses[i] / 3;
                for (let k = i + 1; k < N; k++) sumSelf += masses[k];
                coeffMatrix[i][j] = sumSelf * lengths[i] * lengths[j];
            } else {
                let maxIdx = Math.max(i, j);
                coeffMatrix[i][j] = mu[maxIdx] * lengths[i] * lengths[j];
            }
        }
    }
}

function calculateTotalEnergy() {
    if (N === 0) return 0;
    let K = 0, U = 0;
    for (let i = 0; i < N; i++) {
        let v_tip_x = 0, v_tip_y = 0, y_tip = 0;
        for (let k = 0; k < i; k++) {
            v_tip_x += lengths[k] * aVels[k] * Math.cos(angles[k]);
            v_tip_y += -lengths[k] * aVels[k] * Math.sin(angles[k]);
            y_tip += -lengths[k] * Math.cos(angles[k]);
        }

        let v_cm_x = v_tip_x + (lengths[i] / 2) * aVels[i] * Math.cos(angles[i]);
        let v_cm_y = v_tip_y - (lengths[i] / 2) * aVels[i] * Math.sin(angles[i]);
        let y_cm = y_tip - (lengths[i] / 2) * Math.cos(angles[i]);

        let K_trans = 0.5 * masses[i] * (v_cm_x * v_cm_x + v_cm_y * v_cm_y);
        let K_rot = 0.5 * (masses[i] / 12) * lengths[i] * lengths[i] * aVels[i] * aVels[i];

        K += K_trans + K_rot;
        U += masses[i] * g * (y_cm - groundLevel);
    }

    let U_bend = 0;
    for (let i = 0; i < N - 1; i++) {
        let dTheta = angles[i + 1] - angles[i];
        dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
        let segmentStiffness = k_bend * (N / lengths[i]);
        U_bend += 0.5 * segmentStiffness * dTheta * dTheta;
    }

    return K + U + U_bend;
}

function rk4Step(dt) {
    const clone = (arr) => arr.slice();
    let a1 = calculateAccelerations(angles, aVels, dt);
    let k1v = clone(a1.accels), k1p = clone(aVels);
    let midA1 = angles.map((a, i) => a + k1p[i] * (dt / 2));
    let midV1 = aVels.map((v, i) => v + k1v[i] * (dt / 2));
    let a2 = calculateAccelerations(midA1, midV1, dt);
    let k2v = clone(a2.accels), k2p = clone(midV1);
    let midA2 = angles.map((a, i) => a + k2p[i] * (dt / 2));
    let midV2 = aVels.map((v, i) => v + k2v[i] * (dt / 2));
    let a3 = calculateAccelerations(midA2, midV2, dt);
    let k3v = clone(a3.accels), k3p = clone(midV2);
    let endA = angles.map((a, i) => a + k3p[i] * dt);
    let endV = aVels.map((v, i) => v + k3v[i] * dt);
    let a4 = calculateAccelerations(endA, endV, dt);
    let k4v = clone(a4.accels), k4p = clone(endV);

    for (let i = 0; i < N; i++) {
        accumulatedFrictionLoss -= a2.frictionTorques[i] * midV1[i] * dt;
    }

    for (let i = 0; i < N; i++) {
        aVels[i] += (dt / 6) * (k1v[i] + 2 * k2v[i] + 2 * k3v[i] + k4v[i]);
        angles[i] += (dt / 6) * (k1p[i] + 2 * k2p[i] + 2 * k3p[i] + k4p[i]);
    }
}

function calculateAccelerations(theta, omega, dt_sim) {
    let M = [], C = [];
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

    let structureTorques = new Array(N).fill(0);
    let currentFrictionTorques = new Array(N).fill(0);

    for (let i = 0; i < N - 1; i++) {
        let dTheta = theta[i + 1] - theta[i];
        dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));

        let segmentStiffness = k_bend * (N / lengths[i]);
        let torque = segmentStiffness * dTheta;

        let I_rel = coeffMatrix[i + 1][i + 1];
        let max_safe_torque = (I_rel * 2.0) / (dt_sim * dt_sim);
        if (Math.abs(torque) > max_safe_torque) {
            torque = Math.sign(torque) * max_safe_torque;
        }

        let dOmega = omega[i + 1] - omega[i];
        let frictionTorque = d_friction * dOmega * (N / lengths[i]) * 0.01;

        let max_damping_torque = (I_rel * Math.abs(dOmega)) / dt_sim;
        let safe_limit = max_damping_torque * 0.5;
        if (Math.abs(frictionTorque) > safe_limit) {
            frictionTorque = Math.sign(frictionTorque) * safe_limit;
        }

        structureTorques[i + 1] -= torque;
        structureTorques[i] += torque;
        currentFrictionTorques[i + 1] -= frictionTorque;
        currentFrictionTorques[i] += frictionTorque;
    }

    for (let i = 0; i < N; i++) {
        M[i] = [];
        let Ci = -mu[i] * g * lengths[i] * Math.sin(theta[i]);
        let centrifugal = 0;

        for (let j = 0; j < N; j++) {
            let diff = theta[i] - theta[j];
            M[i][j] = coeffMatrix[i][j] * Math.cos(diff);
            if (i === j) M[i][j] += 1e-6;
            centrifugal += coeffMatrix[i][j] * Math.sin(diff) * omega[j] * omega[j];
        }

        let externalTorque = 0;
        if (draggedMass !== -1 && i <= draggedMass) {
            externalTorque = fx * lengths[i] * Math.cos(theta[i]) - fy * lengths[i] * Math.sin(theta[i]);
        }

        C.push([Ci - centrifugal + externalTorque + structureTorques[i] + currentFrictionTorques[i]]);
    }
    return {
        accels: fastMatrixSolve(M, C),
        frictionTorques: currentFrictionTorques
    };
}

function fastMatrixSolve(M, C) {
    let n = M.length;
    for (let i = 0; i < n; i++) {
        let maxRow = i;
        for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;

        [M[i], M[maxRow]] = [M[maxRow], M[i]];
        [C[i], C[maxRow]] = [C[maxRow], C[i]];

        if (Math.abs(M[i][i]) < 1e-12) {
            M[i][i] = 1e-12 * Math.sign(M[i][i] || 1);
        }

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

        if (Math.abs(M[i][i]) < 1e-12) {
            M[i][i] = 1e-12 * Math.sign(M[i][i] || 1);
        }
        result[i] = (C[i][0] - sum) / M[i][i];
    }
    return result;
}

function stepRopePBD() {
    let dt = isPaused ? 0 : 0.015;

    for (let i = 0; i <= N; i++) {
        let p = ropeParticles[i];
        if (p.pinned) continue;

        let vx = isPaused ? 0 : (p.x - p.old_x);
        let vy = isPaused ? 0 : (p.y - p.old_y);

        let rawFrictionSlider = d_friction / 10000;
        let drag = 1.0 - Math.pow(rawFrictionSlider / 100.0, 5) * 0.5;
        vx *= drag;
        vy *= drag;

        p.old_x = p.x;
        p.old_y = p.y;

        let ax = 0;
        let ay = isPaused ? 0 : g * 0.5;

        if (i === draggedMass) {
            p.x = targetX;
            p.y = targetY;
            if (isPaused) {
                p.old_x = p.x;
                p.old_y = p.y;
            }
        }

        p.x += vx + ax * dt * dt;
        p.y += vy + ay * dt * dt;
    }

    let stiffnessBendRelax = Math.min(0.95, k_bend / 500000);

    for (let iter = 0; iter < ROPE_ITERATIONS; iter++) {
        for (let seg of ropeSegments) {
            let p1 = ropeParticles[seg.p1];
            let p2 = ropeParticles[seg.p2];
            let dx = p2.x - p1.x;
            let dy = p2.y - p1.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) continue;

            let diff = (seg.length - dist) / dist;
            let tx = dx * diff * 0.5;
            let ty = dy * diff * 0.5;

            if (!p1.pinned) { p1.x -= tx; p1.y -= ty; }
            if (!p2.pinned) { p2.x += tx; p2.y += ty; }
        }

        if (stiffnessBendRelax > 0) {
            for (let i = 0; i < N - 1; i++) {
                let p0 = ropeParticles[i];
                let p1 = ropeParticles[i + 1];
                let p2 = ropeParticles[i + 2];

                let v1x = p1.x - p0.x;
                let v1y = p1.y - p0.y;
                let v2x = p2.x - p1.x;
                let v2y = p2.y - p1.y;

                let cross = v1x * v2y - v1y * v2x;
                if (Math.abs(cross) > 1e-4) {
                    let restoreFactor = stiffnessBendRelax * 0.1;
                    if (!p0.pinned) { p0.x -= v2y * restoreFactor; p0.y += v2x * restoreFactor; }
                    if (!p1.pinned) { p1.x += (v2y - v1y) * restoreFactor; p1.y -= (v2x - v1x) * restoreFactor; }
                    if (!p2.pinned) { p2.x += v1y * restoreFactor; p2.y -= v1x * restoreFactor; }
                }
            }
        }
    }
    ropeParticles[0].x = 0; ropeParticles[0].y = 0; // lock pin
}

// Main Physics Loop
setInterval(() => {
    if (N === 0) return;

    if (isRopeMode) {
        stepRopePBD();
        // Since we can't send object references with functions easily, we map to simple arrays for fast transfer
        let r_x = ropeParticles.map(p => p.x);
        let r_y = ropeParticles.map(p => p.y);
        
        postMessage({
            type: 'state',
            isRopeMode: true,
            rope_x: r_x,
            rope_y: r_y,
            currentEnergy: 0,
            initialEnergy: 0,
            accumulatedFrictionLoss: 0
        });
    } else {
        if (!isPaused) {
            let subSteps = 5 + Math.floor(N * 2) + Math.floor(k_bend / 50000);
            if (subSteps > 80) subSteps = 80;
            let dt = 0.015 / subSteps;
            for (let step = 0; step < subSteps; step++) {
                rk4Step(dt);
            }
            currentEnergy = calculateTotalEnergy();
        }

        postMessage({
            type: 'state',
            isRopeMode: false,
            angles: angles,
            lengths: lengths,
            masses: masses,
            currentEnergy: currentEnergy,
            initialEnergy: initialEnergy,
            accumulatedFrictionLoss: accumulatedFrictionLoss
        });
    }
}, 1000 / 60);
