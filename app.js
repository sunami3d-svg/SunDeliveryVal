function getVenezuelaDate() {
    const now = new Date();
    const options = { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' };
    const parts = new Intl.DateTimeFormat('es-VE', options).formatToParts(now);
    return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
}

function formatISOToVE(isoDateStr) {
    if (!isoDateStr) return "";
    const parts = isoDateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoDateStr;
}

function parseDateVEToISO(dateStr) {
    if (!dateStr) return "";
    if (dateStr.includes("-")) return dateStr; 
    const parts = dateStr.split("/");
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateStr;
}

function getVenezuelaTime() {
    const now = new Date();
    return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
}

const TARIFARIO_ZONAS = {
    "El Parral / Prebo / Kratos": 2.50,
    "El Bosque / La Viña / Trigaleña": 3.00,
    "Trigal Norte / Trigal Sur": 3.00,
    "Naguanagua Centro / Mañongo": 3.50,
    "La Isabelica / Zona Industrial": 4.00,
    "San Diego (Hasta Fin de Siglo)": 4.50,
    "Los Guayos / Guacara": 6.00,
    "Tocuyito / Campo Carabobo": 7.00
};

let aliados = [];
let motorizados = [];
let pedidos = [];
let gastos = [];
let directorioClientes = [];
let pedidosPendientesAliados = [];

let selectedPedido = null;
let editPedidoId = null;
let editMotoId = null;
let editAliadoId = null;
let editClienteDirId = null;

let usuarioActual = { username: "", rol: "admin", aliadoComercial: "" };
let porcComisionMotorizado = 0.70; 
let cargaInicialPedidos = true;
let rolSeleccionadoLogin = "admin"; 

// ==========================================
// 🔗 FEATURE 1: LINK DE RASTREO PÚBLICO
// ==========================================
window.comprobarRastreoPublico = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const trackId = urlParams.get('track');

    if (trackId) {
        document.getElementById('login-view')?.classList.add('hidden');
        document.getElementById('portal-aliado-container') && (document.getElementById('portal-aliado-container').style.display = 'none');
        document.getElementById('app-container')?.classList.remove('active');

        let containerRastreo = document.getElementById('public-tracking-view');
        if (!containerRastreo) {
            containerRastreo = document.createElement('div');
            containerRastreo.id = 'public-tracking-view';
            containerRastreo.style.cssText = 'max-width: 500px; margin: 20px auto; padding: 20px; font-family: sans-serif; background: #fff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center;';
            document.body.appendChild(containerRastreo);
        }
        containerRastreo.style.display = 'block';
        containerRastreo.innerHTML = `<div style="padding: 30px; color: #ff6600; font-size: 1.2rem;">⏳ Cargando estado del pedido...</div>`;

        db.collection('pedidos').doc(trackId).onSnapshot(doc => {
            if (!doc.exists) {
                containerRastreo.innerHTML = `
                    <div style="color: #ef4444; padding: 20px;">
                        <h2>❌ Pedido No Encontrado</h2>
                        <p>El enlace de rastreo es inválido o el pedido ha sido removido.</p>
                    </div>`;
                return;
            }

            const p = doc.data();
            const barraHtml = obtenerBarraEstatus(p);

            containerRastreo.innerHTML = `
                <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; margin-bottom: 15px;">
                    <h2 style="color: #ff6600; margin: 0; font-size: 1.4rem;">🚀 SunDelivery Valencia</h2>
                    <p style="color: #64748b; margin: 5px 0 0 0; font-size: 0.9rem;">Rastreo de Despacho en Vivo</p>
                </div>
                <div style="background: #fafafa; padding: 12px; border-radius: 8px; margin-bottom: 15px; text-align: left; font-size: 0.9rem;">
                    <div><b>📦 Guía:</b> #${p.id || doc.id.substring(0, 6)}</div>
                    <div><b>🏪 Comercio:</b> ${p.aliado}</div>
                    <div><b>👤 Cliente:</b> ${p.cliente}</div>
                    <div><b>📍 Destino:</b> ${p.direccion}</div>
                    ${p.incidencia ? `<div style="color: #ef4444; font-weight: bold; margin-top: 5px;">🚨 Novedad: ${p.incidencia}</div>` : ''}
                </div>
                <div style="margin: 20px 0;">
                    ${barraHtml}
                </div>
                <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 20px;">
                    Esta pantalla se actualiza en tiempo real automáticamente.
                </div>
            `;
        });
        return true; 
    }
    return false;
};

window.copiarLinkRastreo = function(fId) {
    const trackingUrl = `${window.location.origin}${window.location.pathname}?track=${fId}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(trackingUrl).then(() => {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: '🔗 Link de rastreo copiado',
                showConfirmButton: false,
                timer: 2000
            });
        });
    } else {
        Swal.fire("Link de Rastreo", trackingUrl, "info");
    }
};

// ==========================================
// 🧾 FEATURE 2: IMPRESIÓN DE TICKET TÉRMICO
// ==========================================
window.imprimirTicketTermico = function(fId) {
    const p = [...pedidos, ...pedidosPendientesAliados].find(item => item.firestoreId === fId);
    if (!p) {
        Swal.fire("Error", "No se encontró la información del pedido.", "error");
        return;
    }

    const tasa = parseFloat(document.getElementById('modal-tasa')?.value) || 45.50;
    const totalBs = p.costo * tasa;

    const ventanaImp = window.open('', '_blank', 'width=400,height=600');
    ventanaImp.document.write(`
        <html>
        <head>
            <title>Ticket #${p.id || 'SD'}</title>
            <style>
                @page { margin: 0; size: 58mm auto; }
                body {
                    font-family: 'Courier New', Courier, monospace;
                    width: 100%;
                    max-width: 280px;
                    margin: 0 auto;
                    padding: 8px;
                    font-size: 11px;
                    color: #000;
                    background: #fff;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .bold { font-weight: bold; }
                .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
                .title { font-size: 14px; font-weight: bold; margin: 0; }
                .sub-title { font-size: 10px; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <div class="text-center">
                <p class="title">SUNDELIVERY VALENCIA</p>
                <p class="sub-title">¡Logística Rápida y Segura!</p>
                <p>Fecha: ${p.fecha} ${p.hora || ''}</p>
            </div>
            
            <div class="divider"></div>
            
            <div>
                <span class="bold">RETIRO (ALIADO):</span><br>
                ${p.aliado}<br>
            </div>
            
            <div class="divider"></div>
            
            <div>
                <span class="bold">ENTREGA (CLIENTE):</span><br>
                Nombre: ${p.cliente}<br>
                Tlf: ${p.telefono}<br>
                Dir: ${p.direccion}<br>
                ${p.maps_link ? `GPS: ${p.maps_link}<br>` : ''}
            </div>
            
            <div class="divider"></div>
            
            <div>
                <span class="bold">DETALLES DEL ENVÍO:</span><br>
                Paquete: ${p.tamano_paquete || 'Estándar'}<br>
                Pago: ${p.metodo_pago || 'Efectivo USD'}<br>
                Notas: ${p.detalles || 'Sin observaciones'}
            </div>
            
            <div class="divider"></div>
            
            <div style="font-size: 13px;" class="bold">
                Monto Delivery: $${(p.costo || 0).toFixed(2)}<br>
                Equivalente Bs: Ref. ${FormatearBs(totalBs)}
            </div>
            
            <div class="divider"></div>
            
            <div class="text-center sub-title" style="margin-top: 10px;">
                *** GRACIAS POR SU PREFERENCIA ***<br>
                Rastreo: ${window.location.origin}/?track=${fId}
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function(){ window.close(); }, 500);
                };
            <\/script>
        </body>
        </html>
    `);
    ventanaImp.document.close();
};

// ==========================================
// 🚨 FEATURE 3: MÓDULO DE INCIDENCIAS EN VIVO
// ==========================================
window.reportarNovedadIncidencia = function(fId) {
    const p = [...pedidos, ...pedidosPendientesAliados].find(item => item.firestoreId === fId);
    if (!p) return;

    Swal.fire({
        title: '🚨 Reportar Novedad en Vivo',
        html: `
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 10px;">Selecciona la incidencia ocurrida con el pedido de <b>${p.cliente}</b>:</p>
            <select id="swal-motivo-incidencia" class="swal2-input" style="font-size: 0.9rem;">
                <option value="Demora en preparación / cocina">⏱️ Demora en preparación / cocina</option>
                <option value="Cliente no responde las llamadas">📞 Cliente no responde las llamadas</option>
                <option value="Dirección confusa / fuera de zona">📍 Dirección confusa / fuera de zona</option>
                <option value="Repartidor no ha llegado">🛵 Repartidor no ha llegado</option>
                <option value="Otro">❓ Otro motivo</option>
            </select>
            <input id="swal-detalle-incidencia" class="swal2-input" placeholder="Detalle adicional (opcional)" style="font-size: 0.9rem;">
        `,
        showCancelButton: true,
        confirmButtonText: 'Enviar Alerta Central',
        confirmButtonColor: '#ef4444',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const motivo = document.getElementById('swal-motivo-incidencia').value;
            const detalle = document.getElementById('swal-detalle-incidencia').value.trim();
            return { motivo, detalle };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const { motivo, detalle } = result.value;
            const textoIncidencia = detalle ? `${motivo} (${detalle})` : motivo;
            const horaIncidencia = getVenezuelaTime();

            db.collection('pedidos').doc(fId).update({
                incidencia: textoIncidencia,
                fecha_incidencia: horaIncidencia,
                status: 'INCIDENCIA'
            }).then(() => {
                const msgWhatsApp = encodeURIComponent(
                    `*🚨 ALERTA DE INCIDENCIA EN VIVO*\n\n` +
                    `*Pedido ID:* #${p.id || fId.substring(0,6)}\n` +
                    `*Aliado:* ${p.aliado}\n` +
                    `*Cliente:* ${p.cliente} (${p.telefono})\n` +
                    `*Repartidor:* ${p.motorizado || 'Por asignar'}\n` +
                    `*Hora Reporte:* ${horaIncidencia}\n\n` +
                    `⚠️ *NOVEDAD:* ${textoIncidencia}\n\n` +
                    `Por favor, Central de Despacho tomar acción inmediata.`
                );

                Swal.fire("Novedad Registrada", "Se ha actualizado la orden y notificado a la central.", "warning")
                .then(() => {
                    window.open(`https://api.whatsapp.com/send?phone=584244529892&text=${msgWhatsApp}`, '_blank');
                });
            });
        }
    });
};

