class ProyectosModule {
    constructor() {
        this.apiBase = 'http://localhost:3000/api/proyectos';
        this.token = localStorage.getItem('token');
        this.container = null;
        this.modal = null;
    }

    init() {
        console.log('🏗️ Módulo Proyectos Iniciado');
        this.container = document.getElementById('gridProyectos');
        
        // Inicializar Modal
        const modalEl = document.getElementById('modalProyecto');
        if (modalEl) this.modal = new bootstrap.Modal(modalEl);

        // Listener para el filtro de estado (Activos/Archivados)
        const filtro = document.getElementById('filtroEstadoProy');
        if (filtro) {
            filtro.addEventListener('change', () => this.cambiarFiltroEstado());
        }

        // Cargar por defecto los activos (1)
        this.cargarProyectos(1);
    }

    cambiarFiltroEstado() {
        const estado = document.getElementById('filtroEstadoProy').value; // '1' o '0'
        this.cargarProyectos(estado);
    }

    async cargarProyectos(isActive = 1) {
        if (!this.container) return;
        
        this.container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';
        
        try {
            // Enviamos ?active=1 (Activos) o ?active=0 (Archivados)
            const res = await fetch(`${this.apiBase}?active=${isActive}`, { 
                headers: { 'Authorization': `Bearer ${this.token}` } 
            });
            const proyectos = await res.json();
            this.render(proyectos, isActive);
        } catch (error) {
            console.error(error);
            this.container.innerHTML = '<div class="alert alert-danger">Error de conexión al cargar proyectos.</div>';
        }
    }

