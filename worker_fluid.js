// --- Cyber-Fluid Navier-Stokes Solver ---
let size = 64;
let N = size;
let dt = 0.1;
let diffusion = 0.0001;
let viscosity = 0.0001;

let s = new Float32Array((N + 2) * (N + 2));
let density = new Float32Array((N + 2) * (N + 2));

let Vx = new Float32Array((N + 2) * (N + 2));
let Vy = new Float32Array((N + 2) * (N + 2));

let Vx0 = new Float32Array((N + 2) * (N + 2));
let Vy0 = new Float32Array((N + 2) * (N + 2));

// Loop
let intervalId = null;

onmessage = function(e) {
    const data = e.data;
    if (data.type === 'init') {
        size = data.size || 64;
        N = size;
        reset();
    } else if (data.type === 'stop') {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    } else if (data.type === 'start') {
        if (!intervalId) {
            intervalId = setInterval(() => {
                step();
                // Fade out density
                for (let i = 0; i < density.length; i++) {
                    density[i] *= 0.99;
                    Vx[i] *= 0.99; // Slowly dampen velocity
                    Vy[i] *= 0.99;
                }
                // Transfer buffer back
                postMessage({
                    type: 'update',
                    density: density,
                    Vx: Vx,
                    Vy: Vy
                });
            }, 1000 / 60);
        }
    } else if (data.type === 'input') {
        const i = data.i;
        const j = data.j;
        if (i < 1 || i > N || j < 1 || j > N) return;
        
        const idx = i + (N + 2) * j;
        density[idx] += data.amount || 100;
        Vx[idx] += data.vx || 0;
        Vy[idx] += data.vy || 0;
    }
};

function reset() {
    const len = (N + 2) * (N + 2);
    s.fill(0);
    density.fill(0);
    Vx.fill(0);
    Vy.fill(0);
    Vx0.fill(0);
    Vy0.fill(0);
}

function IX(x, y) {
    return x + (N + 2) * y;
}

function step() {
    diffuse(1, Vx0, Vx, viscosity, dt);
    diffuse(2, Vy0, Vy, viscosity, dt);

    project(Vx0, Vy0, Vx, Vy);

    advect(1, Vx, Vx0, Vx0, Vy0, dt);
    advect(2, Vy, Vy0, Vx0, Vy0, dt);

    project(Vx, Vy, Vx0, Vy0);

    diffuse(0, s, density, diffusion, dt);
    advect(0, density, s, Vx, Vy, dt);
}

function diffuse(b, x, x0, diff, dt) {
    let a = dt * diff * N * N;
    lin_solve(b, x, x0, a, 1 + 4 * a);
}

function lin_solve(b, x, x0, a, c) {
    for (let k = 0; k < 20; k++) {
        for (let j = 1; j <= N; j++) {
            for (let i = 1; i <= N; i++) {
                x[IX(i, j)] = (x0[IX(i, j)] + a * (x[IX(i - 1, j)] + x[IX(i + 1, j)] + x[IX(i, j - 1)] + x[IX(i, j + 1)])) / c;
            }
        }
        set_bnd(b, x);
    }
}

function project(velocX, velocY, p, div) {
    for (let j = 1; j <= N; j++) {
        for (let i = 1; i <= N; i++) {
            div[IX(i, j)] = -0.5 * (velocX[IX(i + 1, j)] - velocX[IX(i - 1, j)] + velocY[IX(i, j + 1)] - velocY[IX(i, j - 1)]) / N;
            p[IX(i, j)] = 0;
        }
    }
    set_bnd(0, div);
    set_bnd(0, p);
    lin_solve(0, p, div, 1, 4);

    for (let j = 1; j <= N; j++) {
        for (let i = 1; i <= N; i++) {
            velocX[IX(i, j)] -= 0.5 * (p[IX(i + 1, j)] - p[IX(i - 1, j)]) * N;
            velocY[IX(i, j)] -= 0.5 * (p[IX(i, j + 1)] - p[IX(i, j - 1)]) * N;
        }
    }
    set_bnd(1, velocX);
    set_bnd(2, velocY);
}

function advect(b, d, d0, velocX, velocY, dt) {
    let i0, i1, j0, j1;
    let dtx = dt * N;
    let dty = dt * N;
    let s0, s1, t0, t1;
    let tmp1, tmp2, x, y;

    for (let j = 1; j <= N; j++) {
        for (let i = 1; i <= N; i++) {
            tmp1 = dtx * velocX[IX(i, j)];
            tmp2 = dty * velocY[IX(i, j)];
            x = i - tmp1;
            y = j - tmp2;

            if (x < 0.5) x = 0.5;
            if (x > N + 0.5) x = N + 0.5;
            i0 = Math.floor(x);
            i1 = i0 + 1.0;
            if (y < 0.5) y = 0.5;
            if (y > N + 0.5) y = N + 0.5;
            j0 = Math.floor(y);
            j1 = j0 + 1.0;

            s1 = x - i0;
            s0 = 1.0 - s1;
            t1 = y - j0;
            t0 = 1.0 - t1;

            d[IX(i, j)] = s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j1)]) + s1 * (t0 * d0[IX(i1, j0)] + t1 * d0[IX(i1, j1)]);
        }
    }
    set_bnd(b, d);
}

function set_bnd(b, x) {
    for (let i = 1; i <= N; i++) {
        x[IX(0, i)] = b === 1 ? -x[IX(1, i)] : x[IX(1, i)];
        x[IX(N + 1, i)] = b === 1 ? -x[IX(N, i)] : x[IX(N, i)];
        x[IX(i, 0)] = b === 2 ? -x[IX(i, 1)] : x[IX(i, 1)];
        x[IX(i, N + 1)] = b === 2 ? -x[IX(i, N)] : x[IX(i, N)];
    }
    x[IX(0, 0)] = 0.5 * (x[IX(1, 0)] + x[IX(0, 1)]);
    x[IX(0, N + 1)] = 0.5 * (x[IX(1, N + 1)] + x[IX(0, N)]);
    x[IX(N + 1, 0)] = 0.5 * (x[IX(N, 0)] + x[IX(N + 1, 1)]);
    x[IX(N + 1, N + 1)] = 0.5 * (x[IX(N, N + 1)] + x[IX(N + 1, N)]);
}
