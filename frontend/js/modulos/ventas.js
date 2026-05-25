class VentasModule {
    constructor() {
        this.apiBase = 'http://localhost:3000/api/ventas';
        this.apiProyectos = 'http://localhost:3000/api/proyectos';
        this.apiLotes = 'http://localhost:3000/api/lotes';
        this.apiClientes = 'http://localhost:3000/api/clientes';
        this.token = localStorage.getItem('token');
        this.modalVenta = null;
        this.modalClienteRapido = null;
    }

    async init() {
        console.log('💰 Módulo Ventas Iniciado');
        
        // 1. Inicializar Modales
        const elModalVenta = document.getElementById('modalVenta');
        if(elModalVenta) this.modalVenta = new bootstrap.Modal(elModalVenta);

        const elModalCliente = document.getElementById('modalClienteRapido');
        if(elModalCliente) this.modalClienteRapido = new bootstrap.Modal(elModalCliente);

        // 2. Cargar Datos Iniciales
        this.cargarHistorial();
        this.cargarProyectos();

        // 3. Listeners (Eventos)
        
        // Al cambiar Proyecto -> Cargar Lotes
        const selectProy = document.getElementById('selectProyectoVenta');
        if(selectProy) {
            selectProy.addEventListener('change', (e) => this.cargarLotesDisponibles(e.target.value));
        }

        // Al cambiar Lote -> Poner Precio
        const selectUnidad = document.getElementById('selectUnidadVenta');
        if(selectUnidad) {
            selectUnidad.addEventListener('change', (e) => {
                const option = e.target.options[e.target.selectedIndex];
                if(option.dataset.price) {
                    document.getElementById('precioLista').value = parseFloat(option.dataset.price);
                    this.calcularTotales();
                }
            });
        }

        // Cálculos Matemáticos en tiempo real
        ['descuentoInput', 'inputInicial'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('input', () => this.calcularTotales());
        });

        const inputCuotas = document.getElementById('inputCuotas');
        if(inputCuotas) inputCuotas.addEventListener('input', () => this.calcularProyeccion());
    }

    // --- CARGA DE DATOS ---

    async cargarHistorial() {
        const tbody = document.getElementById('listaVentasBody');
        if(!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3">Cargando historial...</td></tr>';

        try {
            const res = await fetch(this.apiBase, { headers: {'Authorization': `Bearer ${this.token}`} });
            const ventas = await res.json();

            if(ventas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay ventas registradas.</td></tr>';
                return;
            }

            tbody.innerHTML = ventas.map(v => `
                <tr>
                    <td class="ps-4">${new Date(v.contract_date).toLocaleDateString()}</td>
                    <td>
                        <div class="fw-bold">${v.unit_code}</div>
                        <small class="text-muted">${v.proyecto}</small>
                    </td>
                    <td>
                        ${v.primer_nombre} ${v.primer_apellido}<br>
                        <small class="text-muted">${v.numero_documento}</small>
                    </td>
                    <td class="fw-bold text-success">$${new Intl.NumberFormat('es-CO').format(v.final_price)}</td>
                    <td><span class="badge bg-success">${v.contract_status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-secondary" onclick="alert('Imprimir contrato pendiente')">
                            <span class="material-icons fs-6">print</span>
                        </button>
                    </td>
                </tr>
            `).join('');

        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-danger text-center">Error al cargar historial</td></tr>';
        }
    }

    async cargarProyectos() {
        try {
            const res = await fetch(this.apiProyectos, { headers: {'Authorization': `Bearer ${this.token}`} });
            const proyectos = await res.json();
            const select = document.getElementById('selectProyectoVenta');
            if(select) {
                select.innerHTML = '<option value="">Seleccione...</option>' + 
                    proyectos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
            }
        } catch(e) { console.error(e); }
    }

    async cargarLotesDisponibles(projectId) {
        const select = document.getElementById('selectUnidadVenta');
        select.innerHTML = '<option>Cargando...</option>';
        select.disabled = true;

        if(!projectId) {
            select.innerHTML = '<option value="">Seleccione Proyecto primero</option>';
            return;
        }

        try {
            // Filtramos lotes del proyecto
            const res = await fetch(`${this.apiLotes}?project_id=${projectId}`, { headers: {'Authorization': `Bearer ${this.token}`} });
            const lotes = await res.json();
            
            // Solo los disponibles
            const disponibles = lotes.filter(l => l.status === 'disponible');

            if(disponibles.length > 0) {
                select.innerHTML = '<option value="">Seleccione Lote...</option>' + 
                    disponibles.map(l => `<option value="${l.id}" data-price="${l.price}">${l.unit_code} - $${new Intl.NumberFormat('es-CO').format(l.price)}</option>`).join('');
                select.disabled = false;
            } else {
                select.innerHTML = '<option value="">No hay unidades disponibles</option>';
            }
        } catch(e) {
            select.innerHTML = '<option>Error al cargar</option>';
        }
    }

    // --- LÓGICA DE CLIENTES ---

    async buscarCliente() {
        const doc = document.getElementById('buscarCedulaInput').value.trim();
        if(!doc) return alert('Escribe una cédula para buscar');

        try {
            const res = await fetch(`${this.apiClientes}/buscar/${doc}`, { headers: {'Authorization': `Bearer ${this.token}`} });
            if(res.ok) {
                const cliente = await res.json(); // Puede ser objeto o array según tu backend
                const datos = Array.isArray(cliente) ? cliente[0] : cliente; // Asegurar objeto

                if(datos) {
                    document.getElementById('clientIdHidden').value = datos.id;
                    const infoDiv = document.getElementById('infoCliente');
                    infoDiv.classList.remove('d-none');
                    document.getElementById('nombreClienteDisplay').textContent = `${datos.primer_nombre} ${datos.primer_apellido}`;
                } else {
                    alert('Cliente no encontrado. Créalo con el botón "Nuevo Cliente".');
                }
            } else {
                alert('Cliente no encontrado.');
                document.getElementById('infoCliente').classList.add('d-none');
                document.getElementById('clientIdHidden').value = '';
            }
        } catch(e) { console.error(e); }
    }

    // --- NUEVAS FUNCIONES PARA CLIENTE RÁPIDO (Estas faltaban en tu archivo) ---
    
    abrirModalClienteRapido() {
        // Pre-llenar cédula si la escribió en el buscador
        const cedulaBuscada = document.getElementById('buscarCedulaInput').value;
        const form = document.getElementById('formClienteRapido');
        form.reset();
        if(cedulaBuscada) form.numero_documento.value = cedulaBuscada;
        
        this.modalClienteRapido.show();
    }

    cerrarModalCliente() {
        this.modalClienteRapido.hide();
    }

    async guardarClienteRapido() {
        const form = document.getElementById('formClienteRapido');
        // Construir objeto manualmente
        const data = {
            tipo_documento: 'CC', 
            numero_documento: form.numero_documento.value,
            primer_nombre: form.primer_nombre.value,
            primer_apellido: form.primer_apellido.value,
            phone: form.phone.value,
            email: form.email.value,
            address: 'Dirección pendiente', 
            city: 'Ciudad pendiente'
        };

        if(!data.numero_documento || !data.primer_nombre) return alert('Faltan datos obligatorios');

        try {
            const res = await fetch(this.apiClientes, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (res.ok) {
                alert('Cliente creado exitosamente');
                this.modalClienteRapido.hide();
                
                // AUTO-SELECCIONAR EL CLIENTE CREADO EN EL FORMULARIO DE VENTA
                document.getElementById('clientIdHidden').value = result.id;
                document.getElementById('buscarCedulaInput').value = data.numero_documento;
                
                // Mostrar confirmación visual
                const infoDiv = document.getElementById('infoCliente');
                infoDiv.classList.remove('d-none');
                document.getElementById('nombreClienteDisplay').textContent = `${data.primer_nombre} ${data.primer_apellido}`;
                
            } else {
                alert(result.error || 'Error al guardar cliente');
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión');
        }
    }

    // --- LÓGICA FINANCIERA ---

    toggleCamposCredito() {
        const metodo = document.getElementById('selectMetodoPago').value;
        const bloque = document.getElementById('configCredito');
        const inputCuotas = document.getElementById('inputCuotas');

        if(metodo === 'credito') {
            bloque.classList.remove('d-none');
            inputCuotas.required = true;
        } else {
            bloque.classList.add('d-none');
            inputCuotas.required = false;
            inputCuotas.value = '';
        }
        this.calcularTotales();
    }

    calcularTotales() {
        const precio = parseFloat(document.getElementById('precioLista').value) || 0;
        const descuento = parseFloat(document.getElementById('descuentoInput').value) || 0;
        const inicial = parseFloat(document.getElementById('inputInicial').value) || 0;

        const final = precio - descuento;
        const saldo = final - inicial;

        document.getElementById('precioFinalDisplay').value = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(final);
        
        const saldoDisplay = document.getElementById('saldoFinanciarDisplay');
        if(saldoDisplay) {
            saldoDisplay.textContent = saldo > 0 
                ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(saldo)
                : '$0';
        }

        this.calcularProyeccion(saldo);
    }

    calcularProyeccion(saldoActual) {
        if(saldoActual === undefined) {
            const precio = parseFloat(document.getElementById('precioLista').value) || 0;
            const descuento = parseFloat(document.getElementById('descuentoInput').value) || 0;
            const inicial = parseFloat(document.getElementById('inputInicial').value) || 0;
            saldoActual = (precio - descuento) - inicial;
        }

        const cuotas = parseInt(document.getElementById('inputCuotas').value) || 0;
        const displayCuota = document.getElementById('valorCuotaDisplay');

        if (cuotas > 0 && saldoActual > 0) {
            const valorCuota = saldoActual / cuotas;
            if(displayCuota) displayCuota.textContent = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(valorCuota);
        } else {
            if(displayCuota) displayCuota.textContent = '$0';
        }
    }

    async guardarVenta() {
        const form = document.getElementById('formVenta');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if(!data.unit_id) return alert('Selecciona una unidad');
        if(!data.client_id) return alert('Debes buscar o crear un cliente');

        try {
            const res = await fetch(this.apiBase, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify(data)
            });

            if(res.ok) {
                alert('¡Venta registrada con éxito!');
                const modalEl = document.getElementById('modalVenta');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();
                
                // Reset y recargar
                form.reset();
                document.getElementById('infoCliente').classList.add('d-none');
                document.getElementById('configCredito').classList.add('d-none');
                this.cargarHistorial();
            } else {
                const err = await res.json();
                alert(err.error || 'Error al procesar venta');
            }
        } catch(e) {
            alert('Error de conexión');
        }
    }
}

window.module_ventas = new VentasModule();