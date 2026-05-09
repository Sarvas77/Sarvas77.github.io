scene = canvas(title="", width=window.innerWidth, height=window.innerHeight, background=color.gray(0.05))
scene.camera.pos = vector(0, 0, 800)
scene.ambient = color.gray(0.2)

bodies = []
G = 1.0
dt = 0.01

def rotate3D(v, pitch, yaw, roll):
    y1 = v.y*cos(pitch) - v.z*sin(pitch)
    z1 = v.y*sin(pitch) + v.z*cos(pitch)
    x2 = v.x*cos(yaw) + z1*sin(yaw)
    z2 = -v.x*sin(yaw) + z1*cos(yaw)
    x3 = x2*cos(roll) - y1*sin(roll)
    y3 = x2*sin(roll) + y1*cos(roll)
    return vector(x3, y3, z2)

def clear_bodies():
    global bodies
    for b in bodies:
        b.visible = False
        if hasattr(b, 'glow'): b.glow.visible = False
        if hasattr(b, 'light'): b.light.visible = False
        b.clear_trail()
    bodies = []

def load_figure8():
    global bodies, G, dt
    clear_bodies()
    G = 10000.0
    dt = 0.01
    scale = 100
    vscale = 10
    
    pitch_ang = pi / 4
    yaw_ang = pi / 6
    
    p1 = rotate3D(vector(0.97000436, -0.24308753, 0), pitch_ang, yaw_ang, 0)
    p2 = rotate3D(vector(-0.97000436, 0.24308753, 0), pitch_ang, yaw_ang, 0)
    p3 = rotate3D(vector(0, 0, 0), pitch_ang, yaw_ang, 0)
    
    v3_base = vector(-0.93240737, -0.86473146, 0)
    v1 = rotate3D(vector(-v3_base.x/2, -v3_base.y/2, 0), pitch_ang, yaw_ang, 0)
    v2 = rotate3D(vector(-v3_base.x/2, -v3_base.y/2, 0), pitch_ang, yaw_ang, 0)
    v3 = rotate3D(v3_base, pitch_ang, yaw_ang, 0)
    
    colors = [color.red, color.cyan, color.blue]
    pos_arr = [p1, p2, p3]
    v_arr = [v1, v2, v3]
    
    for i in range(3):
        b = sphere(pos=pos_arr[i]*scale, radius=15, color=colors[i], make_trail=True, trail_type="curve", retain=350, trail_radius=2, emissive=True)
        b.m = 1.0
        b.v = v_arr[i]*vscale
        b.light = local_light(pos=b.pos, color=b.color)
        b.glow = sphere(pos=b.pos, radius=b.radius*2.0, color=b.color, opacity=0.2, shininess=0, emissive=True)
        bodies.append(b)
        
    scene.camera.pos = vector(0, 0, 400)

def load_binary():
    global bodies, G, dt
    clear_bodies()
    G = 1.0
    dt = 0.05
    
    vStar = sqrt(G * 100 / (4 * 50))
    s0_p = rotate3D(vector(-50, 0, 0), pi/6, 0, 0)
    s0_v = rotate3D(vector(0, vStar, 0), pi/6, 0, 0)
    
    s1_p = rotate3D(vector(50, 0, 0), pi/6, 0, 0)
    s1_v = rotate3D(vector(0, -vStar, 0), pi/6, 0, 0)
    
    rPlanet = 200
    aPlanet = G * 100 / (rPlanet - 50)**2 + G * 100 / (rPlanet + 50)**2
    vPlanet = sqrt(rPlanet * aPlanet)
    p_p = rotate3D(vector(rPlanet, 0, 0), -pi/8, pi/6, 0)
    p_v = rotate3D(vector(0, vPlanet, 0), -pi/8, pi/6, 0)
    
    stars = [
        {"p": s0_p, "v": s0_v, "m": 100, "r": 30, "c": color.orange},
        {"p": s1_p, "v": s1_v, "m": 100, "r": 30, "c": vector(1, 0.6, 0.2)},
        {"p": p_p, "v": p_v, "m": 0.1, "r": 12, "c": color.cyan}
    ]
    
    for s in stars:
        b = sphere(pos=s["p"], radius=s["r"], color=s["c"], make_trail=True, trail_type="curve", retain=350, trail_radius=1.5, emissive=True)
        b.m = s["m"]
        b.v = s["v"]
        if s["m"] > 50:
            b.light = local_light(pos=b.pos, color=b.color)
            b.glow = sphere(pos=b.pos, radius=b.radius*1.5, color=b.color, opacity=0.3, shininess=0, emissive=True)
        bodies.append(b)
        
    scene.camera.pos = vector(0, 0, 600)

