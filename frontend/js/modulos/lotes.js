class LotesModule {
    constructor() {
        this.apiBase = 'http://localhost:3000/api/lotes';
        this.apiProyectos = 'http://localhost:3000/api/proyectos';
        this.apiClientes = 'http://localhost:3000/api/clientes';
        this.container = null;
        this.token = localStorage.getItem('token');
        this.modalCrear = null;
        this.modalSeparar = null;
    }

    async init() {
        console.log('📦 Módulo Inventario Iniciado');
        this.container = document.getElementById('gridLotes');
        
        // 1. Inicializar Modales
        const elCrear = document.getElementById('modalLote');
        if (elCrear) this.modalCrear = new bootstrap.Modal(elCrear);
        
        const elSeparar = document.getElementById('modalSeparar');
        if (elSeparar) this.modalSeparar = new bootstrap.Modal(elSeparar);

        // 2. Cargar datos en filtros (selectores)
        await this.cargarProyectosEnSelects();

        // 3. Listeners de Filtros
        const filtroProy = document.getElementById('filtroProyecto');
        const filtroEst = document.getElementById('filtroEstado');
        
        if(filtroProy) filtroProy.addEventListener('change', () => this.aplicarFiltros());
        if(filtroEst) filtroEst.addEventListener('change', () => this.aplicarFiltros());

        // 4. Cargar la grilla inicial
        this.aplicarFiltros();
    }

    async cargarProyectosEnSelects() {
        try {
            const res = await fetch(this.apiProyectos, { headers: { 'Authorization': `Bearer ${this.token}` } });
            const proyectos = await res.json();
            
            const filtro = document.getElementById('filtroProyecto');
            if(filtro) {
                filtro.innerHTML = '<option value="">Todos los Proyectos</option>' + 
                                   proyectos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
            }

            const formSelect = document.getElementById('selectProyectoForm');
            if(formSelect) {
                formSelect.innerHTML = '<option value="">Selecciona...</option>' + 
                                       proyectos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
            }
        } catch (e) { console.error(e); }
    }

    /**
     * FUNCIÓN ÚNICA DE FILTRADO Y CARGA
     */
    async aplicarFiltros() {
        if(!this.container) return;

        // Mostrar spinner mientras carga
        this.container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';

        const proyectoId = document.getElementById('filtroProyecto').value;
        const estado = document.getElementById('filtroEstado').value;

        // Construimos la URL con los parámetros exactos que espera tu Backend corregido
        let url = `${this.apiBase}?dummy=1`;
        if (proyectoId) url += `&project_id=${proyectoId}`;
        if (estado && estado !== 'todos') url += `&status=${estado}`;

        try {
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const lotes = await res.json();
            
            // Usamos 'render' que es la función que sí existe en tu código
            this.render(lotes); 
        } catch (error) {
            console.error("Error al filtrar:", error);
            this.container.innerHTML = '<div class="alert alert-danger">Error conectando con el servidor</div>';
        }
    }

    render(lotes) {
        if (!lotes || lotes.length === 0) {
            this.container.innerHTML = '<div class="col-12 text-center py-5 text-muted">No se encontraron unidades para este filtro.</div>';
            return;
        }

        this.container.innerHTML = lotes.map(l => {
            // ... (Toda tu lógica de colores, carrusel y botones se mantiene igual)
            let statusBadge = 'bg-secondary';
            if (l.status === 'disponible') statusBadge = 'bg-success';
            else if (l.status === 'separado') statusBadge = 'bg-warning text-dark';
            else if (l.status === 'vendido') statusBadge = 'bg-danger';

            // Carrusel
            let carruselHTML = '';
            if (l.imagenes) {
                const rutas = l.imagenes.split(',');
                const slides = rutas.map((ruta, idx) => `
                    <div class="carousel-item ${idx === 0 ? 'active' : ''}" style="height: 160px;">
                        <img src="http://localhost:3000${ruta}" class="d-block w-100 h-100" style="object-fit: cover;">
                    </div>`).join('');
                carruselHTML = `<div id="carrusel-l-${l.id}" class="carousel slide"><div class="carousel-inner">${slides}</div></div>`;
            } else {
                carruselHTML = `<div class="bg-light text-center d-flex align-items-center justify-content-center" style="height: 160px;"><span class="material-icons fs-1 text-muted">image</span></div>`;
            }

            return `
                <div class="col-xl-3 col-lg-4 col-md-6 mb-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="position-relative">
                            ${carruselHTML}
                            <span class="position-absolute top-0 end-0 badge ${statusBadge} m-2">${l.status.toUpperCase()}</span>
                        </div>
                        <div class="card-body">
                            <h6 class="fw-bold mb-0">${l.unit_code}</h6>
                            <small class="text-muted">${l.nombre_proyecto}</small>
                            <div class="d-flex justify-content-between mt-2">
                                <span class="text-primary fw-bold">$${new Intl.NumberFormat('es-CO').format(l.price)}</span>
                                <span class="small text-muted">${l.area} m²</span>
                            </div>
                            <div class="mt-3">
                                <button class="btn btn-sm btn-outline-primary w-100" onclick="module_lotes.abrirEdicion(${l.id})">Ver detalle</button>
                            </div>
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    // --- ACCIONES CRUD ---

    abrirModalCrear() {
        document.getElementById('formLote').reset();
        document.getElementById('editLoteId').value = '';
        document.getElementById('galeriaEdicion').innerHTML = '';
        this.modalCrear.show();
    }

    async abrirEdicion(id) {
        try {
            const res = await fetch(`${this.apiBase}/${id}`, { headers: { 'Authorization': `Bearer ${this.token}` } });
            const lote = await res.json();

            document.getElementById('editLoteId').value = lote.id;
            document.getElementById('selectProyectoForm').value = lote.project_id;
            document.getElementById('editCode').value = lote.unit_code;
            document.getElementById('editPrice').value = lote.price;
            document.getElementById('editArea').value = lote.area;
            document.getElementById('editType').value = lote.type;
            document.getElementById('editStatus').value = lote.status;
            document.getElementById('editDesc').value = lote.description || '';

            const galeria = document.getElementById('galeriaEdicion');
            galeria.innerHTML = '';
            if (lote.listaImagenes && lote.listaImagenes.length > 0) {
                lote.listaImagenes.forEach(img => {
                    const div = document.createElement('div');
                    div.className = 'position-relative border rounded overflow-hidden';
                    div.style.width = '60px'; div.style.height = '60px';
                    div.innerHTML = `
                        <img src="http://localhost:3000${img.image_url}" class="w-100 h-100 object-fit-cover">
                        <button type="button" class="btn btn-danger btn-sm p-0 position-absolute top-0 end-0" style="width:18px;height:18px;line-height:1" onclick="module_lotes.eliminarImagen(${img.id}, ${lote.id})">&times;</button>
                    `;
                    galeria.appendChild(div);
                });
            } else {
                galeria.innerHTML = '<small class="text-muted fst-italic">Sin imágenes</small>';
            }
            this.modalCrear.show();
        } catch (e) { console.error(e); alert('Error al cargar datos'); }
    }

    // En tu función guardarLote():
    async guardarLote(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Asegúrate de que en tu HTML el <select> de proyecto tenga name="project_id"
    // El backend recibirá este ID y lo usará para la validación de nombre único.

    try {
        const res = await fetch(this.apiBase, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}` },
            body: formData // No enviar JSON, enviar FormData por las imágenes
        });

        const data = await res.json();
        if (res.ok) {
            alert('Lote creado con éxito');
            this.modalLote.hide();
            this.aplicarFiltros(); // Recargamos la lista
        } else {
            // Aquí aparecerá el error: "El código Lote 1 ya existe en este proyecto"
            alert(data.error); 
        }
    } catch (error) {
        alert('Error de conexión');
    }
}

    async eliminarLote(id) {
        if (!confirm('🛑 ¿Estás seguro de ELIMINAR este lote?')) return;
        try {
            const res = await fetch(`${this.apiBase}/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${this.token}` } });
            if (res.ok) { alert('Eliminado'); this.aplicarFiltros(); }
            else { const data = await res.json(); alert(data.error); }
        } catch (e) { alert('Error de conexión'); }
    }

    async eliminarImagen(imgId, loteId) {
        if (!confirm('¿Borrar foto?')) return;
        try {
            await fetch(`${this.apiBase}/imagen/${imgId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${this.token}` } });
            this.abrirEdicion(loteId);
        } catch(e) {}
    }

    // --- SEPARACIÓN ---

    abrirSeparar(id) {
        document.getElementById('separarLoteId').value = id;
        document.getElementById('formSeparar').reset();
        document.getElementById('selectClienteSeparar').style.display = 'none';
        this.modalSeparar.show();
    }

    async buscarCliente() {
        const q = document.getElementById('buscarClienteSeparar').value.trim();
        if(q.length < 3) return alert('Escribe al menos 3 caracteres');
        
        try {
            const res = await fetch(`${this.apiClientes}/buscar/${q}`, { headers: {'Authorization': `Bearer ${this.token}`} });
            let clientes = [];
            if(res.ok) {
                const data = await res.json();
                if(Array.isArray(data)) clientes = data;
                else if(data.id) clientes = [data];
            }

            const select = document.getElementById('selectClienteSeparar');
            select.innerHTML = '';
            if(clientes.length > 0) {
                clientes.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.text = `${c.primer_nombre} ${c.primer_apellido} - ${c.numero_documento}`;
                    select.appendChild(opt);
                });
                select.style.display = 'block';
                select.selectedIndex = 0;
            } else {
                select.style.display = 'none';
                alert('No encontrado');
            }
        } catch(e) { console.error(e); }
    }

    async confirmarSeparacion() {
        const id = document.getElementById('separarLoteId').value;
        const clientId = document.getElementById('selectClienteSeparar').value;
        const amount = document.getElementById('montoSeparacion').value;
        const deadline = document.getElementById('fechaLimiteSeparacion').value;

        if(!clientId || !amount || !deadline) return alert('Datos incompletos');

        try {
            const res = await fetch(`${this.apiBase}/${id}/separar`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}`},
                body: JSON.stringify({ client_id: clientId, amount: amount, deadline: deadline })
            });
            if(res.ok) {
                alert('Lote separado!');
                this.modalSeparar.hide();
                this.aplicarFiltros();
            } else alert('Error al separar');
        } catch(e) { alert('Error conexión'); }
    }

    async liberarLote(id) {
        if(!confirm('¿Liberar lote? Volverá a estar disponible.')) return;
        try {
            await fetch(`${this.apiBase}/${id}/liberar`, { method: 'PUT', headers: {'Authorization': `Bearer ${this.token}`} });
            this.aplicarFiltros();
        } catch(e) { alert('Error'); }
    }
}

window.module_lotes = new LotesModule();