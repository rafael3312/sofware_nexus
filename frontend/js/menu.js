class MenuManager {
    constructor() {
        this.currentSection = 'dashboard';
        this.init();
    }

    init() {
        this.setupMenuEvents();
        this.setupUserInfo();
        this.loadInitialSection();
    }

    setupMenuEvents() {
        // Eventos para items principales del menú
        document.querySelectorAll('.menu-link[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.currentTarget.getAttribute('data-section');
                this.showSection(section);
                // Cerrar submenús al hacer clic en un item
                this.closeAllSubmenus();
            });
        });

        // Eventos para submenús
        document.querySelectorAll('.has-submenu > .menu-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const parent = e.currentTarget.parentElement;
                this.toggleSubmenu(parent);
            });
        });

        // Evento para el toggle del sidebar en móviles
        document.getElementById('mobileToggle').addEventListener('click', () => {
            this.toggleMobileSidebar();
        });

        document.getElementById('topbarToggle').addEventListener('click', () => {
            this.toggleMobileSidebar();
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Cerrar menús al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.sidebar') && !e.target.closest('.topbar-toggle')) {
                this.closeAllSubmenus();
            }
        });
    }

    setupUserInfo() {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user) {
            // Actualizar topbar
            document.getElementById('userName').textContent = user.username;
            document.getElementById('userRole').textContent = user.isOwner ? 'Propietario' : 'Empleado';
            // Actualizar avatar
            const avatar = document.getElementById('userAvatar');
            if (avatar) {
                avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=4361ee&color=fff`;
            }
            // Ocultar gestión de usuarios si no es owner
            if (!user.isOwner) {
                const menuUsuarios = document.getElementById('menuUsuarios');
                if (menuUsuarios) {
                    menuUsuarios.style.display = 'none';
                }
            }
        }
    }

    showSection(sectionName) {
        // Ocultar todas las secciones
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });
        // Mostrar sección seleccionada
        const targetSection = document.getElementById(`section-${sectionName}`);
        if (targetSection) {
            targetSection.style.display = 'block';
            this.currentSection = sectionName;
            // Actualizar título
            this.updateSectionTitle(sectionName);
            // Actualizar menú activo
            this.updateActiveMenu(sectionName);
            // Cargar datos específicos de la sección
            this.loadSectionData(sectionName);
        }
    }

    updateSectionTitle(sectionName) {
        const titles = {
            'dashboard': 'Dashboard Principal',
            'usuarios': 'Gestión de Empleados',
            'crear-usuario': 'Crear Usuario',
            'proyectos': 'Gestión de Proyectos',
            'lotes': 'Gestión de Lotes'
        };
        const titleElement = document.querySelector('.topbar-title');
        if (titleElement) {
            titleElement.textContent = titles[sectionName] || 'Dashboard';
        }
    }

    updateActiveMenu(sectionName) {
        // Remover active de todos los items
        document.querySelectorAll('.menu-link').forEach(link => {
            link.classList.remove('active');
        });
        // Agregar active al item correspondiente
        const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeLink) {
            activeLink.classList.add('active');

            // También activar el padre si está en un submenu
            const parentMenu = activeLink.closest('.has-submenu');
            if (parentMenu) {
                parentMenu.querySelector('> .menu-link').classList.add('active');
            }
        }
    }

    toggleSubmenu(menuItem) {
        const isActive = menuItem.classList.contains('active');

        // Cerrar todos los submenús primero
        this.closeAllSubmenus();

        // Abrir el submenú clickeado si no estaba activo
        if (!isActive) {
            menuItem.classList.add('active');
        }
    }

    closeAllSubmenus() {
        document.querySelectorAll('.has-submenu').forEach(menu => {
            menu.classList.remove('active');
        });
    }

    toggleMobileSidebar() {
        document.getElementById('sidebar').classList.toggle('mobile-open');
    }

    loadSectionData(sectionName) {
        switch(sectionName) {
            case 'usuarios':
                if (typeof window.usuariosModule !== 'undefined') {
                    window.usuariosModule.cargarUsuarios();
                }
                break;
            case 'proyectos':
                if (typeof window.proyectosModule !== 'undefined') {
                    window.proyectosModule.cargarProyectos();
                }
                break;
            case 'lotes':
                if (typeof window.lotesModule !== 'undefined') {
                    window.lotesModule.cargarLotes();
                }
                break;
        }
    }

    loadInitialSection() {
        // Mostrar la sección dashboard por defecto
        this.showSection('dashboard');
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = './login.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.menuManager = new MenuManager();
});