window.setLoginRole = function(role) {
    rolSeleccionadoLogin = role;
    const btnAdmin = document.getElementById('toggle-admin');
    const btnAliado = document.getElementById('toggle-aliado');
    const inputUser = document.getElementById('username-input');

    if (btnAdmin) btnAdmin.classList.remove('active');
    if (btnAliado) btnAliado.classList.remove('active');
    
    if (role === 'admin') {
        if (btnAdmin) btnAdmin.classList.add('active');
        if (inputUser) inputUser.placeholder = "Nombre de Usuario";
    } else {
        if (btnAliado) btnAliado.classList.add('active');
        if (inputUser) inputUser.placeholder = "Usuario de Aliado Asignado";
    }
};

window.validateLogin = function() {
    const userIn = document.getElementById('username-input').value.trim();
    const pinIn = document.getElementById('pin-input').value.trim();

    if (!userIn || !pinIn) {
        Swal.fire("Campos vacíos", "Por favor ingresa usuario y contraseña.", "warning");
        return;
    }

    if (rolSeleccionadoLogin === 'admin') {
        if (userIn.toLowerCase() === 'admin' && pinIn === '1987') { 
            usuarioActual = { username: "Admin", rol: "admin", aliadoComercial: "" };
            arrancarAplicacion();
        } else {
            Swal.fire("Error de Acceso", "Usuario o PIN de administrador incorrectos.", "error");
        }
    } else {
        if (!aliados || aliados.length === 0) {
            Swal.fire("Error de Sistema", "La lista de aliados se está sincronizando de la base de datos. Espere un segundo.", "error");
            return;
        }

        const aliadoExiste = aliados.find(a => {
            const campoUsuario = a.usuario || a.usuarioLogin || a.username;
            return campoUsuario && campoUsuario.toString().toLowerCase() === userIn.toLowerCase();
        });
        
        if (aliadoExiste) {
            const pinRegistrado = aliadoExiste.pin || aliadoExiste.contrasena || aliadoExiste.pinIn;
            
            if (String(pinRegistrado) === pinIn) {
                const nombreAliado = aliadoExiste.nombre || aliadoExiste.nombreComercial || "Aliado";
                usuarioActual = { username: nombreAliado, rol: "aliado", aliadoComercial: nombreAliado };
                arrancarPortalAliado();
            } else {
                Swal.fire("Error de Acceso", "El PIN introducido es incorrecto.", "error");
            }
        } else {
            Swal.fire("Error de Acceso", "El usuario de aliado no coincide con ningún registro.", "error");
        }
    }
};

window.arrancarPortalAliado = function() {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('portal-aliado-container').style.display = 'block';
    document.getElementById('portal-nombre-aliado').innerText = usuarioActual.aliadoComercial;
    
    const elFechaPort = document.getElementById('port-fecha');
    if (elFechaPort) elFechaPort.value = getVenezuelaDate();

    initCotizadorAliado();
    renderPedidosPortalAliado();
};

window.logoutPortal = function() {
    document.getElementById('portal-aliado-container').style.display = 'none';
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('form-portal-aliado').reset();
    usuarioActual = { username: "", rol: "admin", aliadoComercial: "" };
};

function initCotizadorAliado() {
    const selectZona = document.getElementById('port-cotizador-zona');
    if (!selectZona) return;
    
    selectZona.innerHTML = '<option value="">-- Seleccionar Zona de Destino --</option>';
    for (const [zona, tarifa] of Object.entries(TARIFARIO_ZONAS)) {
        selectZona.innerHTML += `<option value="${tarifa}">${zona} ($${tarifa.toFixed(2)})</option>`;
    }
}

window.calcularTarifaCotizador = function() {
    const selectZona = document.getElementById('port-cotizador-zona');
    const displayTarifa = document.getElementById('port-cotizador-monto');
    if (!selectZona || !displayTarifa) return;

    const tarifa = parseFloat(selectZona.value) || 0;
    displayTarifa.innerText = tarifa > 0 ? `$${tarifa.toFixed(2)}` : '$0.00';
};

function obtenerBarraEstatus(p) {
    let paso1 = "active", paso2 = "", paso3 = "", paso4 = "";
    let textoEstatus = "Solicitado";

    if (p.completado) {
        paso1 = "active"; paso2 = "active"; paso3 = "active"; paso4 = "active";
        textoEstatus = "Entregado";
    } else if (p.motorizado && p.motorizado !== "Por asignar" && p.motorizado !== "Pendiente por Asignar") {
        paso1 = "active"; paso2 = "active"; paso3 = "active";
        textoEstatus = "En Ruta";
    } else if (!p.pendiente_aprobacion) {
        paso1 = "active"; paso2 = "active";
        textoEstatus = "Asignado Central";
    }

    return `
        <div class="status-tracker-container" style="font-size:0.75rem;">
            <div style="font-weight:bold; margin-bottom:4px; color:#ff6600;">📌 ${textoEstatus}</div>
            <div style="display:flex; gap:4px; align-items:center;">
                <span style="height:6px; flex:1; border-radius:3px; background:${paso1 ? '#ff6600' : '#cbd5e1'};"></span>
                <span style="height:6px; flex:1; border-radius:3px; background:${paso2 ? '#ff6600' : '#cbd5e1'};"></span>
                <span style="height:6px; flex:1; border-radius:3px; background:${paso3 ? '#0284c7' : '#cbd5e1'};"></span>
                <span style="height:6px; flex:1; border-radius:3px; background:${paso4 ? '#10b981' : '#cbd5e1'};"></span>
            </div>
        </div>
    `;
}

