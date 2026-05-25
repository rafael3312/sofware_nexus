class ReportesModule {
    constructor() {
        this.apiBase = 'http://localhost:3000/api/reportes';
        this.token = localStorage.getItem('token');
        this.modalFiltros = null;
        this.modalCliente = null;
    }


    
    init() {
        console.log('📊 Módulo Reportes Activo');

        // Inicializar Modales
        const elFiltros = document.getElementById('modalFiltros');
        if (elFiltros) this.modalFiltros = new bootstrap.Modal(elFiltros);

        const elCliente = document.getElementById('modalRepoCliente');
        if (elCliente) this.modalCliente = new bootstrap.Modal(elCliente);
    }

    //--- 1. REPORTE GENERAL DE VENTAS (Abre Modal de Fechas) ---
    abrirModal(tipo, formato) {
        // Seteamos valores ocultos para saber qué reporte generar al confirmar
        document.getElementById('repoTipo').value = tipo;
        document.getElementById('repoFormato').value = formato;
        
        // Limpiar fechas anteriores
        document.getElementById('fechaInicio').value = '';
        document.getElementById('fechaFin').value = '';
        
        this.modalFiltros.show();
    }

    //--- ESTA ES LA FUNCIÓN QUE FALTABA O FALLABA ---
    async descargar() {
        const tipo = document.getElementById('repoTipo').value; // Ej: 'ventas'
        const formato = document.getElementById('repoFormato').value; // Ej: 'excel'
        const inicio = document.getElementById('fechaInicio').value;
        const fin = document.getElementById('fechaFin').value;

        // Feedback visual en el botón
        const btn = document.querySelector('#modalFiltros .btn-primary');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generando...';
        btn.disabled = true;

        try {
            // Construir URL: http://localhost:3000/api/reportes/ventas/excel
            let url = `${this.apiBase}/${tipo}/${formato}`;
            
            // Agregar parámetros de fecha si existen
            const params = new URLSearchParams();
            if (inicio) params.append('inicio', inicio);
            if (fin) params.append('fin', fin);
            
            if (Array.from(params).length > 0) {
                url += `?${params.toString()}`;
            }

            // Petición
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!res.ok) throw new Error('Error al generar el reporte en el servidor.');

            // Convertir respuesta a Blob (Archivo)
            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            
            // Crear enlace invisible para descargar
            const a = document.createElement('a');
            a.href = downloadUrl;
            const extension = formato === 'excel' ? 'xlsx' : 'pdf';
            const fechaHoy = new Date().toISOString().split('T')[0];
            a.download = `Reporte_${tipo}_${fechaHoy}.${extension}`;
            
            document.body.appendChild(a);
            a.click();
            a.remove();

            // Cerrar modal y éxito
            this.modalFiltros.hide();

        } catch (error) {
            console.error(error);
            alert('No se pudo descargar el reporte. Verifica las fechas o intenta de nuevo.');
        } finally {
            // Restaurar botón
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    //--- 2. REPORTE POR CLIENTE (Abre Modal de Documento) ---
    abrirModalCliente() {
        document.getElementById('repoDocumento').value = '';
        this.modalCliente.show();
    }

    async descargarCliente() {
        const documento = document.getElementById('repoDocumento').value.trim();
        if (!documento) return alert("Escribe un número de documento");

        const btn = document.querySelector('#modalRepoCliente .btn-primary');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generando...';
        btn.disabled = true;

        try {
            // Corregido: sintaxis de template string y parámetros
            const res = await fetch(`${this.apiBase}/cliente/pdf?documento=${documento}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (res.status === 404) throw new Error('Cliente no encontrado');
            if (!res.ok) throw new Error('Error al generar PDF');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Estado_Cuenta_${documento}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();

            this.modalCliente.hide();

        } catch (error) {
            alert(error.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    //--- 3. REPORTE CARTERA DIRECTA (Sin Modal, descarga inmediata) ---
    async descargarCartera(formato) {
        // Encontrar el botón que disparó el evento para ponerle el spinner
        // Usamos event.target si está disponible, sino buscamos genérico
        let btn = event ? event.target.closest('button') : null;
        let originalText = '';
        
        if(btn) {
            originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generando...';
        }

        try {
            const url = `${this.apiBase}/cartera/${formato}`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!res.ok) throw new Error('Error generando reporte de cartera');

            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            const ext = formato === 'excel' ? 'xlsx' : 'pdf';
            a.download = `Reporte_Cartera_${new Date().toISOString().split('T')[0]}.${ext}`;
            
            document.body.appendChild(a);
            a.click();
            a.remove();

        } catch (error) {
            console.error(error);
            alert('Error al descargar cartera. Revisa la consola.');
        } finally {
            if(btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    }




}

// Inicializar
window.module_reportes = new ReportesModule();