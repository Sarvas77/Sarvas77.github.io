document.addEventListener("DOMContentLoaded", () => {
    const sidebarHTML = `
        <a href="index.html" class="brand">
            <div class="brand-dot"></div>
            Sarvas77
        </a>

        <div class="nav-section-title">Overview</div>
        <ul class="nav-links">
            <li><a href="index.html" class="nav-link" data-page="index">Dashboard</a></li>
        </ul>

        <div class="nav-section-title">Simulations</div>
        <ul class="nav-links">
            <li><a href="phasemap.html" class="nav-link" data-page="phasemap">Pendulum Phasemap</a></li>
            <li><a href="pendulums.html" class="nav-link" data-page="pendulums">Rope & Pendulums</a></li>
            <li><a href="fluids.html" class="nav-link" data-page="fluids">Fluid Dynamics</a></li>
            <li><a href="gravity.html" class="nav-link" data-page="gravity">Gravity & Orbits</a></li>
        </ul>
    `;

    const sidebar = document.getElementById('global-sidebar');
    if (sidebar) {
        sidebar.innerHTML = sidebarHTML;

        // Highlight active link
        const path = window.location.pathname;
        let currentPage = 'index';
        if (path.includes('phasemap.html')) {
            currentPage = 'phasemap';
        } else if (path.includes('pendulums.html')) {
            currentPage = 'pendulums';
        } else if (path.includes('fluids.html')) {
            currentPage = 'fluids';
        } else if (path.includes('gravity.html')) {
            currentPage = 'gravity';
        } else if (path.endsWith('/') || path.includes('index.html')) {
            currentPage = 'index';
        }

        const activeLink = document.querySelector(`.nav-link[data-page="${currentPage}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }
});