def load_sunEarthMoon():
    global bodies, G, dt
    clear_bodies()
    G = 1.0
    dt = 0.02
    
    rEarth = 250
    vEarth = sqrt(G * 1000 / rEarth)
    e_p = rotate3D(vector(rEarth, 0, 0), pi/6, pi/4, 0)
    e_v = rotate3D(vector(0, vEarth, 0), pi/6, pi/4, 0)
    
    rMoon = 25
    vMoonMag = sqrt(G * 10 / rMoon)
    m_p_local = rotate3D(vector(rMoon, 0, 0), -pi/4, 0, 0)
    m_v_local = rotate3D(vector(0, vMoonMag, 0), -pi/4, 0, 0)
    
    objs = [
        {"p": vector(0,0,0), "v": vector(0,0,0), "m": 1000, "r": 40, "c": color.yellow},
        {"p": e_p, "v": e_v, "m": 10, "r": 15, "c": vector(0.4, 0.6, 1)},
        {"p": e_p + m_p_local, "v": e_v + m_v_local, "m": 0.1, "r": 8, "c": color.gray(0.8)}
    ]
    
    for s in objs:
        b = sphere(pos=s["p"], radius=s["r"], color=s["c"], make_trail=True, trail_type="curve", retain=400, trail_radius=1.5, emissive=True)
        b.m = s["m"]
        b.v = s["v"]
        if s["m"] > 50:
            b.light = local_light(pos=b.pos, color=b.color)
            b.glow = sphere(pos=b.pos, radius=b.radius*1.5, color=b.color, opacity=0.3, shininess=0, emissive=True)
        bodies.append(b)
        
    scene.camera.pos = vector(0, 0, 800)

def load_trojans():
    global bodies, G, dt
    clear_bodies()
    G = 1.0
    dt = 0.05
    
    rJup = 250
    vJup = sqrt(G * 1000 / rJup)
    tilt = pi / 5
    
    j_p = rotate3D(vector(rJup, 0, 0), tilt, 0, 0)
    j_v = rotate3D(vector(0, vJup, 0), tilt, 0, 0)
    
    angle4 = pi / 3
    l4_p = rotate3D(vector(rJup * cos(angle4), rJup * sin(angle4), 0), tilt, 0, 0)
    l4_v = rotate3D(vector(-vJup * sin(angle4), vJup * cos(angle4), 0), tilt, 0, 0)
    
    angle5 = -pi / 3
    l5_p = rotate3D(vector(rJup * cos(angle5), rJup * sin(angle5), 0), tilt, 0, 0)
    l5_v = rotate3D(vector(-vJup * sin(angle5), vJup * cos(angle5), 0), tilt, 0, 0)
    
    objs = [
        {"p": vector(0,0,0), "v": vector(0,0,0), "m": 1000, "r": 40, "c": color.yellow},
        {"p": j_p, "v": j_v, "m": 10, "r": 15, "c": vector(0.4, 0.6, 1)},
        {"p": l4_p, "v": l4_v, "m": 0.01, "r": 10, "c": color.red},
        {"p": l5_p, "v": l5_v, "m": 0.01, "r": 10, "c": color.red}
    ]
    
    for s in objs:
        b = sphere(pos=s["p"], radius=s["r"], color=s["c"], make_trail=True, trail_type="curve", retain=350, trail_radius=1.5, emissive=True)
        b.m = s["m"]
        b.v = s["v"]
        if s["m"] > 50:
            b.light = local_light(pos=b.pos, color=b.color)
            b.glow = sphere(pos=b.pos, radius=b.radius*1.5, color=b.color, opacity=0.3, shininess=0, emissive=True)
        bodies.append(b)
        
    scene.camera.pos = vector(0, 0, 800)