    render(proyectos, isActive) {
        // Convertimos a string para comparar, por si viene como número
        const esPapelera = String(isActive) === '0';
        
        if (proyectos.length === 0) {
            this.container.innerHTML = `
                <div class="col-12 text-center py-5 text-muted">
                    <span class="material-icons fs-1 opacity-25">${esPapelera ? 'delete_sweep' : 'apartment'}</span>
                    <p class="mt-2">${esPapelera ? 'No hay proyectos archivados.' : 'No tienes proyectos activos.'}</p>
                </div>`;
            return;
        }

        this.container.innerHTML = proyectos.map(p => {
            // --- 1. LÓGICA DEL CARRUSEL DE IMÁGENES ---
            let carruselHTML = '';
            
            if (p.imagenes) {
                const rutas = p.imagenes.split(',');
                const slides = rutas.map((ruta, idx) => `
                    <div class="carousel-item ${idx === 0 ? 'active' : ''}" style="height: 200px;">
                        <img src="http://localhost:3000${ruta}" class="d-block w-100 h-100" style="object-fit: cover; filter: ${esPapelera ? 'grayscale(100%)' : 'none'};" onerror="this.src='https://via.placeholder.com/600x400?text=Error'">
                    </div>
                `).join('');

                // Solo mostrar flechas si hay más de una foto
                const controles = rutas.length > 1 ? `
                    <button class="carousel-control-prev" type="button" data-bs-target="#carrusel-p-${p.id}" data-bs-slide="prev">
                        <span class="carousel-control-prev-icon bg-dark rounded-circle p-2" style="background-size: 50%;"></span>
                    </button>
                    <button class="carousel-control-next" type="button" data-bs-target="#carrusel-p-${p.id}" data-bs-slide="next">
                        <span class="carousel-control-next-icon bg-dark rounded-circle p-2" style="background-size: 50%;"></span>
                    </button>
                ` : '';

                carruselHTML = `
                    <div id="carrusel-p-${p.id}" class="carousel slide" data-bs-ride="false">
                        <div class="carousel-inner">${slides}</div>
                        ${controles}
                    </div>`;
            } else {
                // Imagen por defecto si no hay fotos
                carruselHTML = `
                    <div class="bg-light text-center d-flex align-items-center justify-content-center" style="height: 200px; color: #ccc;">
                        <span class="material-icons fs-1">image</span>
                    </div>`;
            }

            // --- 2. BADGE DE ESTADO ---
            let badgeClass = 'bg-secondary';
            if (p.status === 'venta') badgeClass = 'bg-success';
            else if (p.status === 'planificacion') badgeClass = 'bg-warning text-dark';
            else if (p.status === 'vendido') badgeClass = 'bg-dark';

            // --- 3. MENÚ DE ACCIONES (SEGÚN ESTADO) ---
            let accionesMenu = '';
            
            if (esPapelera) {
                // MENÚ PARA PROYECTOS ARCHIVADOS (RESTAURAR)
                accionesMenu = `
                    <li>
                        <a class="dropdown-item text-success fw-bold" href="#" onclick="module_proyectos.reactivarProyecto(${p.id})">
                            <span class="material-icons fs-6 align-middle me-2">restore_from_trash</span> Restaurar Proyecto
                        </a>
                    </li>
                `;
            } else {
                // MENÚ NORMAL (EDITAR / ARCHIVAR)
                accionesMenu = `
                    <li>
                        <a class="dropdown-item" href="#" onclick="module_proyectos.abrirModalEditar(${p.id})">
                            <span class="material-icons fs-6 align-middle me-2">edit</span> Editar Datos
                        </a>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li>
                        <a class="dropdown-item text-danger" href="#" onclick="module_proyectos.eliminarProyecto(${p.id})">
                            <span class="material-icons fs-6 align-middle me-2">archive</span> Archivar
                        </a>
                    </li>
                `;
            }

            // --- 4. RENDER FINAL DE LA TARJETA ---
            return `
            <div class="col-md-6 col-xl-4">
                <div class="card h-100 border-0 shadow-sm hover-shadow transition-all ${esPapelera ? 'opacity-75 bg-light' : ''}">
                    <div class="position-relative">
                        ${carruselHTML}
                        <span class="position-absolute top-0 end-0 badge ${badgeClass} m-2 shadow-sm">${p.status.toUpperCase()}</span>
                    </div>
                    
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <h5 class="card-title fw-bold text-primary mb-1 text-truncate" title="${p.nombre}">${p.nombre}</h5>
                            
                            <div class="dropdown">
                                <button class="btn btn-link text-muted p-0" data-bs-toggle="dropdown">
                                    <span class="material-icons">more_vert</span>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end border-0 shadow">
                                    ${accionesMenu}
                                </ul>
                            </div>
                        </div>

                        <p class="small text-muted mb-2">
                            <span class="material-icons fs-6 align-middle text-danger me-1">place</span> ${p.ubicacion}
                        </p>
                        <p class="card-text small text-secondary text-truncate">${p.descripcion || 'Sin descripción disponible.'}</p>
                    </div>

                    <div class="card-footer bg-white border-0 pt-0 pb-3">
                        <button class="btn btn-outline-primary w-100 btn-sm" onclick="module_proyectos.irAInventario(${p.id})" ${esPapelera ? 'disabled' : ''}>
                            <span class="material-icons fs-6 align-middle me-1">grid_view</span> Ver Inventario
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    // --- ACCIONES DE RESTAURACIÓN Y ARCHIVADO ---

    async reactivarProyecto(id) {
        if(!confirm('¿Deseas restaurar este proyecto? Volverá a aparecer en la lista de activos.')) return;

        try {
            const res = await fetch(`${this.apiBase}/${id}/reactivar`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (res.ok) {
                alert('Proyecto restaurado con éxito.');
                // Recargamos la lista de ARCHIVADOS para que el usuario vea que desaparece de ahí
                this.cargarProyectos(0); 
            } else {
                const data = await res.json();
                alert(data.error || 'No se pudo restaurar');
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión');
        }
    }

    async eliminarProyecto(id) {
        if(!confirm('🛑 ¿Estás seguro de ARCHIVAR este proyecto?\n\nDejará de ser visible en la lista principal.')) return;

        try {
            const res = await fetch(`${this.apiBase}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (res.ok) {
                alert('Proyecto archivado correctamente.');
                // Recargamos la lista de ACTIVOS
                this.cargarProyectos(1);
            } else {
                const data = await res.json();
                alert(data.error || 'No se pudo archivar');
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión');
        }
    }

    // --- MODALES Y NAVEGACIÓN ---

    abrirModalCrear() {
        const form = document.getElementById('formProyecto');
        if(form) form.reset();
        document.getElementById('proyId').value = '';
        
        // Mostrar campos de autogeneración
        const autoLotesDiv = document.getElementById('bloqueAutoLotes');
        if(autoLotesDiv) autoLotesDiv.classList.remove('d-none');

        // Ocultar galería
        const galeriaDiv = document.getElementById('bloqueGaleriaProy');
        if(galeriaDiv) galeriaDiv.classList.add('d-none');

        this.modal.show();
    }

    async abrirModalEditar(id) {
        try {
            const res = await fetch(`${this.apiBase}/${id}`, { headers: { 'Authorization': `Bearer ${this.token}` } });
            const p = await res.json();

            // Llenar formulario
            document.getElementById('proyId').value = p.id;
            document.getElementById('proyNombre').value = p.nombre;
            document.getElementById('proyUbicacion').value = p.ubicacion;
            document.getElementById('proyStatus').value = p.status;
            document.getElementById('proyDescripcion').value = p.descripcion || '';
            
            // Ocultar autogeneración
            const autoLotesDiv = document.getElementById('bloqueAutoLotes');
            if(autoLotesDiv) autoLotesDiv.classList.add('d-none');

            // Mostrar galería
            const galeriaDiv = document.getElementById('bloqueGaleriaProy');
            const galeriaCont = document.getElementById('galeriaProy');
            
            if (galeriaDiv && galeriaCont) {
                galeriaDiv.classList.remove('d-none');
                galeriaCont.innerHTML = '';

                if (p.listaImagenes && p.listaImagenes.length > 0) {
                    p.listaImagenes.forEach(img => {
                        const div = document.createElement('div');
                        div.className = 'position-relative border rounded overflow-hidden shadow-sm';
                        div.style.width = '70px'; div.style.height = '70px';
                        div.innerHTML = `
                            <img src="http://localhost:3000${img.image_url}" class="w-100 h-100 object-fit-cover">
                            <button type="button" class="btn btn-danger btn-sm p-0 position-absolute top-0 end-0" 
                                style="width:20px; height:20px; line-height:1;"
                                onclick="module_proyectos.eliminarImagen(${img.id}, ${p.id})" title="Borrar Foto">
                                &times;
                            </button>
                        `;
                        galeriaCont.appendChild(div);
                    });
                } else {
                    galeriaCont.innerHTML = '<small class="text-muted fst-italic">Sin imágenes cargadas.</small>';
                }
            }

            this.modal.show();

        } catch (e) {
            console.error(e);
            alert('Error al cargar la información del proyecto.');
        }
    }

    async guardarProyecto() {
        const form = document.getElementById('formProyecto');
        const formData = new FormData(form);
        const id = document.getElementById('proyId').value;
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${this.apiBase}/${id}` : this.apiBase;

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Authorization': `Bearer ${this.token}` },
                body: formData
            });

            if (res.ok) {
                alert(id ? 'Proyecto actualizado' : 'Proyecto creado');
                this.modal.hide();
                // Recargar según el filtro actual
                const estadoActual = document.getElementById('filtroEstadoProy').value;
                this.cargarProyectos(estadoActual);
            } else {
                const data = await res.json();
                alert(data.error || 'Error al guardar');
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión');
        }
    }

    async eliminarImagen(imgId, proyId) {
        if(!confirm('¿Borrar foto?')) return;
        try {
            await fetch(`${this.apiBase}/imagen/${imgId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            this.abrirModalEditar(proyId); // Recargar modal
            // Recargar grid por si era portada
            const estadoActual = document.getElementById('filtroEstadoProy').value;
            this.cargarProyectos(estadoActual);
        } catch(e) {
            alert('Error al borrar foto');
        }
    }

    irAInventario(id) {
        const link = document.querySelector('a[data-module="lotes"]');
        if(link) {
            link.click();
            setTimeout(() => {
                const sel = document.getElementById('filtroProyecto');
                if(sel) { sel.value = id; sel.dispatchEvent(new Event('change')); }
            }, 500);
        }
    }

    toggleAutoLotes() {
        const c = document.getElementById('checkAutoLotes');
        const d = document.getElementById('camposAutoLotes');
        if(c && d) {
            if(c.checked) d.classList.remove('d-none'); else d.classList.add('d-none');
        }
    }
}

window.module_proyectos = new ProyectosModule();