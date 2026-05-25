class NexusApp {
    constructor() {
        this.user = JSON.parse(localStorage.getItem('user'));
        this.token = localStorage.getItem('token');
        this.container = document.getElementById('moduleContainer');
        
        // Mapa de Módulos
        this.modules = {
            'dashboard': { 
                title: 'Resumen General', 
                html: 'modulos/dashboard.html', 
                script: 'js/modulos/dashboard.js' },
            'usuarios': { 
                title: 'Gestión de Personal', 
                html: 'modulos/usuarios.html', 
                script: 'js/modulos/usuarios.js' },
            'proyectos': { 
                title: 'Proyectos Urbanísticos', 
                html: 'modulos/proyectos.html', 
                script: 'js/modulos/proyectos.js' },
            'lotes': { 
                title: 'Inventario y Unidades', 
                html: 'modulos/lotes.html', 
                script: 'js/modulos/lotes.js' },
            'clientes': { 
                title: 'Gestión de Clientes', 
                html: 'modulos/clientes.html', 
                script: 'js/modulos/clientes.js' },
            'ventas': { 
                title: 'Ventas y Contratos', 
                html: 'modulos/ventas.html', 
                script: 'js/modulos/ventas.js' },
            'pagos': { 
                title: 'Cartera y Cobranzas', 
                html: 'modulos/pagos.html', 
                script: 'js/modulos/pagos.js' },
            'reportes': { 
                title: 'Reportes y Exportación', 
                html: 'modulos/reportes.html', 
                script: 'js/modulos/reportes.js' },
            'mapa': { 
                title: 'Masterplan Interactivo', 
                html: 'modulos/mapa.html', 
                script: 'js/modulos/mapa.js' },
            'configuracion': { 
                title: 'Configuración de Empresa', 
                html: 'modulos/configuracion.html', 
                script: 'js/modulos/configuracion.js' },
            'perfil': { 
                title: 'Mi Perfil', 
                html: 'modulos/perfil.html', 
                script: 'js/modulos/perfil.js' }
        };

        this.init();
    }

    init() {
        if (!this.token || !this.user) {
            window.location.href = 'login.html';
            return;
        }

        this.setupUI();
        this.setupEventListeners();

        // --- LÓGICA DE CARGA INICIAL INTELIGENTE ---
        // Si es Owner, entra al Dashboard.
        // Si es Empleado, entra a su primer módulo permitido o a Perfil.
        if (this.user.isOwner) {
            this.loadModule('dashboard');
        } else {
            // Buscamos el primer módulo real que tenga permitido
            const primerModulo = this.user.allowedModules && this.user.allowedModules.length > 0 
                ? this.user.allowedModules[0] 
                : 'perfil';
            
            this.loadModule(primerModulo);
        }
    }

    setupUI() {
        // Datos del usuario en Topbar
        document.getElementById('userName').textContent = this.user.username;
        document.getElementById('userRole').textContent = this.user.isOwner ? 'Propietario' : 'Colaborador';
        document.getElementById('userAvatar').src = this.user.foto_perfil 
            ? `http://localhost:3000${this.user.foto_perfil}` 
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(this.user.username)}&background=0D8ABC&color=fff`;

        // --- LÓGICA DE PERMISOS VISUALES (MENU) ---
        
        // 1. Ocultar botón de configuración de Empresa si no es Owner (En el dropdown)
        if (!this.user.isOwner) {
            const btnEmpresa = document.getElementById('btnMenuEmpresa');
            if (btnEmpresa) btnEmpresa.style.display = 'none';
        }

        // 2. Filtrar Sidebar (Menú Lateral)
        const permisos = this.user.allowedModules || [];
        const links = document.querySelectorAll('.sidebar-menu a[data-module]');

        links.forEach(link => {
            const modulo = link.getAttribute('data-module');

            // CASO 1: Perfil (Siempre visible para todos)
            if (modulo === 'perfil') return;

            // CASO 2: Dashboard (SOLO visible para Owner)
            if (modulo === 'dashboard') {
                if (!this.user.isOwner) {
                    link.style.display = 'none'; // Ocultar
                }
                return;
            }

            // CASO 3: Gestión de Usuarios (SOLO visible para Owner)
            // (Asumimos que no está en la lista de permisos estándar de empleados)
            if (modulo === 'usuarios') {
                if (!this.user.isOwner) {
                    link.style.display = 'none';
                }
                return;
            }

            // CASO 4: Resto de módulos (Según permisos asignados)
            if (!this.user.isOwner && !permisos.includes(modulo)) {
                link.style.display = 'none';
            }
        });
    }

    setupEventListeners() {
        // Logout
        const btnLogout = document.getElementById('logoutBtn');
        if(btnLogout) {
            btnLogout.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.clear();
                window.location.href = 'login.html';
            });
        }

        // Toggle Sidebar
        const btnToggle = document.getElementById('sidebarToggle');
        if(btnToggle) {
            btnToggle.addEventListener('click', () => {
                document.querySelector('.sidebar').classList.toggle('collapsed');
                document.querySelector('.main-content').classList.toggle('expanded');
            });
        }

        // Dark Mode
        const btnDark = document.getElementById('darkModeBtn');
        if(btnDark) {
            btnDark.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
                const isDark = document.body.classList.contains('dark-mode');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
            });
        }
        // Cargar tema guardado
        if(localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
        }

        // Navegación Global
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.menu-link');
            if (link) {
                e.preventDefault();
                
                // Efecto visual activo
                if(link.closest('.sidebar-menu')) {
                    document.querySelectorAll('.sidebar-menu .menu-link').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }

                const moduleName = link.getAttribute('data-module');
                if (moduleName) this.loadModule(moduleName);
            }
        });
    }

    async loadModule(moduleName) {
        const config = this.modules[moduleName];
        if (!config) return;

        // SEGURIDAD FRONTEND ADICIONAL
        // Si no es owner y intenta cargar dashboard o usuarios manualmente, lo bloqueamos
        if (!this.user.isOwner && (moduleName === 'dashboard' || moduleName === 'usuarios')) {
            alert('Acceso Denegado: Módulo restringido al propietario.');
            return;
        }

        // Spinner
        this.container.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="height: 400px;">
                <div class="spinner-border text-primary" role="status"></div>
            </div>`;
        
        const titleEl = document.getElementById('sectionTitle');
        if(titleEl) titleEl.textContent = config.title;

        try {
            // Cargar HTML
            const res = await fetch(config.html);
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const html = await res.text();
            this.container.innerHTML = html;

            // Cargar Script
            if (config.script) {
                await this.loadScript(config.script, moduleName);
            }
        } catch (error) {
            console.error(error);
            this.container.innerHTML = `<div class="alert alert-danger">Error cargando módulo: ${error.message}</div>`;
        }
    }

    loadScript(src, moduleName) {
        return new Promise((resolve, reject) => {
            const globalInstance = `module_${moduleName}`;
            
            // Si ya existe y tiene init, lo ejecutamos (Recarga)
            if (window[globalInstance] && typeof window[globalInstance].init === 'function') {
                window[globalInstance].init();
                return resolve();
            }

            // Si no, inyectamos el script
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                if (window[globalInstance] && typeof window[globalInstance].init === 'function') {
                    window[globalInstance].init();
                }
                resolve();
            };
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }
}

// Iniciar App
document.addEventListener('DOMContentLoaded', () => new NexusApp());