class ConfiguracionModule {
    constructor() {
        this.apiBase = 'http://localhost:3000/api/empresa';
        this.token = localStorage.getItem('token');
    }

    init() {
        console.log('⚙️ Módulo Configuración Cargado');
        this.cargarDatos();
    }

    // Cargar datos actuales de la BD al formulario
    async cargarDatos() {
        try {
            const res = await fetch(this.apiBase, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await res.json();

            // Rellenar inputs
            const form = document.getElementById('formEmpresa');
            if(data.razon_social) form.razon_social.value = data.razon_social;
            if(data.numero_documento) document.getElementById('readOnlyDoc').value = data.numero_documento;
            if(data.telefono) form.telefono.value = data.telefono;
            if(data.direccion) form.direccion.value = data.direccion;
            if(data.ciudad) form.ciudad.value = data.ciudad;

            // Mostrar logo si existe
            if (data.logo_url) {
                document.getElementById('previewLogo').src = `http://localhost:3000${data.logo_url}`;
            }

        } catch (error) {
            console.error(error);
            alert('Error al cargar datos de la empresa');
        }
    }

    // Previsualizar imagen antes de subirla
    previewImage(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('previewLogo').src = e.target.result;
            }
            reader.readAsDataURL(input.files[0]);
        }
    }

    // Guardar cambios
    async guardar() {
        if(!confirm("¿Guardar cambios en la información de la empresa?")) return;

        const form = document.getElementById('formEmpresa');
        const formData = new FormData(form); // FormData maneja archivos y texto automáticamente

        try {
            const res = await fetch(this.apiBase, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }, // NO poner Content-Type con FormData
                body: formData
            });

            const result = await res.json();

            if (res.ok) {
                alert('¡Información actualizada con éxito!');
                // Recargar para confirmar visualmente
                this.cargarDatos();
            } else {
                alert(result.error || 'Error al guardar');
            }

        } catch (error) {
            console.error(error);
            alert('Error de conexión al guardar');
        }
    }
}

// Instanciar el módulo
window.module_configuracion = new ConfiguracionModule();