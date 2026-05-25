class PagosModule {
    constructor() {
        this.apiBase = 'http://localhost:3000/api/pagos';
        this.token = localStorage.getItem('token');
        this.currentTerm = '';
    }

    init() {
        console.log(' Módulo Caja Iniciado');
        const input = document.getElementById('inputBuscarCartera');
        if(input) input.focus();
    }

    async buscar() {
        const termino = document.getElementById('inputBuscarCartera').value.trim();
        if (!termino) return alert('Por favor escribe una cédula o lote para buscar');

        this.currentTerm = termino;

        // UI de carga
        const panelVacio = document.getElementById('mensajeVacio');
        panelVacio.innerHTML = '<div class="spinner-border text-primary"></div><p class="mt-2">Buscando información...</p>';
        document.getElementById('panelResultados').classList.add('d-none');

        try {
            const res = await fetch(`${this.apiBase}/buscar?termino=${termino}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await res.json();

            if (data.total_registros === 0) {
                panelVacio.innerHTML = `
                    <span class="material-icons fs-1 text-warning opacity-50">warning</span>
                    <p class="mt-3 fs-5">No se encontraron registros con "${termino}".</p>
                    <small class="text-muted">Intenta con la cédula sin puntos o el código del lote.</small>
                `;
                panelVacio.classList.remove('d-none');
                return;
            }

            this.renderizarResultados(data);

        } catch (error) {
            console.error(error);
            panelVacio.innerHTML = '<div class="text-danger">Error de conexión al buscar.</div>';
        }
    }

    renderizarResultados(data) {

    document.getElementById('mensajeVacio').classList.add('d-none');
    document.getElementById('panelResultados').classList.remove('d-none');

    const todos = [
        ...data.pendientes,
        ...data.pagados
    ];

    if (todos.length === 0) return;


    /*
    =========================
    RESUMEN CLIENTE
    =========================
    */

    const primerReg = todos[0];

    document.getElementById('resumenCliente').textContent =
        `${primerReg.primer_nombre} ${primerReg.primer_apellido}`;


    /*
    =========================
    AGRUPAR POR LOTE
    =========================
    */

    const lotes = {};

    todos.forEach(r => {

        if (!lotes[r.unit_code]) {
            lotes[r.unit_code] = {
                proyecto: r.proyecto,
                pendientes: [],
                pagados: []
            };
        }

        if (r.status === "pagado")
            lotes[r.unit_code].pagados.push(r);
        else
            lotes[r.unit_code].pendientes.push(r);

    });


    /*
    =========================
    CREAR PESTAÑAS
    =========================
    */

    const tabs = document.getElementById('tabsLotes');
    const contenido = document.getElementById('contenidoLotes');

    tabs.innerHTML = "";
    contenido.innerHTML = "";

    let index = 0;

    Object.keys(lotes).forEach((unitCode, index) => {
        const safeId = "lote_" + index;
        const lote = lotes[unitCode];
        const activo = index === 0 ? "active show" : "";


        // TAB

        tabs.innerHTML += `
        <li class="nav-item" role="presentation">
            <button class="nav-link ${index === 0 ? "active" : ""}"
                data-bs-toggle="tab"
                data-bs-target="#${safeId}"
                type="button"
                role="tab">
                ${unitCode}
            </button>
        </li>
        `;


        /*
        CONTENIDO TAB
        */

        contenido.innerHTML += `
            <div class="tab-pane fade ${activo}" id="${safeId}">

                <div class="card border-0 shadow-sm mb-3">
                    <div class="card-body">

                        <h6 class="fw-bold">
                            ${unitCode} - ${lote.proyecto}
                        </h6>

                        <h6 class="mt-3 text-danger fw-bold">Por Cobrar</h6>

                        <table class="table table-hover align-middle">

                        <thead class="table-light">

                            <tr>
                            <th>Vencimiento</th>
                            <th>Cuota</th>
                            <th>Valor</th>
                            <th>Estado</th>
                            <th></th>
                            </tr>

                        </thead>

                        <tbody>

${
lote.pendientes.map(c => {

const isVencida =
c.due_date && new Date(c.due_date) < new Date();

return `

<tr>

<td class="${isVencida ? 'text-danger fw-bold' : ''}">

${c.due_date ?
new Date(c.due_date).toLocaleDateString()
:
"--"}

</td>

<td>

Cuota #${c.quota_number}

</td>

<td class="fw-bold">

${this.formatoMoneda(parseFloat(c.amount||0))}

</td>

<td>

${
isVencida
? '<span class="badge bg-danger">Vencida</span>'
: '<span class="badge bg-warning text-dark">Pendiente</span>'
}

</td>

<td>

${
c.id ?

`<button class="btn btn-success btn-sm"
onclick="module_pagos.registrarPago(${c.id})">

Pagar

</button>`

: ""

}

</td>

</tr>

`;

}).join('')
}

</tbody>

</table>


                        <h6 class="mt-4 text-success">Pagados</h6>

                        <table class="table">

                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Cuota</th>
                                    <th>Valor</th>
                                </tr>
                            </thead>

                            <tbody>

                                ${
                                    lote.pagados.map(c => `
                                        <tr>

                                            <td>
                                                ${
                                                    c.payment_date
                                                    ? new Date(c.payment_date).toLocaleDateString()
                                                    : "--"
                                                }
                                            </td>

                                            <td>
                                                ${c.quota_number}
                                            </td>

                                            <td>
                                                ${this.formatoMoneda(parseFloat(c.amount || 0))}
                                            </td>

                                        </tr>
                                    `).join('')
                                }

                            </tbody>

                        </table>

                    </div>
                </div>

            </div>
        `;

        index++;

    });


    /*
    =========================
    DEUDA TOTAL
    =========================
    */

    const totalDeuda = data.pendientes
        .reduce((a, b) => a + parseFloat(b.amount || 0), 0);

    document.getElementById('resumenDeuda').textContent =
        this.formatoMoneda(totalDeuda);

    }

    async registrarPago(id) {
        if(!confirm('¿Confirmar que recibiste el dinero de esta cuota?')) return;

        try {
            const res = await fetch(`${this.apiBase}/${id}/pagar`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (res.ok) {
                alert('Pago aplicado correctamente');
                // Recargar búsqueda para actualizar tablas
                if(this.currentTerm) {
                    this.buscar(); // Re-ejecuta la búsqueda con el término actual
                }
            } else {
                alert('Error al aplicar pago');
            }
        } catch (error) {
            alert('Error de conexión');
        }
    }

    imprimirRecibo(id) {
        // En una versión futura aquí generarías un PDF real.
        // Por ahora, simulamos la acción.
        const fecha = new Date().toLocaleString();
        alert(`🖨️ Imprimiendo Recibo de Caja #${id}\nFecha: ${fecha}\n\n(Esta función descargará un PDF en la versión final)`);
    }

    formatoMoneda(valor) {
        return new Intl.NumberFormat('es-CO', { 
            style: 'currency', 
            currency: 'COP', 
            maximumFractionDigits: 0 
        }).format(valor);
    }
}

window.module_pagos = new PagosModule();