function renderPedidosPortalAliado() {
    const tbody = document.getElementById('tabla-portal-aliado-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const misPendientes = pedidosPendientesAliados.filter(p => p.aliado === usuarioActual.aliadoComercial);
    const misAprobados = pedidos.filter(p => p.aliado === usuarioActual.aliadoComercial);
    
    const todosMisPedidos = [...misPendientes, ...misAprobados].sort((a, b) => b.id - a.id);

    let cantPendientes = misPendientes.length;
    let cantAprobados = misAprobados.length;
    let totalInversionUSD = misAprobados.reduce((sum, p) => sum + (p.costo || 0), 0);

    const elDashPend = document.getElementById('aliado-dash-pendientes');
    const elDashAct = document.getElementById('aliado-dash-activos');
    const elDashInversion = document.getElementById('aliado-dash-inversion');

    if (elDashPend) elDashPend.innerText = cantPendientes;
    if (elDashAct) elDashAct.innerText = cantAprobados;
    if (elDashInversion) elDashInversion.innerText = `$${totalInversionUSD.toFixed(2)}`;

    if (todosMisPedidos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;" class="text-italic">No posees pedidos registrados en la plataforma.</td></tr>`;
        return;
    }

    todosMisPedidos.forEach(p => {
        const barraProgreso = obtenerBarraEstatus(p);
        const mapLinkHtml = p.maps_link ? `<br><a href="${p.maps_link}" target="_blank" style="color:#0284c7; font-size:0.75rem;"><i class="fa-solid fa-location-dot"></i> Ver Mapa</a>` : '';
        const pagoHtml = p.metodo_pago ? `<br><span class="text-sub">💳 ${p.metodo_pago}</span>` : '';
        const pesoHtml = p.tamano_paquete ? `<br><span class="text-sub">📦 ${p.tamano_paquete}</span>` : '';
        const badgeIncidencia = p.incidencia ? `<br><span style="color:#ef4444; font-size:0.75rem; font-weight:bold;">🚨 ${p.incidencia}</span>` : '';

        tbody.innerHTML += `
            <tr>
                <td>${p.fecha}<br><span class="text-sub">${p.hora || ''}</span>${p.hora_programada ? `<br><small style="color:#d97706;">⏰ ${p.hora_programada}</small>` : ''}</td>
                <td class="text-bold">${p.cliente}<span class="text-sub">${p.telefono}</span>${pagoHtml}</td>
                <td>${p.direccion}${mapLinkHtml}${badgeIncidencia}</td>
                <td style="min-width:130px;">${barraProgreso}</td>
                <td class="text-italic">${p.motorizado || 'Por asignar'}${pesoHtml}</td>
                <td class="text-orange" style="font-weight:bold;">${p.costo > 0 ? '$' + p.costo.toFixed(2) : 'Por calcular'}</td>
                <td>
                    <div style="display:flex; gap:4px;">
                        <button type="button" class="action-btn" onclick="copiarLinkRastreo('${p.firestoreId}')" title="Copiar Link de Rastreo">🔗</button>
                        <button type="button" class="action-btn" onclick="imprimirTicketTermico('${p.firestoreId}')" title="Imprimir Ticket Térmico">🖨️</button>
                        <button type="button" class="action-btn" onclick="reportarNovedadIncidencia('${p.firestoreId}')" title="Reportar Novedad">⚠️</button>
                        <button type="button" class="action-btn" onclick="duplicarPedidoAliado('${p.firestoreId}')" title="Duplicar Orden">🔄</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

window.duplicarPedidoAliado = function(fId) {
    const p = [...pedidos, ...pedidosPendientesAliados].find(item => item.firestoreId === fId);
    if (!p) return;

    if (document.getElementById('port-nombre')) document.getElementById('port-nombre').value = p.cliente || '';
    if (document.getElementById('port-telefono')) document.getElementById('port-telefono').value = p.telefono || '';
    if (document.getElementById('port-direccion')) document.getElementById('port-direccion').value = p.direccion || '';
    if (document.getElementById('port-detalles')) document.getElementById('port-detalles').value = p.detalles || '';
    if (document.getElementById('port-maps-link')) document.getElementById('port-maps-link').value = p.maps_link || '';
    if (document.getElementById('port-metodo-pago')) document.getElementById('port-metodo-pago').value = p.metodo_pago || 'Efectivo USD';
    if (document.getElementById('port-tamano-paquete')) document.getElementById('port-tamano-paquete').value = p.tamano_paquete || 'Mediano / Bolsa';

    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Datos duplicados en el formulario de envío.',
        showConfirmButton: false,
        timer: 2000
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.exportarResumenAliadoExcel = function() {
    const misAprobados = pedidos.filter(p => p.aliado === usuarioActual.aliadoComercial);
    if (misAprobados.length === 0) {
        Swal.fire("Sin Registros", "No tienes entregas registradas para exportar.", "info");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Fecha,Hora,Cliente,Telefono,Direccion,Metodo Pago,Motorizado,Monto USD,Estatus\n";

    misAprobados.forEach(p => {
        const estatus = p.completado ? "Entregado" : "En Ruta";
        const row = `"${p.fecha}","${p.hora || ''}","${p.cliente}","${p.telefono}","${p.direccion.replace(/"/g, '""')}","${p.metodo_pago || 'N/A'}","${p.motorizado || 'N/A'}","${(p.costo || 0).toFixed(2)}","${estatus}"`;
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Entregas_${usuarioActual.aliadoComercial.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.registrarComprobantePagoAliado = function() {
    const misAprobados = pedidos.filter(p => p.aliado === usuarioActual.aliadoComercial);
    const totalAcumulado = misAprobados.reduce((sum, p) => sum + (p.costo || 0), 0);

    Swal.fire({
        title: 'Reportar Pago de Deliverys',
        html: `
            <p style="font-size:0.9rem; color:#475569; margin-bottom:10px;">Total Acumulado Actual: <b>$${totalAcumulado.toFixed(2)}</b></p>
            <input id="swal-ref-pago" class="swal2-input" placeholder="Número de Referencia / N° Transacción">
            <input id="swal-monto-pago" type="number" step="0.01" class="swal2-input" placeholder="Monto Transferido ($ USD)">
        `,
        showCancelButton: true,
        confirmButtonText: 'Enviar Comprobante',
        confirmButtonColor: '#ff6600',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const ref = document.getElementById('swal-ref-pago').value.trim();
            const monto = document.getElementById('swal-monto-pago').value.trim();
            if (!ref || !monto) {
                Swal.showValidationMessage('Ingresa la referencia y el monto.');
                return false;
            }
            return { ref, monto };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const { ref, monto } = result.value;
            
            db.collection('gastos').add({
                detalle: `[COMPROBANTE ALIADO] ${usuarioActual.aliadoComercial} - Ref: ${ref}`,
                monto: parseFloat(monto) || 0,
                fecha: getVenezuelaDate(),
                tipo: 'Abono Aliado'
            }).then(() => {
                const msgWhatsApp = encodeURIComponent(
                    `*💰 COMPROBANTE DE PAGO ENVIADO*\n\n` +
                    `*Aliado Comercial:* ${usuarioActual.aliadoComercial}\n` +
                    `*Monto Reportado:* $${parseFloat(monto).toFixed(2)}\n` +
                    `*N° de Referencia:* ${ref}\n` +
                    `*Fecha:* ${getVenezuelaDate()}\n\n` +
                    `Por favor, verificar y conciliar en la relación de cuentas central.`
                );
                
                Swal.fire("Pago Registrado", "El comprobante fue indexado. Procede a notificar a SunDelivery.", "success")
                .then(() => {
                    window.open(`https://api.whatsapp.com/send?phone=584244529892&text=${msgWhatsApp}`, '_blank');
                });
            });
        }
    });
};

function arrancarAplicacion() {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('app-container').classList.add('active');
    
    const hoyISO = getVenezuelaDate();
    document.getElementById('filtro-fecha-desde').value = hoyISO;
    document.getElementById('filtro-fecha-hasta').value = hoyISO;
    document.getElementById('invoice-fecha-desde').value = hoyISO;
    document.getElementById('invoice-fecha-hasta').value = hoyISO;

    const elFechaPed = document.getElementById('ped-fecha');
    if (elFechaPed) elFechaPed.value = hoyISO;

    const badge = document.getElementById('badge-rol');
    if (badge) badge.innerText = usuarioActual.rol.toUpperCase();
    
    if (usuarioActual.rol === 'aliado') {
        document.querySelectorAll('.v-admin').forEach(el => el.style.display = 'none');
        document.getElementById('filtro-aliado-box').style.display = 'none';
        document.getElementById('container-select-aliado').style.display = 'none';
    } else {
        document.querySelectorAll('.v-admin').forEach(el => el.style.display = 'block');
        document.getElementById('filtro-aliado-box').style.display = 'block';
        document.getElementById('container-select-aliado').style.display = 'block';
    }

    initRealTimeListener();
    loadComisionConfig();
    
    document.addEventListener("click", function (e) {
        if (!e.target.closest('.form-group')) {
            const sugTel = document.getElementById("sug-telefono");
            const sugNom = document.getElementById("sug-nombre");
            if (sugTel) sugTel.style.display = "none";
            if (sugNom) sugNom.style.display = "none";
        }
    });
}

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`view-${tabId}`).classList.add('active');
};

function loadComisionConfig() {
    db.collection('configuracion').doc('general').get().then(doc => {
        if (doc.exists && doc.data().comision_motorizado) {
            porcComisionMotorizado = doc.data().comision_motorizado;
            document.getElementById('cfg-comision').value = Math.round(porcComisionMotorizado * 100);
        } else {
            db.collection('configuracion').doc('general').set({ comision_motorizado: 0.70 });
        }
    });
}

window.saveComisionConfig = function() {
    const inputVal = parseFloat(document.getElementById('cfg-comision').value) || 70;
    const decimalVal = inputVal / 100;
    db.collection('configuracion').doc('general').update({ comision_motorizado: decimalVal })
    .then(() => {
        porcComisionMotorizado = decimalVal;
        Swal.fire("Ajuste Guardado", `La comisión global se fijó en ${inputVal}%`, "success");
        renderPedidos();
    });
};

function initRealTimeListener() {
    db.collection('pedidos').onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === "added" && !cargaInicialPedidos) {
                const pedidoData = change.doc.data();
                if (pedidoData.pendiente_aprobacion) return;

                if (usuarioActual.rol === 'admin' || (usuarioActual.rol === 'aliado' && pedidoData.aliado === usuarioActual.aliadoComercial)) {
                    reproducirNotificacion();
                    mostrarNotificacionFlotante(pedidoData);
                }
            }
        });
        cargaInicialPedidos = false;
    });
}

function reproducirNotificacion() {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav");
    audio.play().catch(() => {});
}

function mostrarNotificacionFlotante(pedido) {
    const cont = document.getElementById('contenedor-alertas-flotantes');
    if (!cont) return;
    const alertBox = document.createElement('div');
    alertBox.className = 'alerta-notificacion-rt';
    alertBox.innerHTML = `
        <div style="font-weight:800; color:#ff6600; margin-bottom:4px;"><i class="fa-solid fa-bell"></i> ¡NUEVO PEDIDO ENTRANTE!</div>
        <div style="font-size:0.85rem; line-height:1.4;">
            <b>Aliado:</b> ${pedido.aliado}<br>
            <b>Cliente:</b> ${pedido.cliente}<br>
            <b>Destino:</b> ${pedido.direccion}
        </div>
    `;
    cont.appendChild(alertBox);
    setTimeout(() => { alertBox.remove(); }, 7000);
}

window.toggleInvoiceFields = function() {
    const tipo = document.getElementById('invoice-tipo-entidad').value;
    if (tipo === 'ALIADO') {
        document.getElementById('invoice-aliado-group').style.display = 'block';
        document.getElementById('invoice-motorizado-group').style.display = 'none';
    } else {
        document.getElementById('invoice-aliado-group').style.display = 'none';
        document.getElementById('invoice-motorizado-group').style.display = 'block';
    }
};

window.processInvoiceGeneration = function() {
    const tipo = document.getElementById('invoice-tipo-entidad').value;
    if (tipo === 'ALIADO') {
        generateAliadoInvoice();
    } else {
        generateMotorizadoPayrollInvoice();
    }
};

