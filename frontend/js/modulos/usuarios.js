class UsuariosModule {
    constructor() {
        this.apiBase = 'http://localhost:3000/api/usuarios';
        this.token = localStorage.getItem('token');
        this.tbody = null;
        this.modalCrear = null;
        this.modalEditar = null;
    }

    init() {
        console.log('Módulo Usuarios Recargado');
        this.tbody = document.getElementById('listaUsuariosBody');
        
        const elModalCrear = document.getElementById('modalUsuario');
        if (elModalCrear) this.modalCrear = new bootstrap.Modal(elModalCrear);

        const elModalEditar = document.getElementById('modalEditarUsuario');
        if (elModalEditar) this.modalEditar = new bootstrap.Modal(elModalEditar);

        this.cargarUsuarios();
    }

    async cargarUsuarios() {
        if (!this.tbody) return;
        try {
            this.tbody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border text-primary spinner-border-sm"></div> Cargando...</td></tr>';
            const res = await fetch(this.apiBase, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const usuarios = await res.json();
            this.renderTabla(usuarios);
        } catch (error) {
            console.error(error);
            this.tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error de conexión</td></tr>';
        }
    }

    renderTabla(usuarios) {
        if (usuarios.length === 0) {
            this.tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No hay empleados registrados.</td></tr>';
            return;
        }
        this.tbody.innerHTML = usuarios.map(u => `
            <tr>
                <td class="ps-4">
                    <div class="fw-bold text-dark">${u.primer_nombre} ${u.primer_apellido}</div>
                    <small class="text-muted">${u.email || 'Sin correo'}</small>
                </td>
                <td><span class="badge bg-light text-dark border">${u.numero_documento}</span></td>
                <td>${u.username}</td>
                <td><span class="badge ${u.is_active ? 'bg-success' : 'bg-danger'}">${u.is_active ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary" onclick="module_usuarios.abrirModalEdicion(${u.id})">
                            <span class="material-icons fs-6">edit</span>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="module_usuarios.toggleEstado(${u.id})">
                            <span class="material-icons fs-6">power_settings_new</span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // --- 2. CREAR (CORREGIDO) ---
    async crearUsuario() {
        const form = document.getElementById('formCrearUsuario');
        const formData = new FormData(form);
        
        // CORRECCIÓN: Los IDs en tu HTML usan el prefijo "perm_"
        const modulosPosibles = ['proyectos', 'lotes', 'clientes', 'ventas', 'pagos', 'reportes', 'mapa'];
        const modules = [];
        
        modulosPosibles.forEach(m => {
            const el = document.getElementById(`perm_${m}`);
            if (el && el.checked) modules.push(m);
        });

        const data = Object.fromEntries(formData.entries());
        data.modules = modules; // Enviamos el array de strings al backend

        try {
            const res = await fetch(this.apiBase, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(data)
            });

            const result = await res.json();
            if (res.ok) {
                alert('Empleado creado exitosamente');
                this.modalCrear.hide();
                form.reset();
                this.cargarUsuarios();
            } else {
                alert(result.error || 'Error al crear usuario');
            }
        } catch (error) {
            alert('Error de conexión');
        }
    }

    // --- 3. EDITAR (CORREGIDO) ---
    async abrirModalEdicion(id) {
        try {
            const res = await fetch(`${this.apiBase}/${id}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const user = await res.json();

            if (!res.ok) throw new Error(user.error);

            // Llenar datos básicos
            document.getElementById('editUserId').value = user.id;
            document.getElementById('editPrimerNombre').value = user.primer_nombre;
            document.getElementById('editSegundoNombre').value = user.segundo_nombre || '';
            document.getElementById('editPrimerApellido').value = user.primer_apellido;
            document.getElementById('editSegundoApellido').value = user.segundo_apellido || '';
            document.getElementById('editEmail').value = user.email || '';

            // CORRECCIÓN: Limpiar y marcar checkboxes de edición usando "edit_perm_"
            const modulosPosibles = ['proyectos', 'lotes', 'clientes', 'ventas', 'pagos', 'reportes', 'mapa'];
            
            modulosPosibles.forEach(m => {
                const check = document.getElementById(`edit_perm_${m}`);
                if (check) {
                    // Si el nombre del módulo viene en el array user.modules, marcarlo
                    check.checked = user.modules.includes(m);
                }
            });

            this.modalEditar.show();
        } catch (error) {
            console.error(error);
            alert('No se pudo cargar la información del usuario');
        }
    }

    // --- 4. GUARDAR EDICIÓN (CORREGIDO) ---
    async guardarEdicion() {
        const form = document.getElementById('formEditarUsuario');
        const userId = document.getElementById('editUserId').value;
        const formData = new FormData(form);

        // CORRECCIÓN: Recoger módulos del modal de edición
        const modulosPosibles = ['proyectos', 'lotes', 'clientes', 'ventas', 'pagos', 'reportes', 'mapa'];
        const modules = [];
        
        modulosPosibles.forEach(m => {
            const el = document.getElementById(`edit_perm_${m}`);
            if (el && el.checked) modules.push(m);
        });

        const data = Object.fromEntries(formData.entries());
        data.modules = modules;

        try {
            const res = await fetch(`${this.apiBase}/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                alert('Usuario actualizado');
                this.modalEditar.hide();
                this.cargarUsuarios();
            } else {
                const result = await res.json();
                alert(result.error);
            }
        } catch (error) {
            alert('Error de conexión');
        }
    }

    async toggleEstado(id) {
        if(!confirm('¿Cambiar estado de acceso de este usuario?')) return;
        try {
            await fetch(`${this.apiBase}/${id}/toggle`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            this.cargarUsuarios();
        } catch (error) {
            alert('Error al actualizar estado');
        }
    }
}

window.module_usuarios = new UsuariosModule();