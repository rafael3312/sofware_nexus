class MapaModule {
    constructor() {
        this.apiProyectos = 'http://localhost:3000/api/proyectos';
        this.apiLotes = 'http://localhost:3000/api/lotes'; 
        this.token = localStorage.getItem('token');
        this.lotesData = [];
    }

    init() {
        console.log('🗺️ Módulo Mapa Activo');
        this.cargarProyectos();
        
        const select = document.getElementById('selectProyectoMapa');
        if(select) {
            select.addEventListener('change', (e) => this.cargarPlano(e.target.value));
        }
    }

    async cargarProyectos() {
        try {
            const res = await fetch(this.apiProyectos, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const proyectos = await res.json();
            
            const select = document.getElementById('selectProyectoMapa');
            // Filtramos solo proyectos que tengan plano_svg cargado
            const proyectosConPlano = proyectos.filter(p => p.plano_svg);
            
            if(proyectosConPlano.length > 0) {
                select.innerHTML = '<option value="">Selecciona un proyecto...</option>' + 
                    proyectosConPlano.map(p => `<option value="${p.id}" data-svg="${p.plano_svg}">${p.nombre}</option>`).join('');
                
                // Cargar el primero por defecto
                select.value = proyectosConPlano[0].id;
                this.cargarPlano(proyectosConPlano[0].id);
            } else {
                select.innerHTML = '<option value="">Sin proyectos con planos</option>';
            }

        } catch (error) {
            console.error(error);
        }
    }

    async cargarPlano(projectId) {
        if(!projectId) return;
        
        const container = document.getElementById('mapaContainer');
        container.innerHTML = '<div class="spinner-border text-primary"></div> Cargando mapa...';

        const select = document.getElementById('selectProyectoMapa');
        const option = select.options[select.selectedIndex];
        const svgUrl = `http://localhost:3000${option.dataset.svg}`;

        try {
            const svgRes = await fetch(svgUrl);
            if(!svgRes.ok) throw new Error('No se pudo cargar la imagen del plano');
            const svgText = await svgRes.text();

            container.innerHTML = svgText;
            
            const svgElement = container.querySelector('svg');
            if(svgElement) {
                svgElement.style.width = '100%';
                svgElement.style.height = 'auto';
                svgElement.style.maxHeight = '80vh';
            }

            this.colorearLotes(projectId);

        } catch (error) {
            container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    }

    async colorearLotes(projectId) {
        try {
            const res = await fetch(`${this.apiLotes}?project_id=${projectId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            this.lotesData = await res.json();

            // --- LÓGICA DE COLORES ACTUALIZADA ---
            const colores = {
                'vendido': '#198754',   // Verde (Bootstrap success)
                'separado': '#ffc107',  // Amarillo (Bootstrap warning)
                'novedad': '#dc3545',   // Rojo (Bootstrap danger)
                'cedido': '#dc3545',    // Rojo (Igual a novedad por defecto)
                'disponible': '#e9ecef' // Gris claro
            };

            this.lotesData.forEach(lote => {
                const element = document.getElementById(lote.unit_code);
                
                if (element) {
                    const color = colores[lote.status] || '#e9ecef';
                    element.style.fill = color;
                    element.style.cursor = 'pointer';
                    element.style.transition = 'opacity 0.2s';

                    element.onmouseover = (e) => {
                        element.style.opacity = '0.7';
                        this.mostrarTooltip(e, lote);
                    };
                    element.onmouseout = () => {
                        element.style.opacity = '1';
                        document.getElementById('loteTooltip').classList.add('d-none');
                    };
                    element.onclick = () => {
                        if(lote.status === 'disponible') {
                            alert(`Lote ${lote.unit_code} disponible. Ir a ventas para procesar.`);
                        }
                    };
                }
            });

        } catch (error) {
            console.error("Error coloreando mapa:", error);
        }
    }

    mostrarTooltip(e, lote) {
        const tooltip = document.getElementById('loteTooltip');
        const container = document.getElementById('mapaContainer');
        
        document.getElementById('tooltipCode').textContent = lote.unit_code;
        const badge = document.getElementById('tooltipStatus');
        
        // --- ACTUALIZACIÓN DE CLASES DEL BADGE EN TOOLTIP ---
        badge.textContent = lote.status.toUpperCase();
        
        let badgeClass = 'bg-secondary'; // Default
        if (lote.status === 'vendido') badgeClass = 'bg-success';        // Verde
        else if (lote.status === 'separado') badgeClass = 'bg-warning text-dark'; // Amarillo
        else if (lote.status === 'novedad') badgeClass = 'bg-danger';    // Rojo
        else if (lote.status === 'cedido') badgeClass = 'bg-danger';     // Rojo
        
        badge.className = `badge ${badgeClass}`;
        
        document.getElementById('tooltipArea').textContent = `${lote.area} m²`;
        document.getElementById('tooltipPrice').textContent = new Intl.NumberFormat('es-CO', { 
            style: 'currency', currency: 'COP', maximumFractionDigits: 0 
        }).format(lote.price);

        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left + 20; 
        const y = e.clientY - rect.top;

        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
        tooltip.classList.remove('d-none');
    }
}

window.module_mapa = new MapaModule();