function generateAliadoInvoice() {
    const nombreAliado = document.getElementById('invoice-aliado').value;
    const fechaDesde = document.getElementById('invoice-fecha-desde').value;
    const fechaHasta = document.getElementById('invoice-fecha-hasta').value;
    
    if (!nombreAliado) { Swal.fire("Campo requerido", "Selecciona un aliado comercial.", "info"); return; }
    if (!fechaDesde || !fechaHasta) { Swal.fire("Fechas faltantes", "Asigna el rango temporal.", "info"); return; }

    const tasa = parseFloat(document.getElementById('invoice-tasa').value) || 45.50;

    const pedidosFiltrados = pedidos.filter(p => {
        if (p.pendiente_aprobacion) return false; 
        const pedidoFechaISO = parseDateVEToISO(p.fecha);
        if (nombreAliado !== "TODOS_LOS_ALIADOS" && p.aliado !== nombreAliado) return false;
        if (pedidoFechaISO < fechaDesde || pedidoFechaISO > fechaHasta) return false;
        return true;
    });

    if (pedidosFiltrados.length === 0) {
        Swal.fire("Sin datos", "No existen órdenes registradas en esos días para la selección.", "info");
        return;
    }

    document.getElementById('fact-titulo-documento').innerText = "RELACIÓN DETALLADA DE SERVICIOS";

    if (nombreAliado === "TODOS_LOS_ALIADOS") {
        document.getElementById('fact-bloque-entidad').innerHTML = `<b style="font-size: 1.1rem;">Aliado Comercial:</b> <span style="font-size: 1.1rem; font-weight: bold; color: #1e293b;">CONSOLIDADO GLOBAL</span>`;
    } else {
        document.getElementById('fact-bloque-entidad').innerHTML = `<b style="font-size: 1.1rem;">Aliado Comercial:</b> <span style="font-size: 1.1rem; font-weight: bold; color: #ff6600;">${nombreAliado}</span>`;
    }

    const fDesdeFormateada = fechaDesde.split('-').reverse().join('/');
    const fHastaFormateada = fechaHasta.split('-').reverse().join('/');
    document.getElementById('fact-fecha-relacion').innerText = `${fDesdeFormateada} al ${fHastaFormateada}`;
    document.getElementById('fact-tasa').innerText = tasa.toFixed(2);

    const tbodyFactura = document.getElementById('fact-detalles-ordenes');
    tbodyFactura.innerHTML = '';
    
    let acumuladoUSD = 0;
    pedidosFiltrados.forEach(p => {
        acumuladoUSD += p.costo;
        const tagAliado = nombreAliado === "TODOS_LOS_ALIADOS" ? `<b style="color:#ff6600;">[${p.aliado}]</b> ` : '';
        
        tbodyFactura.innerHTML += `
            <tr style="border-bottom: 1px dashed #cbd5e1; font-size: 0.95rem; color: #1e293b;">
                <td style="padding: 10px 4px; vertical-align: top;">
                    <div style="font-weight: bold; font-size: 1rem; color: #0f172a; margin-bottom: 3px;">
                        ${tagAliado}👤 Cliente: ${p.cliente} <span style="font-size: 0.85rem; color: #64748b; font-weight: normal;">(${p.telefono || 'Sin tlf'})</span>
                    </div>
                    <div style="font-size: 0.9rem; color: #334155; margin-bottom: 3px;">
                        📍 <b>Dirección:</b> ${p.direccion}
                    </div>
                    <div style="font-size: 0.85rem; color: #475569; margin-bottom: 2px;">
                        📦 <b>Detalle:</b> ${p.detalles || 'Despacho de entrega'}
                    </div>
                    <div style="font-size: 0.8rem; color: #64748b;">
                        📅 <b>Fecha:</b> ${p.fecha} ${p.hora ? '| ⏰ ' + p.hora : ''} &nbsp;|&nbsp; 🛵 <b>Repartidor:</b> ${p.motorizado || 'Sin asignar'}
                    </div>
                </td>
                <td style="padding: 10px 4px; text-align: right; font-weight: bold; font-size: 1.1rem; color: #0f172a; vertical-align: top; white-space: nowrap;">
                    $${p.costo.toFixed(2)}
                </td>
            </tr>
        `;
    });

    document.getElementById('fact-total-usd').innerText = acumuladoUSD.toFixed(2);
    document.getElementById('fact-total-bs').innerText = FormatearBs(acumuladoUSD * tasa);
    document.getElementById('footer-pago-movil').innerHTML = "<b>Banco:</b> Banesco / Venezuela<br><b>Teléfono:</b> 04244529892<br><b>RIF:</b> 18410871";

    renderInvoiceToImage(nombreAliado === "TODOS_LOS_ALIADOS" ? "Consolidado_General" : nombreAliado);
}

function generateMotorizadoPayrollInvoice() {
    const nomMoto = document.getElementById('invoice-motorizado-payroll').value;
    const fDesde = document.getElementById('invoice-fecha-desde').value;
    const fHasta = document.getElementById('invoice-fecha-hasta').value;

    if (!nomMoto) { Swal.fire("Campo requerido", "Selecciona un motorizado para liquidar.", "info"); return; }
    if (!fDesde || !fHasta) { Swal.fire("Fechas faltantes", "Asigna el rango temporal.", "info"); return; }

    const tasa = parseFloat(document.getElementById('invoice-tasa').value) || 45.50;

    const pedidosFiltrados = pedidos.filter(p => {
        if (p.pendiente_aprobacion) return false; 
        const pedidoFechaISO = parseDateVEToISO(p.fecha);
        if (p.motorizado !== nomMoto) return false;
        if (pedidoFechaISO < fDesde || pedidoFechaISO > fHasta) return false;
        return true;
    });

    if (pedidosFiltrados.length === 0) {
        Swal.fire("Sin datos", "No existen rutas completadas por este repartidor en el rango seleccionado.", "info");
        return;
    }

    document.getElementById('fact-titulo-documento').innerText = "RECIBO DE PAGO DE MOTORIZADO";
    document.getElementById('fact-bloque-entidad').innerHTML = `<b style="font-size: 1.1rem;">Motorizado:</b> <span style="font-size: 1.1rem; font-weight: bold; color: #ff6600;">${nomMoto}</span><br><b>Comisión Asignada:</b> <span>${Math.round(porcComisionMotorizado * 100)}%</span>`;
    
    const fDesdeFormateada = fDesde.split('-').reverse().join('/');
    const fHastaFormateada = fHasta.split('-').reverse().join('/');
    document.getElementById('fact-fecha-relacion').innerText = `${fDesdeFormateada} al ${fHastaFormateada}`;
    document.getElementById('fact-tasa').innerText = tasa.toFixed(2);

    const tbodyFactura = document.getElementById('fact-detalles-ordenes');
    tbodyFactura.innerHTML = '';

    let totalProducido = 0;
    pedidosFiltrados.forEach(p => {
        totalProducido += p.costo;
        tbodyFactura.innerHTML += `
            <tr style="border-bottom: 1px dashed #cbd5e1; font-size: 0.95rem; color: #1e293b;">
                <td style="padding: 10px 4px; vertical-align: top;">
                    <div style="font-weight: bold; font-size: 1rem; color: #0f172a; margin-bottom: 3px;">
                        👤 Cliente: ${p.cliente}
                    </div>
                    <div style="font-size: 0.9rem; color: #334155; margin-bottom: 3px;">
                        📍 <b>Entrega:</b> ${p.direccion}
                    </div>
                    <div style="font-size: 0.85rem; color: #475569;">
                        🏪 <b>Aliado:</b> ${p.aliado} &nbsp;|&nbsp; 📅 <b>Fecha:</b> ${p.fecha} ${p.hora ? '| ' + p.hora : ''}
                    </div>
                </td>
                <td style="padding: 10px 4px; text-align: right; font-weight: bold; font-size: 1.1rem; color: #0f172a; vertical-align: top; white-space: nowrap;">
                    $${p.costo.toFixed(2)}
                </td>
            </tr>
        `;
    });

    let comisionGanada = totalProducido * porcComisionMotorizado;

    tbodyFactura.innerHTML += `
        <tr style="border-top: 2px solid #000;">
            <td style="padding: 10px 0; font-weight: bold; font-size: 1rem;">Subtotal Producido:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold; font-size: 1.1rem;">$${totalProducido.toFixed(2)}</td>
        </tr>
        <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #10b981; font-size: 1.05rem;">Comisión Neta (${Math.round(porcComisionMotorizado * 100)}%):</td>
            <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #10b981; font-size: 1.2rem;">$${comisionGanada.toFixed(2)}</td>
        </tr>
    `;

    document.getElementById('fact-total-usd').innerText = comisionGanada.toFixed(2);
    document.getElementById('fact-total-bs').innerText = FormatearBs(comisionGanada * tasa);
    document.getElementById('footer-pago-movil').innerHTML = "<b>Recibo generado automáticamente.</b><br>Pago correspondiente a comisiones por servicios de logística acumulados.";

    renderInvoiceToImage(nomMoto);
}

function renderInvoiceToImage(entidadNombre) {
    const disenoRecibo = document.getElementById('recibo-diseno-factura');
    disenoRecibo.style.display = 'block';

    Swal.fire({ title: 'Compilando imagen...', didOpen: () => { Swal.showLoading(); } });

    html2canvas(disenoRecibo, { useCORS: true, scale: 3, backgroundColor: "#ffffff" }).then(canvas => {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        document.getElementById('imagen-vista-previa').src = imgData;
        document.getElementById('seccion-vista-previa').style.display = 'block';
        document.getElementById('boton-descargar-jpg').href = imgData;
        
        const nombreArchivo = entidadNombre.replace(/\s+/g, '_');
        document.getElementById('boton-descargar-jpg').download = `Recibo_${nombreArchivo}.jpg`;
        
        disenoRecibo.style.display = 'none';
        Swal.close();
        document.getElementById('seccion-vista-previa').scrollIntoView({ behavior: 'smooth' });
    });
}

function syncCloudData() {
    db.collection('aliados').onSnapshot(snapshot => {
        aliados = [];
        snapshot.forEach(doc => aliados.push({ firestoreId: doc.id, ...doc.data() }));
        renderAliados();
        updateSelectDropdowns();
    });

    db.collection('motorizados').onSnapshot(snapshot => {
        motorizados = [];
        snapshot.forEach(doc => motorizados.push({ firestoreId: doc.id, ...doc.data() }));
        renderMotorizados();
        updateSelectDropdowns();
    });

    db.collection('gastos').onSnapshot(snapshot => {
        gastos = [];
        snapshot.forEach(doc => gastos.push({ firestoreId: doc.id, ...doc.data() }));
        renderGastos();
    });

    db.collection('clientes').onSnapshot(snapshot => {
        directorioClientes = [];
        snapshot.forEach(doc => directorioClientes.push({ firestoreId: doc.id, ...doc.data() }));
        renderClientesDirectorio();
    });

    db.collection('pedidos').onSnapshot(snapshot => {
        pedidos = [];
        pedidosPendientesAliados = []; 
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.pendiente_aprobacion === true) {
                pedidosPendientesAliados.push({ firestoreId: doc.id, ...data });
            } else {
                pedidos.push({ firestoreId: doc.id, ...data });
            }
        });
        
        pedidos.sort((a, b) => b.id - a.id);
        renderPedidos();
        renderPedidosPendientesAliadosTable(); 
        
        if (usuarioActual.rol === 'aliado') {
            renderPedidosPortalAliado();
        }
    });
}

