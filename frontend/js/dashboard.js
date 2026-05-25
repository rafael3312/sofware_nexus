// Estado global
let usuarios = [];
let usuarioActual = null;

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    inicializarDashboard();
    verificarAutenticacion();
    inicializarEventos();
    cargarDatosIniciales();
});

function inicializarDashboard() {
    // Configurar usuario actual
    usuarioActual = JSON.parse(localStorage.getItem('user'));

    if (!usuarioActual) {
        window.location.href = './login.html';
        return;
    }

    // Actualizar interfaz con datos del usuario
    actualizarInterfazUsuario();

    // Ocultar gestión de usuarios si no es propietario
    if (!usuarioActual.isOwner) {
        document.getElementById('menuUsuarios').style.display = 'none';
    }
}

function verificarAutenticacion() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = './login.html';
    }
}

function inicializarEventos() {
    // Navegación del sidebar
    document.querySelectorAll('.menu-link[data-section]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            mostrarSeccion(section);
        });
    });

    // Botones de acción rápida
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            mostrarSeccion(section);
        });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        cerrarSesion();
    });

    // Toggle sidebar móvil
    document.getElementById('mobileToggle').addEventListener('click', toggleSidebarMobile);
    document.getElementById('topbarToggle').addEventListener('click', toggleSidebarMobile);

    // Validación de contraseñas
    document.getElementById('confirmPassword')?.addEventListener('input', validarContraseñas);
    document.getElementById('modalConfirmPassword')?.addEventListener('input', validarContraseñasModal);
}

function actualizarInterfazUsuario() {
    // Actualizar topbar
    document.getElementById('topbarUserName').textContent = usuarioActual.username;
    document.getElementById('topbarUserRole').textContent = usuarioActual.isOwner ? 'Propietario' : 'Empleado';

    // Actualizar avatar
    const avatar = document.getElementById('userAvatar');
    avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(usuarioActual.username)}&background=4361ee&color=fff`;

    // Actualizar dashboard
    document.getElementById('userRoleBadge').textContent = usuarioActual.isOwner ? 'Admin' : 'Empleado';
}

function cargarDatosIniciales() {
    if (usuarioActual.isOwner) {
        cargarUsuarios();
    }
}

// Navegación entre secciones
function mostrarSeccion(sectionName) {
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });

    // Mostrar sección seleccionada
    const targetSection = document.getElementById(`section-${sectionName}`);
    if (targetSection) {
        targetSection.style.display = 'block';

        // Actualizar título
        const titles = {
            'dashboard': 'Dashboard Principal',
            'usuarios': 'Gestión de Empleados',
            'crear-usuario': 'Crear Nuevo Usuario',
            'proyectos': 'Gestión de Proyectos',
            'lotes': 'Gestión de Lotes'
        };

        document.getElementById('sectionTitle').textContent = titles[sectionName] || 'Dashboard';

        // Cargar datos específicos de la sección
        if (sectionName === 'usuarios') {
            cargarUsuarios();
        }
    }
}

// Gestión de usuarios
async function cargarUsuarios() {
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/api/usuarios', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            usuarios = await response.json();
            mostrarUsuarios(usuarios);
            actualizarEstadisticas();
        } else {
            mostrarAlerta('Error al cargar usuarios', 'danger');
        }
    } catch (error) {
        console.error('Error cargando usuarios:', error);
        mostrarAlerta('Error de conexión', 'danger');
    }
}

function mostrarUsuarios(usuarios) {
    const tbody = document.getElementById('tablaUsuarios');

    if (!usuarios || usuarios.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-4">
                    <span class="material-icons d-block mb-2" style="font-size: 48px; color: #dec2e6;">group</span>
                    No hay usuarios empleados registrados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';

    usuarios.forEach(usuario => {
        const tr = document.createElement('tr');
        const estadoBadge = usuario.is_active ? 
            '<span class="badge bg-success">Activo</span>' : 
            '<span class="badge bg-danger">Inactivo</span>';

        const botonEstado = usuario.is_active ? 
            `<button class="btn btn-sm btn-warning" onclick="toggleUsuario(${usuario.id})" title="Desactivar usuario">
                <span class="material-icons">toggle_off</span>
            </button>` :
            `<button class="btn btn-sm btn-success" onclick="toggleUsuario(${usuario.id})" title="Activar usuario">
                <span class="material-icons">toggle_on</span>
            </button>`;

        tr.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.username)}&background=6c757d&color=fff" 
                    alt="${usuario.username}" class="rounded-circle me-2" width="32" height="32">
                    ${usuario.username}
                </div>
            </td>
            <td>${usuario.email || '<span class="text-muted">N/A</span>'}</td>
            <td>${estadoBadge}</td>
            <td>${new Date(usuario.created_at).toLocaleDateString('es-ES')}</td>
            <td>
                <div class="btn-group">
                    ${botonEstado}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function actualizarEstadisticas() {
    const totalUsuarios = usuarios.length;
    const usuariosActivos = usuarios.filter(u => u.is_active).length;
    const usuariosInactivos = totalUsuarios - usuariosActivos;

    document.getElementById('totalUsuarios').textContent = totalUsuarios;
    document.getElementById('usuariosActivos').textContent = usuariosActivos;
    document.getElementById('usuariosInactivos').textContent = usuariosInactivos;
}

// Crear usuario desde el formulario principal
async function crearUsuario() {
    const token = localStorage.getItem('token');
    const username = document.getElementById('newUsername').value;
    const email = document.getElementById('newEmail').value;
    const password = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!validarFormularioUsuario(username, password, confirmPassword)) {
        return;
    }

    await ejecutarCreacionUsuario(token, username, email, password, 'form');
}

function validarFormularioUsuario(username, password, confirmPassword) {
    if (!username || !password) {
        mostrarAlerta('Usuario y contraseña son requeridos', 'warning');
        return false;
    }

    if (password.length < 6) {
        mostrarAlerta('La contraseña debe tener al menos 6 caracteres', 'warning');
        return false;
    }

    if (password !== confirmPassword) {
        mostrarAlerta('Las contraseñas no coinciden', 'warning');
        return false;
    }

    return true;
}

async function ejecutarCreacionUsuario(token, username, email, password, source) {
    const btnCrear = source === 'modal' ? 
        document.querySelector('#modalUsuario .btn-primary') : 
        document.getElementById('btnCrearUsuario');

    // Deshabilitar botón mientras se procesa
    const originalText = btnCrear.innerHTML;
    btnCrear.disabled = true;
    btnCrear.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Creando...`;

    try {
        const response = await fetch('/api/usuarios', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            mostrarAlerta('Usuario creado exitosamente', 'success');

            // Limpiar formularios
            if (source === 'modal') {
                document.getElementById('modalUsuario').querySelector('form').reset();
                bootstrap.Modal.getInstance(document.getElementById('modalUsuario')).hide();
            } else {
                document.getElementById('formUsuario').reset();
                mostrarSeccion('usuarios');
            }

            // Recargar lista
            cargarUsuarios();
        } else {
            mostrarAlerta(data.error || 'Error al crear usuario', 'danger');
        }
    } catch (error) {
        console.error('Error creando usuario', error);
        mostrarAlerta('Error de conexión', 'danger');
    } finally {
        btnCrear.disabled = false;
        btnCrear.innerHTML = originalText;
    }
}

