function getVenezuelaDate() {
    const now = new Date();
    const options = { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' };
    const parts = new Intl.DateTimeFormat('es-VE', options).formatToParts(now);
    return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
}

// Convierte YYYY-MM-DD (del input date) a DD/MM/YYYY (para guardar/mostrar)
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

// Asignación Global para eventos HTML
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

    renderPedidosPortalAliado();
};

window.logoutPortal = function() {
    document.getElementById('portal-aliado-container').style.display = 'none';
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('form-portal-aliado').reset();
    usuarioActual = { username: "", rol: "admin", aliadoComercial: "" };
};

function renderPedidosPortalAliado() {
    const tbody = document.getElementById('tabla-portal-aliado-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const misPendientes = pedidosPendientesAliados.filter(p => p.aliado === usuarioActual.aliadoComercial);
    const misAprobados = pedidos.filter(p => p.aliado === usuarioActual.aliadoComercial);
    
    const todosMisPedidos = [...misPendientes, ...misAprobados].sort((a, b) => b.id - a.id);

    if (todosMisPedidos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;" class="text-italic">No posees pedidos registrados en la plataforma.</td></tr>`;
        return;
    }

    todosMisPedidos.forEach(p => {
        let badgeEstatus = '';
        if (p.pendiente_aprobacion) {
            badgeEstatus = `<span class="badge-blue" style="background-color: #ffedd5; color: #ea580c; border: 1px solid #fed7aa;">Pendiente de Aprobación</span>`;
        } else {
            badgeEstatus = `<span class="badge-blue" style="background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0;">Ruta Asignada Activa</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td>${p.fecha}<br><span class="text-sub">${p.hora || ''}</span></td>
                <td class="text-bold">${p.cliente}<span class="text-sub">${p.telefono}</span></td>
                <td>${p.direccion}</td>
                <td>${badgeEstatus}</td>
                <td class="text-italic">${p.motorizado || 'Por asignar'}</td>
                <td class="text-orange">${p.costo > 0 ? '$' + p.costo.toFixed(2) : 'Por calcular'}</td>
            </tr>
        `;
    });
}

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
        tbody.innerHTML += `
            <tr>
                <td class="text-bold" style="color: #ff6600;">${p.aliado}</td>
                <td class="text-bold">${p.cliente}<span class="text-sub">${p.telefono}</span></td>
                <td>${p.direccion}</td>
                <td>${p.detalles}</td>
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
    document.getElementById('ped-detalles').value = p.detalles;
    
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
    
    const inputFechaPort = document.getElementById('port-fecha');
    const selectedFechaPort = inputFechaPort && inputFechaPort.value ? inputFechaPort.value : getVenezuelaDate();
    const fechaFormatSalida = formatISOToVE(selectedFechaPort);

    const numericId = Date.now();

    const pedidoPreRegistro = {
        id: numericId,
        fecha: fechaFormatSalida,
        hora: getVenezuelaTime(),
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
            `El aliado comercial *${pedidoPreRegistro.aliado}* ha generado una nueva solicitud de despacho en la plataforma.\n\n` +
            `📅 *Fecha Solicitada:* ${pedidoPreRegistro.fecha}\n` +
            `👤 *Cliente:* ${pedidoPreRegistro.cliente}\n` +
            `📞 *Teléfono:* +58 ${pedidoPreRegistro.telefono}\n` +
            `📍 *Dirección de Entrega:* ${pedidoPreRegistro.direccion}\n` +
            `📦 *Detalle del Paquete:* ${pedidoPreRegistro.detalles}\n\n` +
            `⚠️ *Acción:* Por favor, ingrese al panel de administración central para asignar la unidad de motorizado y fijar la tarifa de delivery correspondiente.`
        );

        Swal.fire({
            title: "¡Solicitud Enviada!",
            text: "Su pedido ha sido indexado. Presione el botón para enviar la notificación a despacho central vía WhatsApp.",
            icon: "success",
            confirmButtonText: "Notificar por WhatsApp",
            confirmButtonColor: "#25d366"
        }).then(() => {
            window.open(`https://api.whatsapp.com/send?phone=584244529892&text=${msgCentralAdmin}`, '_blank');
        });
    });
};