function renderPedidosPendientesAliadosTable() {
    const tbody = document.getElementById('tabla-pendientes-aliados-body');
    const panelBox = document.getElementById('panel-pendientes-aliados-box');
    
    if (usuarioActual.rol !== 'admin' || !tbody || !panelBox) return;
    
    tbody.innerHTML = '';
    if (pedidosPendientesAliados.length === 0) {
        panelBox.style.display = "none";
        return;
    }
    
    panelBox.style.display = "block";
    pedidosPendientesAliados.forEach(p => {
        const extraInfo = p.metodo_pago ? `<br><small>💳 ${p.metodo_pago}</small>` : '';
        const mapInfo = p.maps_link ? `<br><a href="${p.maps_link}" target="_blank" style="font-size:0.75rem; color:#0284c7;">📍 Mapa GPS</a>` : '';

        tbody.innerHTML += `
            <tr>
                <td class="text-bold" style="color: #ff6600;">${p.aliado}</td>
                <td class="text-bold">${p.cliente}<span class="text-sub">${p.telefono}</span>${extraInfo}</td>
                <td>${p.direccion}${mapInfo}</td>
                <td>${p.detalles} ${p.tamano_paquete ? `<br><small>📦 ${p.tamano_paquete}</small>` : ''}</td>
                <td>
                    <button type="button" class="btn-submit" style="padding:6px 10px; font-size:0.78rem; width:auto; background:#ff6600;" onclick="cargarPedidoPendienteAlFormulario('${p.firestoreId}')">
                        <i class="fa-solid fa-bolt"></i> Procesar Orden
                    </button>
                </td>
            </tr>
        `;
    });
}

window.cargarPedidoPendienteAlFormulario = function(fId) {
    const p = pedidosPendientesAliados.find(item => item.firestoreId === fId);
    if (!p) return;
    
    document.getElementById('ped-nombre').value = p.cliente;
    document.getElementById('ped-telefono').value = p.telefono;
    document.getElementById('ped-direccion').value = p.direccion;
    document.getElementById('ped-aliado').value = p.aliado;
    document.getElementById('ped-detalles').value = `${p.detalles || ''} ${p.metodo_pago ? '[Pago: ' + p.metodo_pago + ']' : ''} ${p.tamano_paquete ? '[Paquete: ' + p.tamano_paquete + ']' : ''}`;
    
    const inputFecha = document.getElementById('ped-fecha');
    if (inputFecha) {
        inputFecha.value = parseDateVEToISO(p.fecha) || getVenezuelaDate();
    }

    document.getElementById('ped-costo').value = "";
    document.getElementById('ped-motorizado').value = "";
    
    editPedidoId = "PENDIENTE_" + fId; 
    
    document.getElementById('form-pedido-title').innerHTML = `<i class="fa-solid fa-truck-ramp-box" style="color:#ff6600"></i> Procesando Pedido de Aliado [${p.aliado}]`;
    
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'Datos cargados. Complete motorizado y costo.',
        showConfirmButton: false,
        timer: 3500
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.processPortalPedido = function(e) {
    e.preventDefault();
    const clientName = document.getElementById('port-nombre').value.trim();
    const clientPhone = document.getElementById('port-telefono').value.trim();
    const clientDir = document.getElementById('port-direccion').value.trim();
    const detailText = document.getElementById('port-detalles').value.trim();
    
    const horaProgramadaVal = document.getElementById('port-hora-programada') ? document.getElementById('port-hora-programada').value : 'Inmediato';
    const metodoPagoVal = document.getElementById('port-metodo-pago') ? document.getElementById('port-metodo-pago').value : 'Efectivo USD';
    const mapsLinkVal = document.getElementById('port-maps-link') ? document.getElementById('port-maps-link').value.trim() : '';
    const tamanoPaqueteVal = document.getElementById('port-tamano-paquete') ? document.getElementById('port-tamano-paquete').value : 'Mediano / Bolsa';

    const inputFechaPort = document.getElementById('port-fecha');
    const selectedFechaPort = inputFechaPort && inputFechaPort.value ? inputFechaPort.value : getVenezuelaDate();
    const fechaFormatSalida = formatISOToVE(selectedFechaPort);

    const numericId = Date.now();

    const pedidoPreRegistro = {
        id: numericId,
        fecha: fechaFormatSalida,
        hora: getVenezuelaTime(),
        hora_programada: horaProgramadaVal,
        metodo_pago: metodoPagoVal,
        maps_link: mapsLinkVal,
        tamano_paquete: tamanoPaqueteVal,
        cliente: clientName,
        telefono: clientPhone,
        direccion: clientDir,
        aliado: usuarioActual.aliadoComercial,
        motorizado: "",
        costo: 0,
        detalles: detailText,
        pendiente_aprobacion: true 
    };

    Swal.fire({ title: 'Sincronizando con central...', didOpen: () => { Swal.showLoading(); } });

    db.collection('pedidos').add(pedidoPreRegistro).then(() => {
        Swal.close();
        document.getElementById('form-portal-aliado').reset();
        if (inputFechaPort) inputFechaPort.value = getVenezuelaDate();
        
        const msgCentralAdmin = encodeURIComponent(
            `*📌 NOTIFICACIÓN DE PORTAL DE ALIADOS*\n\n` +
            `El aliado comercial *${pedidoPreRegistro.aliado}* ha generado una nueva solicitud de despacho.\n\n` +
            `📅 *Fecha Solicitada:* ${pedidoPreRegistro.fecha}\n` +
            `⏰ *Tipo Entrega:* ${pedidoPreRegistro.hora_programada}\n` +
            `👤 *Cliente:* ${pedidoPreRegistro.cliente}\n` +
            `📞 *Teléfono:* +58 ${pedidoPreRegistro.telefono}\n` +
            `📍 *Dirección:* ${pedidoPreRegistro.direccion}\n` +
            `${pedidoPreRegistro.maps_link ? '🗺️ *Ubicación GPS:* ' + pedidoPreRegistro.maps_link + '\n' : ''}` +
            `💳 *Método de Pago Cliente:* ${pedidoPreRegistro.metodo_pago}\n` +
            `📦 *Tamaño/Peso:* ${pedidoPreRegistro.tamano_paquete}\n` +
            `📝 *Detalle:* ${pedidoPreRegistro.detalles}\n\n` +
            `⚠️ *Acción:* Ingrese al panel central para asignar unidad de motorizado y tarifa.`
        );

        Swal.fire({
            title: "¡Solicitud Enviada!",
            text: "Su pedido ha sido indexado. Presione el botón para notificar a despacho central vía WhatsApp.",
            icon: "success",
            confirmButtonText: "Notificar por WhatsApp",
            confirmButtonColor: "#25d366"
        }).then(() => {
            window.open(`https://api.whatsapp.com/send?phone=584244529892&text=${msgCentralAdmin}`, '_blank');
        });
    });
};

function obtenerHistorialClientesUnificado() {
    const mapaClientes = new Map();

    if (Array.isArray(directorioClientes)) {
        directorioClientes.forEach(c => {
            const tlf = c.telefono ? c.telefono.trim() : '';
            if (tlf) {
                mapaClientes.set(tlf, {
                    nombre: c.nombre || '',
                    telefono: tlf,
                    direccion: c.direccion || '',
                    origen: 'Cartera'
                });
            }
        });
    }

    if (Array.isArray(pedidos)) {
        pedidos.forEach(p => {
            const tlf = p.telefono ? p.telefono.trim() : '';
            if (tlf && !mapaClientes.has(tlf)) {
                mapaClientes.set(tlf, {
                    nombre: p.cliente || p.nombre || '',
                    telefono: tlf,
                    direccion: p.direccion || '',
                    origen: 'Historial'
                });
            }
        });
    }

    return Array.from(mapaClientes.values());
}

window.triggerAutocomplete = function(type) {
    const valInputTel = document.getElementById("ped-telefono") ? document.getElementById("ped-telefono").value.trim().toLowerCase() : '';
    const valInputNom = document.getElementById("ped-nombre") ? document.getElementById("ped-nombre").value.trim().toLowerCase() : '';
    
    const boxTel = document.getElementById("sug-telefono");
    const boxNom = document.getElementById("sug-nombre");

    if (boxTel) { boxTel.innerHTML = ""; boxTel.style.display = "none"; }
    if (boxNom) { boxNom.innerHTML = ""; boxNom.style.display = "none"; }

    const universoClientes = obtenerHistorialClientesUnificado();

    if (type === 'telefono' && valInputTel.length >= 2) {
        const coincidencias = universoClientes.filter(c => c.telefono.toLowerCase().includes(valInputTel));
        if (coincidencias.length > 0 && boxTel) {
            boxTel.style.display = "block";
            coincidencias.slice(0, 5).forEach(c => {
                const tagOrigen = c.origen === 'Cartera' ? '⭐ Cliente' : '📦 Historial';
                const div = document.createElement("div");
                div.className = "suggestion-item";
                div.innerHTML = `<span>📱 <b>${c.telefono}</b> - ${c.nombre}</span><span class="sug-meta">${tagOrigen}</span>`;
                div.onclick = () => fillFormFromSuggestion(c);
                boxTel.appendChild(div);
            });
        }
    } 
    else if (type === 'nombre' && valInputNom.length >= 2) {
        const coincidencias = universoClientes.filter(c => c.nombre.toLowerCase().includes(valInputNom));
        if (coincidencias.length > 0 && boxNom) {
            boxNom.style.display = "block";
            coincidencias.slice(0, 5).forEach(c => {
                const tagOrigen = c.origen === 'Cartera' ? '⭐ Cliente' : '📦 Historial';
                const div = document.createElement("div");
                div.className = "suggestion-item";
                div.innerHTML = `<span>👤 <b>${c.nombre}</b> - ${c.telefono}</span><span class="sug-meta">${tagOrigen}</span>`;
                div.onclick = () => fillFormFromSuggestion(c);
                boxNom.appendChild(div);
            });
        }
    }
};

function fillFormFromSuggestion(cliente) {
    if (document.getElementById("ped-telefono")) document.getElementById("ped-telefono").value = cliente.telefono;
    if (document.getElementById("ped-nombre")) document.getElementById("ped-nombre").value = cliente.nombre;
    if (document.getElementById("ped-direccion")) document.getElementById("ped-direccion").value = cliente.direccion;
    
    const boxTel = document.getElementById("sug-telefono");
    const boxNom = document.getElementById("sug-nombre");
    if (boxTel) boxTel.style.display = "none";
    if (boxNom) boxNom.style.display = "none";

    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Datos cargados automáticamente', showConfirmButton: false, timer: 1500 });
}

window.saveDirectorioCliente = function(e) {
    e.preventDefault();
    const nom = document.getElementById('cli-nombre').value.trim();
    const tlf = document.getElementById('cli-telefono').value.trim();
    const dir = document.getElementById('cli-direccion').value.trim();

    if (editClienteDirId !== null) {
        db.collection('clientes').doc(editClienteDirId).update({ nombre: nom, telefono: tlf, direccion: dir })
        .then(() => {
            editClienteDirId = null;
            document.getElementById('form-cliente-title').innerHTML = `<i class="fa-solid fa-address-book" style="color:#ff6600"></i> Ficha de Registro de Clientes`;
            document.getElementById('btn-submit-cliente-dir').innerHTML = `<i class="fa-solid fa-user-plus"></i> Guardar en Cartera`;
            document.getElementById('form-directorio-cliente').reset();
            Swal.fire("Actualizado", "Datos del cliente modificados en la nube.", "success");
        });
    } else {
        db.collection('clientes').add({ nombre: nom, telefono: tlf, direccion: dir, creado: Date.now() })
        .then(() => {
            document.getElementById('form-directorio-cliente').reset();
            Swal.fire("Guardado", "Cliente nuevo añadido a la cartera comercial.", "success");
        });
    }
};

function renderClientesDirectorio() {
    const tbody = document.getElementById('tabla-clientes-directorio-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (directorioClientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;" class="text-italic">Ningún cliente en la base de datos de la cartera.</td></tr>`;
        return;
    }
    directorioClientes.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td class="text-bold">${c.nombre}</td>
                <td>${c.telefono}</td>
                <td>${c.direccion}</td>
                <td>
                    <div class="action-cell">
                        <button type="button" class="action-btn" onclick="editClienteDir('${c.firestoreId}')">✏️</button>
                        <button type="button" class="action-btn" onclick="deleteClienteDir('${c.firestoreId}')">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

window.editClienteDir = function(fId) {
    const c = directorioClientes.find(item => item.firestoreId === fId);
    if (!c) return;
    editClienteDirId = fId;
    document.getElementById('form-cliente-title').innerHTML = `✏️ Editar Ficha Cliente`;
    document.getElementById('btn-submit-cliente-dir').innerHTML = `Actualizar Cliente`;
    document.getElementById('cli-nombre').value = c.nombre;
    document.getElementById('cli-telefono').value = c.telefono;
    document.getElementById('cli-direccion').value = c.direccion;
};

window.deleteClienteDir = function(fId) {
    Swal.fire({
        title: '¿Eliminar de la cartera?',
        text: "El cliente ya no aparecerá en las sugerencias automáticas.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff6600',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('clientes').doc(fId).delete().then(() => {
                Swal.fire('Removido', 'Cliente desvinculado.', 'success');
            });
        }
    });
};

