class ClientesModule {
    constructor() {
        this.apiBase = 'http://localhost:3000/api/clientes';
        this.token = localStorage.getItem('token');
        this.tbody = null;
        this.modalCrear = null;
        this.modalEditar = null;
        this.clientesData = [];
    }

    init() {
        console.log('👥 Módulo Clientes Activo');
        this.tbody = document.getElementById('listaClientesBody');
        
        const elCrear = document.getElementById('modalCliente');
        if (elCrear) this.modalCrear = new bootstrap.Modal(elCrear);

        const elEditar = document.getElementById('modalEditarCliente');
        if (elEditar) this.modalEditar = new bootstrap.Modal(elEditar);

        const buscador = document.getElementById('buscadorCliente');
        if (buscador) buscador.addEventListener('input', (e) => this.filtrarClientes(e.target.value));

        this.cargarClientes();
    }

    async cargarClientes() {
        if (!this.tbody) return;
        this.tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3"><div class="spinner-border text-primary spinner-border-sm"></div></td></tr>';
        
        try {
            const res = await fetch(this.apiBase, { headers: { 'Authorization': `Bearer ${this.token}` } });
            this.clientesData = await res.json();
            this.render(this.clientesData);
        } catch (error) {
            console.error(error);
            this.tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error de conexión</td></tr>';
        }
    }

    render(lista) {
        if (lista.length === 0) {
            this.tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-5">No hay clientes registrados.</td></tr>';
            return;
        }

        this.tbody.innerHTML = lista.map(c => {
            const nombreCompleto = `${c.primer_nombre} ${c.segundo_nombre || ''} ${c.primer_apellido} ${c.segundo_apellido || ''}`;
            
            // Botones de Contacto Rápido
            const btnWsp = c.phone ? 
                `<a href="https://wa.me/57${c.phone}" target="_blank" class="btn btn-sm btn-light text-success border me-1" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>` : '';
            const btnMail = c.email ? 
                `<a href="mailto:${c.email}" class="btn btn-sm btn-light text-primary border" title="Email"><i class="far fa-envelope"></i></a>` : '';

            return `
            <tr>
                <td class="ps-4">
                    <div class="fw-bold text-dark text-capitalize">${nombreCompleto.toLowerCase()}</div>
                    <small class="fw-bold text-dark text-capitalize">ID: ${c.id}</small>
                </td>
                <td>
                    <span class="badge bg-light text-dark border">${c.tipo_documento}</span>
                    <span class="ms-1 fw-bold">${c.numero_documento}</span>
                </td>
                <td>
                    <div class="d-flex align-items-center">
                        ${btnWsp} ${btnMail}
                        <span class="ms-2 small class="fw-bold text-dark text-capitalize"">${c.phone || '-'}</span>
                    </div>
                </td>
                <td>
                    <div class="text-dark">${c.city || ''}</div>
                    <small class="fw-bold text-dark text-capitalize" text-truncate" style="max-width: 150px; display:block;">${c.address || ''}</small>
                </td>
                <td class="text-end pe-4">
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown">
                            <span class="material-icons fs-6 align-middle">more_horiz</span>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item" href="#" onclick="module_clientes.abrirEdicion(${c.id})">
                                <i class="fas fa-user-edit me-2 text-primary"></i> Editar Datos
                            </a></li>
                            <li><a class="dropdown-item" href="#" onclick="alert('Historial de compras próximamente')">
                                <i class="fas fa-history me-2 text-info"></i> Ver Historial
                            </a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item text-danger" href="#" onclick="module_clientes.eliminarCliente(${c.id})">
                                <i class="fas fa-trash-alt me-2"></i> Archivar
                            </a></li>
                        </ul>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }

    // --- FUNCIONES ACCIÓN ---

    abrirModalCrear() {
        document.getElementById('formCliente').reset();
        this.modalCrear.show();
    }

    async abrirEdicion(id) {
        try {
            const res = await fetch(`${this.apiBase}/${id}`, { headers: { 'Authorization': `Bearer ${this.token}` } });
            const c = await res.json();

            // Llenar datos
            document.getElementById('editClienteId').value = c.id;
            document.getElementById('verDocumento').textContent = `${c.tipo_documento} ${c.numero_documento}`;
            document.getElementById('editPrimerNombre').value = c.primer_nombre;
            document.getElementById('editSegundoNombre').value = c.segundo_nombre || '';
            document.getElementById('editPrimerApellido').value = c.primer_apellido;
            document.getElementById('editSegundoApellido').value = c.segundo_apellido || '';
            document.getElementById('editPhone').value = c.phone || '';
            document.getElementById('editEmail').value = c.email || '';
            document.getElementById('editAddress').value = c.address || '';
            document.getElementById('editCity').value = c.city || '';

            this.modalEditar.show();
        } catch (e) { alert('Error cargando cliente'); }
    }

    async crearCliente() {
        const form = document.getElementById('formCliente');
        const data = Object.fromEntries(new FormData(form).entries());

        if (!data.numero_documento || !data.primer_nombre) return alert('Datos incompletos');

        try {
            const res = await fetch(this.apiBase, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                this.modalCrear.hide();
                this.cargarClientes();
                alert('Cliente creado');
            } else {
                const err = await res.json();
                alert(err.error);
            }
        } catch (e) { alert('Error conexión'); }
    }

    async guardarEdicion() {
        const form = document.getElementById('formEditarCliente');
        const id = document.getElementById('editClienteId').value;
        const data = Object.fromEntries(new FormData(form).entries());

        try {
            const res = await fetch(`${this.apiBase}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                this.modalEditar.hide();
                this.cargarClientes();
                alert('Datos actualizados');
            } else {
                alert('Error al actualizar');
            }
        } catch (e) { alert('Error conexión'); }
    }

    async eliminarCliente(id) {
        if(!confirm('¿Archivar este cliente? Se ocultará de la lista pero sus ventas se conservarán.')) return;
        try {
            const res = await fetch(`${this.apiBase}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if(res.ok) this.cargarClientes();
        } catch (e) { alert('Error conexión'); }
    }

    filtrarClientes(texto) {
        const busqueda = texto.toLowerCase();
        const filtrados = this.clientesData.filter(c => 
            `${c.primer_nombre} ${c.primer_apellido} ${c.numero_documento} ${c.phone}`.toLowerCase().includes(busqueda)
        );
        this.render(filtrados);
    }
}
window.module_clientes = new ClientesModule();
