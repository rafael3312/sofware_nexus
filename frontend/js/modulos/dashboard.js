class DashboardModule {
    constructor() {
        this.apiBase = 'http://localhost:3000/api/dashboard';
        this.token = localStorage.getItem('token');
        this.chartVentasInstance = null;
        this.chartFinanzasInstance = null;
    }

    init() {
        console.log('Dashboard Activo');
        // Pequeño delay para asegurar que el HTML cargó
        setTimeout(() => this.cargarDatos(), 100);
    }

    async cargarDatos() {
        try {
            const res = await fetch(`${this.apiBase}/resumen`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await res.json();

            this.actualizarKPIs(data);
            this.renderizarGraficos(data);

        } catch (error) {
            console.error(error);
        }
    }

    actualizarKPIs(data) {
        // Actualizamos los números grandes de las tarjetas
        // Usamos || 0 para evitar que salga "undefined" si no hay datos
        document.getElementById('kpiTotal').textContent = data.kpis.total_units || 0;
        document.getElementById('kpiDisponibles').textContent = data.kpis.available || 0;
        document.getElementById('kpiVendidos').textContent = data.kpis.sold || 0;
        
        // Formato moneda para la cartera
        const deuda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(data.dinero.pendiente);
        document.getElementById('kpiPendiente').textContent = deuda;
    }

    renderizarGraficos(data) {
        // --- GRÁFICO 1: VENTAS (BARRAS) ---
        const ctxVentas = document.getElementById('chartVentas');
        if (ctxVentas) {
            // Destruir anterior si existe (limpieza de memoria)
            if (this.chartVentasInstance) this.chartVentasInstance.destroy();

            this.chartVentasInstance = new Chart(ctxVentas, {
                type: 'bar',
                data: {
                    labels: data.grafica.map(i => i.mes), // Eje X: Meses
                    datasets: [{
                        label: 'Ventas ($)',
                        data: data.grafica.map(i => i.total_vendido), // Eje Y: Dinero
                        backgroundColor: '#0D6DFDCD',
                        borderRadius: 4,
                        
                    }]
                },
                options: { responsive: true }
            });
        }

        // --- GRÁFICO 2: CARTERA (DONA) ---
        const ctxFinanzas = document.getElementById('chartFinanzas');
        if (ctxFinanzas) {
            if (this.chartFinanzasInstance) this.chartFinanzasInstance.destroy();

            // Evitar gráfico vacío si todo es 0
            const hayDatos = data.dinero.recaudado > 0 || data.dinero.pendiente > 0;

            this.chartFinanzasInstance = new Chart(ctxFinanzas, {
                type: 'doughnut',
                data: {
                    labels: ['Cobrado', 'Por Cobrar'],
                    datasets: [{
                        data: hayDatos ? [data.dinero.recaudado, data.dinero.pendiente] : [0, 1], // [0,1] pinta gris por defecto
                        backgroundColor: hayDatos ? ['#198754', '#ffc107'] : ['#e9ecef', '#e9ecef'], 
                        hoverOffset: 4
                    }]
                },
                options: { 
                    responsive: true,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }
    }
}

window.module_dashboard = new DashboardModule();