window.limpiarFiltrosBusqueda = function() {
    const hoyISO = getVenezuelaDate();
    document.getElementById('filtro-fecha-desde').value = hoyISO;
    document.getElementById('filtro-fecha-hasta').value = hoyISO;
    document.getElementById('filtro-aliado-busqueda').value = "";
    if (document.getElementById('filtro-motorizado-busqueda')) document.getElementById('filtro-motorizado-busqueda').value = "";
    renderPedidos();
};

window.registerGasto = function(event) {
    event.preventDefault();
    const det = document.getElementById('gasto-detalle').value;
    const mon = parseFloat(document.getElementById('gasto-monto').value) || 0;
    
    db.collection('gastos').add({ detalle: det, monto: mon, fecha: getVenezuelaDate() }).then(() => {
        document.getElementById('form-gastos').reset();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Gasto indexado', showConfirmButton: false, timer: 1500 });
    });
};

function renderGastos() {
    const container = document.getElementById('expense-container');
    if (!container) return;
    if (gastos.length === 0) { container.innerHTML = 'Sin egresos registrados.'; return; }
    container.innerHTML = '';
    gastos.forEach(g => {
        container.innerHTML += `<div class="expense-item"><span onclick="deleteGasto('${g.firestoreId}')" style="cursor:pointer;">❌ ${g.detalle}</span><b>$${g.monto.toFixed(2)}</b></div>`;
    });
    renderPedidos(); 
}

window.deleteGasto = function(id) {
    Swal.fire({
        title: '¿Eliminar Gasto?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Eliminar'
    }).then((res) => {
        if (res.isConfirmed) db.collection('gastos').doc(id).delete();
    });
};

function renderPedidos() {
    const tbody = document.getElementById('tabla-pedidos-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const fDesde = document.getElementById('filtro-fecha-desde').value;
    const fHasta = document.getElementById('filtro-fecha-hasta').value;
    
    const fAliado = usuarioActual.rol === 'aliado' ? usuarioActual.aliadoComercial : document.getElementById('filtro-aliado-busqueda').value;
    const fMotorizado = usuarioActual.rol === 'aliado' ? "" : document.getElementById('filtro-motorizado-busqueda').value;

    const pedidosFiltrados = pedidos.filter(p => {
        if (p.pendiente_aprobacion) return false; 
        const pedidoFechaISO = parseDateVEToISO(p.fecha);
        if (fDesde && pedidoFechaISO < fDesde) return false;
        if (fHasta && pedidoFechaISO > fHasta) return false;
        if (fAliado && p.aliado !== fAliado) return false;
        if (fMotorizado && p.motorizado !== fMotorizado) return false;
        return true;
    });

    let totalIngresos = 0;
    pedidosFiltrados.forEach(p => {
        totalIngresos += p.costo;
    });
    
    let totalGastos = 0;
    if (usuarioActual.rol === 'admin') {
        const gastosFiltrados = gastos.filter(g => {
            if (fDesde && g.fecha < fDesde) return false;
            if (fHasta && g.fecha > fHasta) return false;
            return true;
        });
        gastosFiltrados.forEach(g => totalGastos += g.monto);
    }

    let neto = totalIngresos - totalGastos;

    document.getElementById('dash-cant-pedidos').innerText = pedidosFiltrados.length;
    document.getElementById('dash-ingreso-usd').innerText = `$${totalIngresos.toFixed(2)}`;
    
    if (usuarioActual.rol === 'admin') {
        document.getElementById('dash-gasto-usd').innerText = `$${totalGastos.toFixed(2)}`;
        document.getElementById('dash-balance-neto').innerText = `$${neto.toFixed(2)}`;
        const boxNeto = document.getElementById('dash-neto-box');
        if (boxNeto) {
            boxNeto.className = neto >= 0 ? "dash-card neto-pos" : "dash-card neto-neg";
        }
    }

    if (pedidosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;" class="text-italic">No hay pedidos registrados con los filtros seleccionados.</td></tr>`;
        return;
    }

    pedidosFiltrados.forEach(p => {
        const badgeIncidencia = p.incidencia ? `<br><span style="color:#ef4444; font-weight:bold; font-size:0.75rem;">🚨 ${p.incidencia}</span>` : '';

        let btnAcciones = usuarioActual.rol === 'admin' ? `
            <td>
                <div class="action-cell">
                    <button type="button" class="action-btn" onclick="copiarLinkRastreo('${p.firestoreId}')" title="Copiar Link de Rastreo">🔗</button>
                    <button type="button" class="action-btn" onclick="imprimirTicketTermico('${p.firestoreId}')" title="Imprimir Ticket Térmico">🖨️</button>
                    <button type="button" class="action-btn" onclick="reportarNovedadIncidencia('${p.firestoreId}')" title="Reportar Novedad">⚠️</button>
                    <button type="button" class="action-btn" onclick="togglePedidoCompletado(event, '${p.firestoreId}')" title="${p.completado ? 'Marcar En Proceso' : 'Marcar Completado'}">${p.completado ? '✅' : '⏳'}</button>
                    <button type="button" class="action-btn" onclick="editPedido(event, '${p.firestoreId}')">✏️</button>
                    <button type="button" class="action-btn" onclick="deletePedido(event, '${p.firestoreId}')">🗑️</button>
                </div>
            </td>
        ` : `<td class="v-admin"></td>`;

        tbody.innerHTML += `
            <tr onclick="openReceiptModal('${p.firestoreId}')">
                <td>${p.fecha}<br><span class="text-sub">${p.hora || ''}</span></td>
                <td class="text-bold">${p.cliente}<span class="text-sub">${p.telefono}</span></td>
                <td>${p.direccion}${badgeIncidencia}</td>
                <td>${p.aliado}</td>
                <td class="text-italic">${p.motorizado || 'Por asignar'}</td>
                <td class="text-orange">$${p.costo.toFixed(2)}</td>
                <td>${p.detalles}</td>
                ${btnAcciones}
            </tr>
        `;
    });
}

window.togglePedidoCompletado = function(event, fId) {
    if (event) event.stopPropagation();
    const p = pedidos.find(item => item.firestoreId === fId);
    if (!p) return;

    const nuevoEstado = !p.completado;
    db.collection('pedidos').doc(fId).update({ completado: nuevoEstado }).then(() => {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: nuevoEstado ? 'Pedido marcado como Entregado' : 'Pedido retornado a En Ruta',
            showConfirmButton: false,
            timer: 2000
        });
    });
};