window.triggerAutocomplete = function(type) {
    const valInputTel = document.getElementById("ped-telefono").value.trim().toLowerCase();
    const valInputNom = document.getElementById("ped-nombre").value.trim().toLowerCase();
    
    const boxTel = document.getElementById("sug-telefono");
    const boxNom = document.getElementById("sug-nombre");

    if (boxTel) { boxTel.innerHTML = ""; boxTel.style.display = "none"; }
    if (boxNom) { boxNom.innerHTML = ""; boxNom.style.display = "none"; }

    if (type === 'telefono' && valInputTel.length >= 2) {
        const coincidencias = directorioClientes.filter(c => c.telefono.toLowerCase().includes(valInputTel));
        if (coincidencias.length > 0 && boxTel) {
            boxTel.style.display = "block";
            coincidencias.forEach(c => {
                const div = document.createElement("div");
                div.className = "suggestion-item";
                div.innerHTML = `<span>📱 <b>${c.telefono}</b></span><span class="sug-meta">${c.nombre}</span>`;
                div.onclick = () => fillFormFromSuggestion(c);
                boxTel.appendChild(div);
            });
        }
    } 
    else if (type === 'nombre' && valInputNom.length >= 2) {
        const coincidencias = directorioClientes.filter(c => c.nombre.toLowerCase().includes(valInputNom));
        if (coincidencias.length > 0 && boxNom) {
            boxNom.style.display = "block";
            coincidencias.forEach(c => {
                const div = document.createElement("div");
                div.className = "suggestion-item";
                div.innerHTML = `<span>👤 <b>${c.nombre}</b></span><span class="sug-meta">${c.telefono}</span>`;
                div.onclick = () => fillFormFromSuggestion(c);
                boxNom.appendChild(div);
            });
        }
    }
};

function fillFormFromSuggestion(cliente) {
    document.getElementById("ped-telefono").value = cliente.telefono;
    document.getElementById("ped-nombre").value = cliente.nombre;
    document.getElementById("ped-direccion").value = cliente.direccion;
    
    const boxTel = document.getElementById("sug-telefono");
    const boxNom = document.getElementById("sug-nombre");
    if (boxTel) boxTel.style.display = "none";
    if (boxNom) boxNom.style.display = "none";

    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Cliente cargado con éxito', showConfirmButton: false, timer: 1500 });
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
        let btnAcciones = usuarioActual.rol === 'admin' ? `
            <td>
                <div class="action-cell">
                    <button type="button" class="action-btn" onclick="editPedido(event, '${p.firestoreId}')">✏️</button>
                    <button type="button" class="action-btn" onclick="deletePedido(event, '${p.firestoreId}')">🗑️</button>
                </div>
            </td>
        ` : `<td class="v-admin"></td>`;

        tbody.innerHTML += `
            <tr onclick="openReceiptModal('${p.firestoreId}')">
                <td>${p.fecha}<br><span class="text-sub">${p.hora || ''}</span></td>
                <td class="text-bold">${p.cliente}<span class="text-sub">${p.telefono}</span></td>
                <td>${p.direccion}</td>
                <td>${p.aliado}</td>
                <td class="text-italic">${p.motorizado || 'Por asignar'}</td>
                <td class="text-orange">$${p.costo.toFixed(2)}</td>
                <td>${p.detalles}</td>
                ${btnAcciones}
            </tr>
        `;
    });
}

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
            aliado: chosenAliado, motorizado: chosenMoto, costo: costValue, detalles: detailText
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

// INICIALIZACIÓN GLOBAL DE DATOS
syncCloudData();