def get_derivatives(state):
    n = len(bodies)
    dy = [0]*(n*6)
    for i in range(n):
        idx = i * 6
        dy[idx]   = state[idx+3]
        dy[idx+1] = state[idx+4]
        dy[idx+2] = state[idx+5]
        
        ax = 0
        ay = 0
        az = 0
        for j in range(n):
            if i == j: continue
            jdx = j * 6
            dx = state[jdx] - state[idx]
            dy_pos = state[jdx+1] - state[idx+1]
            dz = state[jdx+2] - state[idx+2]
            
            distSq = dx*dx + dy_pos*dy_pos + dz*dz
            dist = sqrt(distSq + 0.1)
            
            force = (G * bodies[j].m) / (dist * distSq)
            ax += force * dx
            ay += force * dy_pos
            az += force * dz
            
        dy[idx+3] = ax
        dy[idx+4] = ay
        dy[idx+5] = az
    return dy

def rk4_step():
    n = len(bodies)
    state = [0]*(n*6)
    for i in range(n):
        idx = i * 6
        state[idx]   = bodies[i].pos.x
        state[idx+1] = bodies[i].pos.y
        state[idx+2] = bodies[i].pos.z
        state[idx+3] = bodies[i].v.x
        state[idx+4] = bodies[i].v.y
        state[idx+5] = bodies[i].v.z
        
    k1 = get_derivatives(state)
    
    temp = [0]*(n*6)
    for i in range(n*6): temp[i] = state[i] + k1[i]*dt*0.5
    k2 = get_derivatives(temp)
    
    for i in range(n*6): temp[i] = state[i] + k2[i]*dt*0.5
    k3 = get_derivatives(temp)
    
    for i in range(n*6): temp[i] = state[i] + k3[i]*dt
    k4 = get_derivatives(temp)
    
    for i in range(n):
        idx = i * 6
        bodies[i].pos.x += (k1[idx]   + 2.0*k2[idx]   + 2.0*k3[idx]   + k4[idx])   * dt / 6.0
        bodies[i].pos.y += (k1[idx+1] + 2.0*k2[idx+1] + 2.0*k3[idx+1] + k4[idx+1]) * dt / 6.0
        bodies[i].pos.z += (k1[idx+2] + 2.0*k2[idx+2] + 2.0*k3[idx+2] + k4[idx+2]) * dt / 6.0
        bodies[i].v.x   += (k1[idx+3] + 2.0*k2[idx+3] + 2.0*k3[idx+3] + k4[idx+3]) * dt / 6.0
        bodies[i].v.y   += (k1[idx+4] + 2.0*k2[idx+4] + 2.0*k3[idx+4] + k4[idx+4]) * dt / 6.0
        bodies[i].v.z   += (k1[idx+5] + 2.0*k2[idx+5] + 2.0*k3[idx+5] + k4[idx+5]) * dt / 6.0

        if hasattr(bodies[i], 'glow'):
            bodies[i].glow.pos = bodies[i].pos
        if hasattr(bodies[i], 'light'):
            bodies[i].light.pos = bodies[i].pos

current_config_internal = ""

while True:
    rate(60)
    
    if window.current_config != current_config_internal:
        current_config_internal = window.current_config
        if current_config_internal == "figure8": load_figure8()
        elif current_config_internal == "binary": load_binary()
        elif current_config_internal == "sunEarthMoon": load_sunEarthMoon()
        elif current_config_internal == "trojans": load_trojans()
        
    if window.sim_running:
        for _ in range(10):
            rk4_step()
