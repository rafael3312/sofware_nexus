class PerfilModule {
    constructor() {
        this.apiBase = 'http://localhost:3000/api/perfil';
        this.token = localStorage.getItem('token');
        this.tipoUsuario = null;
    }

    init() {
        console.log('👤 Módulo Perfil Cargado');
        this.cargarDatos();
    }

    async cargarDatos() {
        try {
            const res = await fetch(this.apiBase, { headers: { 'Authorization': `Bearer ${this.token}` } });
            const user = await res.json();
            
            this.tipoUsuario = user.tipo_usuario; // 'owner' o 'empleado'

            // Llenar Header
            document.getElementById('lblUsername').textContent = user.username;
            document.getElementById('lblRol').textContent = user.tipo_usuario === 'owner' ? 'Propietario / Admin' : 'Colaborador';
            
            // Foto
            if(user.foto_perfil) {
                document.getElementById('imgPerfilPreview').src = `http://localhost:3000${user.foto_perfil}`;
            }

            // Llenar Campos Comunes
            const form = document.getElementById('formPerfil');
            form.email.value = user.email || '';
            document.getElementById('inputDocumento').value = user.numero_documento;

            // Mostrar campos según rol
            if (user.tipo_usuario === 'owner') {
                document.getElementById('bloqueOwner').classList.remove('d-none');
                form.razon_social.value = user.razon_social;
            } else {
                document.getElementById('bloqueEmpleado').classList.remove('d-none');
                form.primer_nombre.value = user.primer_nombre;
                form.segundo_nombre.value = user.segundo_nombre || '';
                form.primer_apellido.value = user.primer_apellido;
                form.segundo_apellido.value = user.segundo_apellido || '';
            }

        } catch (error) {
            console.error(error);
            alert('Error al cargar perfil');
        }
    }

    // Previsualización de la imagen antes de subirla
    previsualizarFoto(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('imgPerfilPreview').src = e.target.result;
            }
            reader.readAsDataURL(input.files[0]);
        }
    }

    async guardarPerfil() {
        const form = document.getElementById('formPerfil');
        const formData = new FormData(form); // Captura texto y archivo automáticamente

        try {
            const res = await fetch(this.apiBase, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` },
                body: formData
            });

            const result = await res.json();

            if (res.ok) {
                alert('Perfil actualizado correctamente');
                
                // Actualizar la foto en la barra superior (Topbar) inmediatamente
                if (result.nuevaFoto) {
                    const avatarTop = document.getElementById('userAvatar');
                    if(avatarTop) avatarTop.src = `http://localhost:3000${result.nuevaFoto}`;
                }
                
                // Limpiar campo password
                form.password.value = '';
                
            } else {
                alert(result.error || 'Error al actualizar');
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión');
        }
    }
}

window.module_perfil = new PerfilModule();