window.processNewPedido = function(e) {
    e.preventDefault();
    const clientName = document.getElementById('ped-nombre').value.trim();
    const clientPhone = document.getElementById('ped-telefono').value.trim();
    const clientDir = document.getElementById('ped-direccion').value.trim();
    
    const chosenAliado = usuarioActual.rol === 'aliado' ? usuarioActual.aliadoComercial : document.getElementById('ped-aliado').value;
    const chosenMoto = usuarioActual.rol === 'aliado' ? "Pendiente por Asignar" : document.getElementById('ped-motorizado').value;
    
    const costValue = parseFloat(document.getElementById('ped-costo').value) || 0;
    const detailText = document.getElementById('ped-detalles').value || "Despacho";

    const inputFechaPed = document.getElementById('ped-fecha');
    const selectedFechaISO = inputFechaPed && inputFechaPed.value ? inputFechaPed.value : getVenezuelaDate();
    const fechaFormatSalida = formatISOToVE(selectedFechaISO);

    const existeCliente = directorioClientes.some(c => c.telefono === clientPhone);
    if (!existeCliente && clientPhone && clientName) {
        db.collection('clientes').add({ nombre: clientName, telefono: clientPhone, direccion: clientDir, creado: Date.now() });
    }

    let pendingReferenceId = null;
    if (editPedidoId && editPedidoId.startsWith("PENDIENTE_")) {
        pendingReferenceId = editPedidoId.replace("PENDIENTE_", "");
    }

    if (editPedidoId !== null && !pendingReferenceId) {
        db.collection('pedidos').doc(editPedidoId).update({
            fecha: fechaFormatSalida,
            cliente: clientName, telefono: clientPhone, direccion: clientDir,
            aliado: chosenAliado, motorizado: chosenMoto, costo: costValue, detalles: detailText
        }).then(() => {
            editPedidoId = null;
            document.getElementById('form-pedido-title').innerHTML = `<i class="fa-solid fa-truck-ramp-box" style="color:#ff6600"></i> Agregar Nuevo Pedido`;
            document.getElementById('btn-submit-pedido').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Pedido`;
            document.getElementById('form-pedido').reset();
            if (inputFechaPed) inputFechaPed.value = getVenezuelaDate();
            Swal.fire("Modificado", "Pedido actualizado con éxito.", "success");
            switchTab('gestion');
        });
    } else {
        const numericId = Date.now();

        const nuevoPedido = {
            id: numericId,
            fecha: fechaFormatSalida,
            hora: getVenezuelaTime(),
            cliente: clientName, telefono: clientPhone, direccion: clientDir,
            aliado: chosenAliado, motorizado: chosenMoto, costo: costValue, detalles: detailText,
            completado: false
        };

        if (pendingReferenceId) {
            db.collection('pedidos').doc(pendingReferenceId).delete();
            editPedidoId = null;
        }

        db.collection('pedidos').add(nuevoPedido).then(() => {
            const dataAliado = aliados.find(a => a.nombre === nuevoPedido.aliado) || { telefono: "" };
            const dataMoto = motorizados.find(m => m.nombre === nuevoPedido.motorizado) || { telefono: "" };
            
            const msgCliente = encodeURIComponent(
                `*SUN DELIVERY VALENCIA* 🚀\n\n` +
                `¡Hola *${nuevoPedido.cliente}*! Tu servicio de entrega ha sido procesado de manera exitosa.\n\n` +
                `📅 *Fecha:* ${nuevoPedido.fecha}\n` +
                `🏪 *Comercio:* ${nuevoPedido.aliado}\n` +
                `🛵 *Repartidor:* ${nuevoPedido.motorizado}\n` +
                `📍 *Dirección de Entrega:* ${nuevoPedido.direccion}\n` +
                `📦 *Detalle:* ${nuevoPedido.detalles}\n` +
                `💵 *Costo Delivery:* $${nuevoPedido.costo.toFixed(2)}\n\n` +
                `✨ ¡Muchas gracias por tu preferencia!`
            );

            const msgAliado = encodeURIComponent(
                `*NOTIFICACIÓN DE DESPACHO* 🏪\n\n` +
                `Estimado aliado comercial de *${nuevoPedido.aliado}*, le informamos que hemos asignado una unidad para su orden.\n\n` +
                `📅 *Fecha:* ${nuevoPedido.fecha}\n` +
                `🛵 *Motorizado Asignado:* ${nuevoPedido.motorizado}\n` +
                `👤 *Cliente:* ${nuevoPedido.cliente}\n` +
                `📍 *Destino:* ${nuevoPedido.direccion}\n` +
                `📦 *Detalle del Paquete:* ${nuevoPedido.detalles}\n` +
                `💵 *Monto de Ruta:* $${nuevoPedido.costo.toFixed(2)}\n\n` +
                `🤝 ¡Trabajando juntos para ofrecer el mejor servicio!`
            );

            const msgMotorizado = encodeURIComponent(
                `*NUEVA ASIGNACIÓN DE RUTA* 🏍️\n\n` +
                `Hola *${nuevoPedido.motorizado}*, tienes un nuevo despacho activo.\n\n` +
                `📅 *Fecha:* ${nuevoPedido.fecha}\n` +
                `🏪 *Retira en Aliado:* ${nuevoPedido.aliado}\n` +
                `👤 *Cliente:* ${nuevoPedido.cliente}\n` +
                `📞 *Tlf Cliente:* +58 ${nuevoPedido.telefono}\n` +
                `📍 *Dirección:* ${nuevoPedido.direccion}\n` +
                `📦 *Detalle:* ${nuevoPedido.detalles}\n` +
                `💰 *Cobrar al Cliente:* $${nuevoPedido.costo.toFixed(2)}\n\n` +
                `⚠️ *Importante:* Confirmar al llegar al destino.`
            );

            document.getElementById('wa-btn-cliente').href = `https://api.whatsapp.com/send?phone=${nuevoPedido.telefono}&text=${msgCliente}`;
            document.getElementById('wa-btn-aliado').href = `https://api.whatsapp.com/send?phone=${dataAliado.telefono}&text=${msgAliado}`;
            document.getElementById('wa-btn-motorizado').href = `https://api.whatsapp.com/send?phone=${dataMoto.telefono}&text=${msgMotorizado}`;

            document.getElementById('form-pedido').reset();
            if (inputFechaPed) inputFechaPed.value = getVenezuelaDate();
            
            document.getElementById('form-pedido-title').innerHTML = `<i class="fa-solid fa-truck-ramp-box" style="color:#ff6600"></i> Agregar Nuevo Pedido`;
            document.getElementById('btn-submit-pedido').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Pedido`;
            document.getElementById('whatsapp-modal').classList.add('active');
        });
    }
};

window.editPedido = function(event, fId) {
    if (event) event.stopPropagation();
    const p = pedidos.find(item => item.firestoreId === fId);
    if (!p) return;
    
    editPedidoId = fId;
    document.getElementById('form-pedido-title').innerHTML = `✏️ Editar Pedido Comercial`;
    document.getElementById('btn-submit-pedido').innerHTML = `Actualizar Pedido`;

    const inputFechaPed = document.getElementById('ped-fecha');
    if (inputFechaPed) {
        inputFechaPed.value = parseDateVEToISO(p.fecha) || getVenezuelaDate();
    }

    document.getElementById('ped-nombre').value = p.cliente;
    document.getElementById('ped-telefono').value = p.telefono;
    document.getElementById('ped-direccion').value = p.direccion;
    if (usuarioActual.rol === 'admin') document.getElementById('ped-aliado').value = p.aliado;
    document.getElementById('ped-motorizado').value = p.motorizado;
    document.getElementById('ped-costo').value = p.costo;
    document.getElementById('ped-detalles').value = p.detalles;
    switchTab('agregar');
};

window.deletePedido = function(event, fId) {
    if (event) event.stopPropagation();
    Swal.fire({
        title: '¿Eliminar Pedido?',
        text: "Esta acción borrará el registro permanente en la nube.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff6600',
        confirmButtonText: 'Sí, borrar de la nube'
    }).then((res) => {
        if (res.isConfirmed) {
            db.collection('pedidos').doc(fId).delete().then(() => {
                Swal.fire("Borrado", "El despacho fue eliminado.", "success");
            });
        }
    });
};

window.closeWhatsAppModal = function() {
    document.getElementById('whatsapp-modal').classList.remove('active');
    switchTab('gestion');
};

function renderMotorizados() {
    const tbody = document.getElementById('tabla-motorizados-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (motorizados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;" class="text-italic">No hay motorizados registrados.</td></tr>`;
        return;
    }
    motorizados.forEach(m => {
        tbody.innerHTML += `
            <tr>
                <td class="text-bold">${m.nombre}</td>
                <td>${m.telefono}</td>
                <td><span class="badge-blue">${m.placa}</span></td>
                <td>${m.direccion}</td>
                <td>
                    <div class="action-cell">
                        <button type="button" class="action-btn" onclick="editMotorizado('${m.firestoreId}')">✏️</button>
                        <button type="button" class="action-btn" onclick="deleteMotorizado('${m.firestoreId}')">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

window.saveMotorizado = function(e) {
    e.preventDefault();
    const nom = document.getElementById('moto-nombre').value;
    const tlf = document.getElementById('moto-telefono').value;
    const plc = document.getElementById('moto-placa').value;
    const dir = document.getElementById('moto-direccion').value;

    if (editMotoId !== null) {
        db.collection('motorizados').doc(editMotoId).update({ nombre: nom, telefono: tlf, placa: plc, direccion: dir })
        .then(() => {
            editMotoId = null;
            document.getElementById('form-moto-title').innerHTML = `<i class="fa-solid fa-helmet-safety" style="color:#ff6600"></i> Panel de Repartidores`;
            document.getElementById('btn-submit-moto').innerHTML = `<i class="fa-solid fa-circle-check"></i> Guardar Repartidor`;
            document.getElementById('form-motorizado').reset();
            Swal.fire("Listo", "Motorizado actualizado.", "success");
        });
    } else {
        db.collection('motorizados').add({ id: Date.now(), nombre: nom, telefono: tlf, placa: plc, direccion: dir })
        .then(() => {
            document.getElementById('form-motorizado').reset();
            Swal.fire("Registrado", "Nuevo repartidor en línea.", "success");
        });
    }
};

window.editMotorizado = function(fId) {
    const m = motorizados.find(item => item.firestoreId === fId);
    if (!m) return;
    editMotoId = fId;
    document.getElementById('form-moto-title').innerHTML = `✏️ Editar Motorizado`;
    document.getElementById('btn-submit-moto').innerHTML = `Actualizar`;
    document.getElementById('moto-nombre').value = m.nombre;
    document.getElementById('moto-telefono').value = m.telefono;
    document.getElementById('moto-placa').value = m.placa;
    document.getElementById('moto-direccion').value = m.direccion;
};

window.deleteMotorizado = function(fId) {
    Swal.fire({ title: '¿Dar de baja repartidor?', icon: 'warning', showCancelButton: true }).then(r => {
        if (r.isConfirmed) db.collection('motorizados').doc(fId).delete();
    });
};

function renderAliados() {
    const tbody = document.getElementById('tabla-aliados-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (aliados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;" class="text-italic">No hay aliados comerciales registrados.</td></tr>`;
        return;
    }
    aliados.forEach(a => {
        tbody.innerHTML += `
            <tr>
                <td class="text-bold">${a.nombre}</td>
                <td style="color:#64748b; font-weight:600;">${a.usuario || 'No asignado'}</td>
                <td>${a.telefono}</td>
                <td>${a.direccion}</td>
                <td>
                    <div class="action-cell">
                        <button type="button" class="action-btn" onclick="editAliado('${a.firestoreId}')">✏️</button>
                        <button type="button" class="action-btn" onclick="deleteAliado('${a.firestoreId}')">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

window.saveAliado = function(e) {
    e.preventDefault();
    const nom = document.getElementById('aliado-nombre').value.trim();
    const usrVal = document.getElementById('aliado-usuario').value.trim(); 
    const pinVal = document.getElementById('aliado-pin').value.trim();
    const tlf = document.getElementById('aliado-telefono').value;
    const dir = document.getElementById('aliado-direccion').value;

    if (editAliadoId !== null) {
        db.collection('aliados').doc(editAliadoId).update({ nombre: nom, usuario: usrVal, pin: pinVal, telefono: tlf, direccion: dir })
        .then(() => {
            editAliadoId = null;
            document.getElementById('form-aliado-title').innerHTML = `<i class="fa-solid fa-shop" style="color:#ff6600"></i> Registro Comercial Aliado`;
            document.getElementById('btn-submit-aliado').innerHTML = `<i class="fa-solid fa-circle-check"></i> Guardar Comercio`;
            document.getElementById('form-aliado').reset();
            Swal.fire("Completado", "Aliado comercial modificado.", "success");
        });
    } else {
        db.collection('aliados').add({ id: Date.now(), nombre: nom, usuario: usrVal, pin: pinVal, telefono: tlf, direccion: dir })
        .then(() => {
            document.getElementById('form-aliado').reset();
            Swal.fire("Perfecto", "Comercio aliado agregado con su respectiva clave y usuario.", "success");
        });
    }
};

window.editAliado = function(fId) {
    const a = aliados.find(item => item.firestoreId === fId);
    if (!a) return;
    editAliadoId = fId;
    document.getElementById('form-aliado-title').innerHTML = `✏️ Editar Aliado Comercial`;
    document.getElementById('btn-submit-aliado').innerHTML = `Actualizar`;
    document.getElementById('aliado-nombre').value = a.nombre;
    document.getElementById('aliado-usuario').value = a.usuario || ""; 
    document.getElementById('aliado-pin').value = a.pin || "";
    document.getElementById('aliado-telefono').value = a.telefono;
    document.getElementById('aliado-direccion').value = a.direccion;
};

window.deleteAliado = function(fId) {
    Swal.fire({ title: '¿Remover Aliado de la red?', icon: 'warning', showCancelButton: true }).then(r => {
        if (r.isConfirmed) db.collection('aliados').doc(fId).delete();
    });
};

function updateSelectDropdowns() {
    const pAliado = document.getElementById('ped-aliado');
    const pMoto = document.getElementById('ped-motorizado');
    const iAliado = document.getElementById('invoice-aliado');
    const bAliado = document.getElementById('filtro-aliado-busqueda');
    const bMotorizado = document.getElementById('filtro-motorizado-busqueda');
    const iMotorizadoPayroll = document.getElementById('invoice-motorizado-payroll');

    if (!pAliado || !pMoto || !iAliado) return;

    const currentPAliado = pAliado.value;
    const currentPMoto = pMoto.value;
    const currentIAliado = iAliado.value;
    const currentBAliado = bAliado ? bAliado.value : "";
    const currentBMotorizado = bMotorizado ? bMotorizado.value : "";
    const currentIMotoPayroll = iMotorizadoPayroll ? iMotorizadoPayroll.value : "";

    pAliado.innerHTML = '<option value="">Seleccione un aliado...</option>';
    pMoto.innerHTML = '<option value="">Seleccione un motorizado...</option>';
    iAliado.innerHTML = '<option value="">Seleccione Aliado...</option><option value="TODOS_LOS_ALIADOS">-- SELECCIONAR TODOS LOS ALIADOS --</option>';
    if (bAliado) bAliado.innerHTML = '<option value="">Todos los Aliados</option>';
    if (bMotorizado) bMotorizado.innerHTML = '<option value="">Todos los Motorizados</option>';
    if (iMotorizadoPayroll) iMotorizadoPayroll.innerHTML = '<option value="">Seleccione Motorizado...</option>';

    aliados.forEach(a => {
        pAliado.innerHTML += `<option value="${a.nombre}">${a.nombre}</option>`;
        iAliado.innerHTML += `<option value="${a.nombre}">${a.nombre}</option>`;
        if (bAliado) bAliado.innerHTML += `<option value="${a.nombre}">${a.nombre}</option>`;
    });
    motorizados.forEach(m => {
        pMoto.innerHTML += `<option value="${m.nombre}">${m.nombre}</option>`;
        if (bMotorizado) bMotorizado.innerHTML += `<option value="${m.nombre}">${m.nombre}</option>`;
        if (iMotorizadoPayroll) iMotorizadoPayroll.innerHTML += `<option value="${m.nombre}">${m.nombre}</option>`;
    });

    if (currentPAliado) pAliado.value = currentPAliado;
    if (currentPMoto) pMoto.value = currentPMoto;
    if (currentIAliado) iAliado.value = currentIAliado;
    if (bAliado && currentBAliado) bAliado.value = currentBAliado;
    if (bMotorizado && currentBMotorizado) bMotorizado.value = currentBMotorizado;
    if (iMotorizadoPayroll && currentIMotoPayroll) iMotorizadoPayroll.value = currentIMotoPayroll;
}

function FormatearBs(monto) {
    return monto.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function AntiXSS(str) {
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.openReceiptModal = function(fId) {
    selectedPedido = pedidos.find(p => p.firestoreId === fId);
    if (!selectedPedido) return;

    document.getElementById('tkt-cliente').innerText = selectedPedido.cliente;
    document.getElementById('tkt-tlf').innerText = selectedPedido.telefono;
    document.getElementById('tkt-dir').innerText = selectedPedido.direccion;
    document.getElementById('tkt-aliado').innerText = selectedPedido.aliado;
    document.getElementById('tkt-moto').innerText = selectedPedido.motorizado || 'No asignado';
    document.getElementById('modal-monto').value = selectedPedido.costo.toFixed(2);

    updateTicketCalculations();
    document.getElementById('receipt-modal').classList.add('active');
};

window.updateTicketCalculations = function() {
    const tasa = parseFloat(document.getElementById('modal-tasa').value) || 0;
    const usd = parseFloat(document.getElementById('modal-monto').value) || 0;
    document.getElementById('tkt-tasa-text').innerText = tasa.toFixed(2);
    document.getElementById('tkt-usd-text').innerText = usd.toFixed(2);
    document.getElementById('tkt-bs-text').innerText = FormatearBs(usd * tasa);
};

window.closeReceiptModal = function() {
    document.getElementById('receipt-modal').classList.remove('active');
};

window.triggerDownloadJPG = function() {
    const ticketArea = document.getElementById('print-ticket-area');
    Swal.fire({
        title: 'Generando Imagen...',
        html: 'Espere por favor.',
        didOpen: () => { Swal.showLoading(); }
    });

    html2canvas(ticketArea, { useCORS: true, scale: 3, backgroundColor: "#ffffff" }).then(canvas => {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const link = document.createElement('a');
        link.href = imgData;
        const nombreCliente = document.getElementById('tkt-cliente').innerText.replace(/\s+/g, '_') || 'Ticket';
        link.download = `Ticket_${nombreCliente}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Swal.close();
    }).catch(err => {
        console.error(err);
        Swal.fire("Error", "No se pudo compilar la captura del ticket.", "error");
    });
};

// INICIALIZACIÓN DE LA APLICACIÓN
document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar si se está accediendo mediante un Link de Rastreo Público
    const esRastreoPublico = comprobarRastreoPublico();
    
    // 2. Si no es un cliente rastreando, sincronizar datos con Firestore
    if (!esRastreoPublico) {
        syncCloudData();
    }
});