// Validación de contraseñas en tiempo real
function validarContraseñas() {
    const password = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const btnCrear = document.getElementById('btnCrearUsuario');

    if (confirmPassword && password !== confirmPassword) {
        document.getElementById('confirmPassword').classList.add('is-invalid');
        if (btnCrear) btnCrear.disabled = true;
    } else {
        document.getElementById('confirmPassword').classList.remove('is-invalid');
        if (btnCrear) btnCrear.disabled = false;
    }
}

function validarContraseñasModal() {
    const password = document.getElementById('modalPassword').value;
    const confirmPassword = document.getElementById('modalConfirmPassword').value;
    const btnCrear = document.querySelector('#modalUsuario .btn-primary');

    if (confirmPassword && password !== confirmPassword) {
        document.getElementById('modalConfirmPassword').classList.add('is-invalid');
        if (btnCrear) btnCrear.disabled = true;
    } else {
        document.getElementById('modalConfirmPassword').classList.remove('is-invalid');
        if (btnCrear) btnCrear.disabled = false;
    }
}

// Toggle estado de usuario
async function toggleUsuario(userId) {
    const token = localStorage.getItem('token');
    const usuario = usuarios.find(u => u.id === userId);

    if (!usuario) return;

    const accion = usuario.is_active ? 'desactivar' : 'activar';

    if (!confirm(`¿Estás seguro de que quieres ${accion} este usuario?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/usuarios/${userId}/toggle`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            mostrarAlerta(data.message, 'success');
            cargarUsuarios(); // Recargar la lista
        } else {
            mostrarAlerta(data.error || 'Error al actualizar usuario', 'danger');
        }
    } catch (error) {
        console.error('Error actualizando usuario', error);
        mostrarAlerta('Error de conexión', 'danger');
    }
}

// Utilidades
function toggleSidebarMobile() {
    document.getElementById('sidebar').classList.toggle('mobile-open');
}

function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = './login.html';
}

function mostrarAlerta(mensaje, tipo) {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = 'alert-' + Date.now();

    const alertHTML = `
        <div id="${alertId}" class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            <div class="d-flex align-items-center">
                <span class="material-icons me-2">${tipo === 'success' ? 'check_circle' : tipo === 'warning' ? 'warning' : 'error'}</span>
                ${mensaje}
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;

    alertContainer.innerHTML = alertHTML;

    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }
    }, 5000);
}



