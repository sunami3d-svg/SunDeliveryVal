Function getVenezuelaDate() {
    Const now = new Date();
    Const options = { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' };
    Const parts = new Intl.DateTimeFormat('es-VE', options).formatToParts(now);
    Return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
}

// Convierte YYYY-MM-DD (del input date) a DD/MM/YYYY (para guardar/mostrar)
Function formatISOToVE(isoDateStr) {
    If (!isoDateStr) return "";
    Const parts = isoDateStr.split("-");
    If (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    Return isoDateStr;
}

Function parseDateVEToISO(dateStr) {
    If(!dateStr) return "";
    If(dateStr.includes("-")) return dateStr; 
    Const parts = dateStr.split("/");
    If(parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    Return dateStr;
}

Function getVenezuelaTime() {
    Const now = new Date();
    Return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
}

Let aliados = [];
let motorizados = [];
let pedidos = [];
let gastos = [];
let directorioClientes = [];
let pedidosPendientesAliados = [];

Let selectedPedido = null;
let editPedidoId = null;
let editMotoId = null;
let editAliadoId = null;
let editClienteDirId = null;

Let usuarioActual = { username: "", rol: "admin", aliadoComercial: "" };
let porcComisionMotorizado = 0.70; 
Let cargaInicialPedidos = true;
let rolSeleccionadoLogin = "admin"; 

Function setLoginRole(role) {
    RolSeleccionadoLogin = role;
    Document.getElementById('toggle-admin').classList.remove('active');
    Document.getElementById('toggle-aliado').classList.remove('active');
    
    If (role === 'admin') {
        Document.getElementById('toggle-admin').classList.add('active');
        Document.getElementById('username-input').placeholder = "Nombre de Usuario";
    } else {
        Document.getElementById('toggle-aliado').classList.add('active');
        Document.getElementById('username-input').placeholder = "Usuario de Aliado Asignado";
    }
}

Function validateLogin() {
    Const userIn = document.getElementById('username-input').value.trim();
    Const pinIn = document.getElementById('pin-input').value.trim();

    If (!userIn || !pinIn) {
        Swal.fire("Campos vacíos", "Por favor ingresa usuario y contraseña.", "warning");
        Return;
    }

    If (rolSeleccionadoLogin === 'admin') {
        If (userIn.toLowerCase() === 'admin' && pinIn === '1987') { 
            UsuarioActual = { username: "Admin", rol: "admin", aliadoComercial: "" };
            ArrancarAplicacion();
        } else {
            Swal.fire("Error de Acceso", "Usuario o PIN de administrador incorrectos.", "error");
        }
    } else {
        If (!aliados || aliados.length === 0) {
            Swal.fire("Error de Sistema", "La lista de aliados se está sincronizando de la base de datos. Espere un segundo.", "error");
            Return;
        }

        Const aliadoExiste = aliados.find(a => {
            Const campoUsuario = a.usuario || a.usuarioLogin || a.username;
            Return campoUsuario && campoUsuario.toString().toLowerCase() === userIn.toLowerCase();
        });
        
        If (aliadoExiste) {
            Const pinRegistrado = aliadoExiste.pin || aliadoExiste.contrasena || aliadoExiste.pinIn;
            
            If (String(pinRegistrado) === pinIn) {
                Const nombreAliado = aliadoExiste.nombre || aliadoExiste.nombreComercial || "Aliado";
                UsuarioActual = { username: nombreAliado, rol: "aliado", aliadoComercial: nombreAliado };
                ArrancarPortalAliado();
            } else {
                Swal.fire("Error de Acceso", "El PIN introducido es incorrecto.", "error");
            }
        } else {
            Swal.fire("Error de Acceso", "El usuario de aliado no coincide con ningún registro.", "error");
        }
    }
}

Function arrancarPortalAliado() {
    Document.getElementById('login-view').classList.add('hidden');
    Document.getElementById('portal-aliado-container').style.display = 'block';
    Document.getElementById('portal-nombre-aliado').innerText = usuarioActual.aliadoComercial;
    
    // Inicializar input de fecha en el portal con la fecha de hoy
    Const elFechaPort = document.getElementById('port-fecha');
    If (elFechaPort) elFechaPort.value = getVenezuelaDate();

    RenderPedidosPortalAliado();
}

Function logoutPortal() {
    Document.getElementById('portal-aliado-container').style.display = 'none';
    Document.getElementById('login-view').classList.remove('hidden');
    Document.getElementById('form-portal-aliado').reset();
    UsuarioActual = { username: "", rol: "admin", aliadoComercial: "" };
}

Function renderPedidosPortalAliado() {
    Const tbody = document.getElementById('tabla-portal-aliado-body');
    If (!tbody) return;
    Tbody.innerHTML = '';

    Const misPendientes = pedidosPendientesAliados.filter(p => p.aliado === usuarioActual.aliadoComercial);
    Const misAprobados = pedidos.filter(p => p.aliado === usuarioActual.aliadoComercial);
    
    Const todosMisPedidos = [...misPendientes, ...misAprobados].sort((a, b) => b.id - a.id);

    If (todosMisPedidos.length === 0) {
        Tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;" class="text-italic">No posees pedidos registrados en la plataforma.</td></tr>`;
        Return;
    }

    TodosMisPedidos.forEach(p => {
        Let badgeEstatus = '';
        If (p.pendiente_aprobacion) {
            BadgeEstatus = `<span class="badge-blue" style="background-color: #ffedd5; color: #ea580c; border: 1px solid #fed7aa;">Pendiente de Aprobación</span>`;
        } else {
            BadgeEstatus = `<span class="badge-blue" style="background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0;">Ruta Asignada Activa</span>`;
        }

        Tbody.innerHTML += `
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

Function arrancarAplicacion() {
    Document.getElementById('login-view').classList.add('hidden');
    Document.getElementById('app-container').classList.add('active');
    
    Const hoyISO = getVenezuelaDate();
    Document.getElementById('filtro-fecha-desde').value = hoyISO;
    Document.getElementById('filtro-fecha-hasta').value = hoyISO;
    Document.getElementById('invoice-fecha-desde').value = hoyISO;
    Document.getElementById('invoice-fecha-hasta').value = hoyISO;

    // Inicializar input de fecha del formulario de pedidos
    Const elFechaPed = document.getElementById('ped-fecha');
    If (elFechaPed) elFechaPed.value = hoyISO;

    Const badge = document.getElementById('badge-rol');
    Badge.innerText = usuarioActual.rol.toUpperCase();
    
    If (usuarioActual.rol === 'aliado') {
        Document.querySelectorAll('.v-admin').forEach(el => el.style.display = 'none');
        Document.getElementById('filtro-aliado-box').style.display = 'none';
        Document.getElementById('container-select-aliado').style.display = 'none';
    } else {
        Document.querySelectorAll('.v-admin').forEach(el => el.style.display = 'block');
        Document.getElementById('filtro-aliado-box').style.display = 'block';
        Document.getElementById('container-select-aliado').style.display = 'block';
    }

    InitRealTimeListener();
    LoadComisionConfig();
    
    Document.addEventListener("click", function (e) {
        If (!e.target.closest('.form-group')) {
            Document.getElementById("sug-telefono").style.display = "none";
            Document.getElementById("sug-nombre").style.display = "none";
        }
    });
}

Function switchTab(tabId) {
    Document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    Document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    Document.getElementById(`tab-${tabId}`).classList.add('active');
    Document.getElementById(`view-${tabId}`).classList.add('active');
}

Function loadComisionConfig() {
    Db.collection('configuracion').doc('general').get().then(doc => {
        If (doc.exists && doc.data().comision_motorizado) {
            PorcComisionMotorizado = doc.data().comision_motorizado;
            Document.getElementById('cfg-comision').value = Math.round(porcComisionMotorizado * 100);
        } else {
            Db.collection('configuracion').doc('general').set({ comision_motorizado: 0.70 });
        }
    });
}

Function saveComisionConfig() {
    Const inputVal = parseFloat(document.getElementById('cfg-comision').value) || 70;
    Const decimalVal = inputVal / 100;
    Db.collection('configuracion').doc('general').update({ comision_motorizado: decimalVal })
    .then(() => {
        PorcComisionMotorizado = decimalVal;
        Swal.fire("Ajuste Guardado", `La comisión global se fijó en ${inputVal}%`, "success");
        RenderPedidos();
    });
}

Function initRealTimeListener() {
    Db.collection('pedidos').onSnapshot(snapshot => {
        Snapshot.docChanges().forEach(change => {
            If (change.type === "added" && !cargaInicialPedidos) {
                Const pedidoData = change.doc.data();
                If (pedidoData.pendiente_aprobacion) return;

                If (usuarioActual.rol === 'admin' || (usuarioActual.rol === 'aliado' && pedidoData.aliado === usuarioActual.aliadoComercial)) {
                    ReproducirNotificacion();
                    MostrarNotificacionFlotante(pedidoData);
                }
            }
        });
        CargaInicialPedidos = false;
    });
}

Function reproducirNotificacion() {
    Const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav");
    Audio.play().catch(() => {});
}

Function mostrarNotificacionFlotante(pedido) {
    Const cont = document.getElementById('contenedor-alertas-flotantes');
    Const alertBox = document.createElement('div');
    AlertBox.className = 'alerta-notificacion-rt';
    AlertBox.innerHTML = `
        <div style="font-weight:800; color:#ff6600; margin-bottom:4px;"><i class="fa-solid fa-bell"></i> ¡NUEVO PEDIDO ENTRANTE!</div>
        <div style="font-size:0.85rem; line-height:1.4;">
            <b>Aliado:</b> ${pedido.aliado}<br>
            <b>Cliente:</b> ${pedido.cliente}<br>
            <b>Destino:</b> ${pedido.direccion}
        </div>
    `;
    Cont.appendChild(alertBox);
    SetTimeout(() => { alertBox.remove(); }, 7000);
}

Function toggleInvoiceFields() {
    Const tipo = document.getElementById('invoice-tipo-entidad').value;
    If (tipo === 'ALIADO') {
        Document.getElementById('invoice-aliado-group').style.display = 'block';
        Document.getElementById('invoice-motorizado-group').style.display = 'none';
    } else {
        Document.getElementById('invoice-aliado-group').style.display = 'none';
        Document.getElementById('invoice-motorizado-group').style.display = 'block';
    }
}

Function processInvoiceGeneration() {
    Const tipo = document.getElementById('invoice-tipo-entidad').value;
    If (tipo === 'ALIADO') {
        GenerateAliadoInvoice();
    } else {
        GenerateMotorizadoPayrollInvoice();
    }
}

Function generateAliadoInvoice() {
    Const nombreAliado = document.getElementById('invoice-aliado').value;
    Const fechaDesde = document.getElementById('invoice-fecha-desde').value;
    Const fechaHasta = document.getElementById('invoice-fecha-hasta').value;
    
    If (!nombreAliado) { Swal.fire("Campo requerido", "Selecciona un aliado comercial.", "info"); return; }
    If (!fechaDesde || !fechaHasta) { Swal.fire("Fechas faltantes", "Asigna el rango temporal.", "info"); return; }

    Const tasa = parseFloat(document.getElementById('invoice-tasa').value) || 45.50;

    Const pedidosFiltrados = pedidos.filter(p => {
        If (p.pendiente_aprobacion) return false; 
        Const pedidoFechaISO = parseDateVEToISO(p.fecha);
        If (nombreAliado !== "TODOS_LOS_ALIADOS" && p.aliado !== nombreAliado) return false;
        If (pedidoFechaISO < fechaDesde || pedidoFechaISO > fechaHasta) return false;
        Return true;
    });

    If (pedidosFiltrados.length === 0) {
        Swal.fire("Sin datos", "No existen órdenes registradas en esos días para la selección.", "info");
        Return;
    }

    Document.getElementById('fact-titulo-documento').innerText = "RELACIÓN DETALLADA DE SERVICIOS";

    If(nombreAliado === "TODOS_LOS_ALIADOS") {
        Document.getElementById('fact-bloque-entidad').innerHTML = `<b style="font-size: 1.1rem;">Aliado Comercial:</b> <span style="font-size: 1.1rem; font-weight: bold; color: #1e293b;">CONSOLIDADO GLOBAL</span>`;
    } else {
        Document.getElementById('fact-bloque-entidad').innerHTML = `<b style="font-size: 1.1rem;">Aliado Comercial:</b> <span style="font-size: 1.1rem; font-weight: bold; color: #ff6600;">${nombreAliado}</span>`;
    }

    Const fDesdeFormateada = fechaDesde.split('-').reverse().join('/');
    Const fHastaFormateada = fechaHasta.split('-').reverse().join('/');
    Document.getElementById('fact-fecha-relacion').innerText = `${fDesdeFormateada} al ${fHastaFormateada}`;
    Document.getElementById('fact-tasa').innerText = tasa.toFixed(2);

    Const tbodyFactura = document.getElementById('fact-detalles-ordenes');
    TbodyFactura.innerHTML = '';
    
    Let acumuladoUSD = 0;
    PedidosFiltrados.forEach(p => {
        AcumuladoUSD += p.costo;
        Const tagAliado = nombreAliado === "TODOS_LOS_ALIADOS" ? `<b style="color:#ff6600;">[${p.aliado}]</b> ` : '';
        
        TbodyFactura.innerHTML += `
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

    Document.getElementById('fact-total-usd').innerText = acumuladoUSD.toFixed(2);
    Document.getElementById('fact-total-bs').innerText = FormatearBs(acumuladoUSD * tasa);
    Document.getElementById('footer-pago-movil').innerHTML = "<b>Banco:</b> Banesco / Venezuela<br><b>Teléfono:</b> 04244529892<br><b>RIF:</b> 18410871";

    RenderInvoiceToImage(nombreAliado === "TODOS_LOS_ALIADOS" ? "Consolidado_General" : nombreAliado);
}

Function generateMotorizadoPayrollInvoice() {
    Const nomMoto = document.getElementById('invoice-motorizado-payroll').value;
    Const fDesde = document.getElementById('invoice-fecha-desde').value;
    Const fHasta = document.getElementById('invoice-fecha-hasta').value;

    If (!nomMoto) { Swal.fire("Campo requerido", "Selecciona un motorizado para liquidar.", "info"); return; }
    If (!fDesde || !fHasta) { Swal.fire("Fechas faltantes", "Asigna el rango temporal.", "info"); return; }

    Const tasa = parseFloat(document.getElementById('invoice-tasa').value) || 45.50;

    Const pedidosFiltrados = pedidos.filter(p => {
        If (p.pendiente_aprobacion) return false; 
        Const pedidoFechaISO = parseDateVEToISO(p.fecha);
        If (p.motorizado !== nomMoto) return false;
        If (pedidoFechaISO < fDesde || pedidoFechaISO > fHasta) return false;
        Return true;
    });

    If (pedidosFiltrados.length === 0) {
        Swal.fire("Sin datos", "No existen rutas completadas por este repartidor en el rango seleccionado.", "info");
        Return;
    }

    Document.getElementById('fact-titulo-documento').innerText = "RECIBO DE PAGO DE MOTORIZADO";
    Document.getElementById('fact-bloque-entidad').innerHTML = `<b style="font-size: 1.1rem;">Motorizado:</b> <span style="font-size: 1.1rem; font-weight: bold; color: #ff6600;">${nomMoto}</span><br><b>Comisión Asignada:</b> <span>${Math.round(porcComisionMotorizado * 100)}%</span>`;
    
    Const fDesdeFormateada = fDesde.split('-').reverse().join('/');
    Const fHastaFormateada = fHasta.split('-').reverse().join('/');
    Document.getElementById('fact-fecha-relacion').innerText = `${fDesdeFormateada} al ${fHastaFormateada}`;
    Document.getElementById('fact-tasa').innerText = tasa.toFixed(2);

    Const tbodyFactura = document.getElementById('fact-detalles-ordenes');
    TbodyFactura.innerHTML = '';

    Let totalProducido = 0;
    PedidosFiltrados.forEach(p => {
        TotalProducido += p.costo;
        TbodyFactura.innerHTML += `
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

    Let comisionGanada = totalProducido * porcComisionMotorizado;

    TbodyFactura.innerHTML += `
        <tr style="border-top: 2px solid #000;">
            <td style="padding: 10px 0; font-weight: bold; font-size: 1rem;">Subtotal Producido:</td>
            <td style="padding: 10px 0; text-align: right; font-weight: bold; font-size: 1.1rem;">$${totalProducido.toFixed(2)}</td>
        </tr>
        <tr>
            <td style="padding: 6px 0; font-weight: bold; color: #10b981; font-size: 1.05rem;">Comisión Neta (${Math.round(porcComisionMotorizado * 100)}%):</td>
            <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #10b981; font-size: 1.2rem;">$${comisionGanada.toFixed(2)}</td>
        </tr>
    `;

    Document.getElementById('fact-total-usd').innerText = comisionGanada.toFixed(2);
    Document.getElementById('fact-total-bs').innerText = FormatearBs(comisionGanada * tasa);
    Document.getElementById('footer-pago-movil').innerHTML = "<b>Recibo generado automáticamente.</b><br>Pago correspondiente a comisiones por servicios de logística acumulados.";

    RenderInvoiceToImage(nomMoto);
}

Function renderInvoiceToImage(entidadNombre) {
    Const disenoRecibo = document.getElementById('recibo-diseno-factura');
    DisenoRecibo.style.display = 'block';

    Swal.fire({ title: 'Compilando imagen...', didOpen: () => { Swal.showLoading(); } });

    Html2canvas(disenoRecibo, { useCORS: true, scale: 3, backgroundColor: "#ffffff" }).then(canvas => {
        Const imgData = canvas.toDataURL('image/jpeg', 0.95);
        Document.getElementById('imagen-vista-previa').src = imgData;
        Document.getElementById('seccion-vista-previa').style.display = 'block';
        Document.getElementById('boton-descargar-jpg').href = imgData;
        
        Const nombreArchivo = entidadNombre.replace(/\s+/g, '_');
        Document.getElementById('boton-descargar-jpg').download = `Recibo_${nombreArchivo}.jpg`;
        
        DisenoRecibo.style.display = 'none';
        Swal.close();
        Document.getElementById('seccion-vista-previa').scrollIntoView({ behavior: 'smooth' });
    });
}

Function syncCloudData() {
    Db.collection('aliados').onSnapshot(snapshot => {
        Aliados = [];
        Snapshot.forEach(doc => aliados.push({ firestoreId: doc.id, ...doc.data() }));
        RenderAliados();
        UpdateSelectDropdowns();
    });

    Db.collection('motorizados').onSnapshot(snapshot => {
        Motorizados = [];
        Snapshot.forEach(doc => motorizados.push({ firestoreId: doc.id, ...doc.data() }));
        RenderMotorizados();
        UpdateSelectDropdowns();
    });

    Db.collection('gastos').onSnapshot(snapshot => {
        Gastos = [];
        Snapshot.forEach(doc => gastos.push({ firestoreId: doc.id, ...doc.data() }));
        RenderGastos();
    });

    Db.collection('clientes').onSnapshot(snapshot => {
        DirectorioClientes = [];
        Snapshot.forEach(doc => directorioClientes.push({ firestoreId: doc.id, ...doc.data() }));
        RenderClientesDirectorio();
    });

    Db.collection('pedidos').onSnapshot(snapshot => {
        Pedidos = [];
        PedidosPendientesAliados = []; 
        
        Snapshot.forEach(doc => {
            Const data = doc.data();
            If (data.pendiente_aprobacion === true) {
                PedidosPendientesAliados.push({ firestoreId: doc.id, ...data });
            } else {
                Pedidos.push({ firestoreId: doc.id, ...data });
            }
        });
        
        Pedidos.sort((a, b) => b.id - a.id);
        RenderPedidos();
        RenderPedidosPendientesAliadosTable(); 
        
        If (usuarioActual.rol === 'aliado') {
            RenderPedidosPortalAliado();
        }
    });
}

Function renderPedidosPendientesAliadosTable() {
    Const tbody = document.getElementById('tabla-pendientes-aliados-body');
    Const panelBox = document.getElementById('panel-pendientes-aliados-box');
    
    If (usuarioActual.rol !== 'admin') return;
    
    Tbody.innerHTML = '';
    If (pedidosPendientesAliados.length === 0) {
        PanelBox.style.display = "none";
        Return;
    }
    
    PanelBox.style.display = "block";
    PedidosPendientesAliados.forEach(p => {
        Tbody.innerHTML += `
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

Function cargarPedidoPendienteAlFormulario(fId) {
    Const p = pedidosPendientesAliados.find(item => item.firestoreId === fId);
    If (!p) return;
    
    Document.getElementById('ped-nombre').value = p.cliente;
    Document.getElementById('ped-telefono').value = p.telefono;
    Document.getElementById('ped-direccion').value = p.direccion;
    Document.getElementById('ped-aliado').value = p.aliado;
    Document.getElementById('ped-detalles').value = p.detalles;
    
    // Carga de fecha original enviada por aliado
    Const inputFecha = document.getElementById('ped-fecha');
    If (inputFecha) {
        InputFecha.value = parseDateVEToISO(p.fecha) || getVenezuelaDate();
    }

    Document.getElementById('ped-costo').value = "";
    Document.getElementById('ped-motorizado').value = "";
    
    EditPedidoId = "PENDIENTE_" + fId; 
    
    Document.getElementById('form-pedido-title').innerHTML = `<i class="fa-solid fa-truck-ramp-box" style="color:#ff6600"></i> Procesando Pedido de Aliado [${p.aliado}]`;
    
    Swal.fire({
        Toast: true,
        Position: 'top-end',
        Icon: 'info',
        Title: 'Datos cargados. Complete motorizado y costo.',
        ShowConfirmButton: false,
        Timer: 3500
    });
    
    Window.scrollTo({ top: 0, behavior: 'smooth' });
}

Function processPortalPedido(e) {
    E.preventDefault();
    Const clientName = document.getElementById('port-nombre').value.trim();
    Const clientPhone = document.getElementById('port-telefono').value.trim();
    Const clientDir = document.getElementById('port-direccion').value.trim();
    Const detailText = document.getElementById('port-detalles').value.trim();
    
    // Captura fecha seleccionada en portal o usa hoy por defecto
    Const inputFechaPort = document.getElementById('port-fecha');
    Const selectedFechaPort = inputFechaPort && inputFechaPort.value ? InputFechaPort.value : getVenezuelaDate();
    Const fechaFormatSalida = formatISOToVE(selectedFechaPort);

    Const numericId = Date.now();

    Const pedidoPreRegistro = {
        Id: numericId,
        Fecha: fechaFormatSalida,
        Hora: getVenezuelaTime(),
        Cliente: clientName,
        Telefono: clientPhone,
        Direccion: clientDir,
        Aliado: usuarioActual.aliadoComercial,
        Motorizado: "",
        Costo: 0,
        Detalles: detailText,
        Pendiente_aprobacion: true 
    };

    Swal.fire({ title: 'Sincronizando con central...', didOpen: () => { Swal.showLoading(); } });

    Db.collection('pedidos').add(pedidoPreRegistro).then(() => {
        Swal.close();
        Document.getElementById('form-portal-aliado').reset();
        If (inputFechaPort) inputFechaPort.value = getVenezuelaDate();
        
        Const msgCentralAdmin = encodeURIComponent(
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
            Title: "¡Solicitud Enviada!",
            Text: "Su pedido ha sido indexado. Presione el botón para enviar la notificación a despacho central vía WhatsApp.",
            Icon: "success",
            ConfirmButtonText: "Notificar por WhatsApp",
            ConfirmButtonColor: "#25d366"
        }).then(() => {
            Window.open(`https://api.whatsapp.com/send?phone=584244529892&text=${msgCentralAdmin}`, '_blank');
        });
    });
}

Function triggerAutocomplete(type) {
    Const valInputTel = document.getElementById("ped-telefono").value.trim().toLowerCase();
    Const valInputNom = document.getElementById("ped-nombre").value.trim().toLowerCase();
    
    Const boxTel = document.getElementById("sug-telefono");
    Const boxNom = document.getElementById("sug-nombre");

    BoxTel.innerHTML = "";
    BoxNom.innerHTML = "";
    BoxTel.style.display = "none";
    BoxNom.style.display = "none";

    If (type === 'telefono' && valInputTel.length >= 2) {
        Const coincidencias = directorioClientes.filter(c => c.telefono.toLowerCase().includes(valInputTel));
        If (coincidencias.length > 0) {
            BoxTel.style.display = "block";
            Coincidencias.forEach(c => {
                Const div = document.createElement("div");
                Div.className = "suggestion-item";
                Div.innerHTML = `<span>📱 <b>${c.telefono}</b></span><span class="sug-meta">${c.nombre}</span>`;
                Div.onclick = () => fillFormFromSuggestion(c);
                BoxTel.appendChild(div);
            });
        }
    } 
    Else if (type === 'nombre' && valInputNom.length >= 2) {
        Const coincidencias = directorioClientes.filter(c => c.nombre.toLowerCase().includes(valInputNom));
        If (coincidencias.length > 0) {
            BoxNom.style.display = "block";
            Coincidencias.forEach(c => {
                Const div = document.createElement("div");
                Div.className = "suggestion-item";
                Div.innerHTML = `<span>👤 <b>${c.nombre}</b></span><span class="sug-meta">${c.telefono}</span>`;
                Div.onclick = () => fillFormFromSuggestion(c);
                BoxNom.appendChild(div);
            });
        }
    }
}

Function fillFormFromSuggestion(cliente) {
    Document.getElementById("ped-telefono").value = cliente.telefono;
    Document.getElementById("ped-nombre").value = cliente.nombre;
    Document.getElementById("ped-direccion").value = cliente.direccion;
    
    Document.getElementById("sug-telefono").style.display = "none";
    Document.getElementById("sug-nombre").style.display = "none";

    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Cliente cargado con éxito', showConfirmButton: false, timer: 1500 });
}

Function saveDirectorioCliente(e) {
    E.preventDefault();
    Const nom = document.getElementById('cli-nombre').value.trim();
    Const tlf = document.getElementById('cli-telefono').value.trim();
    Const dir = document.getElementById('cli-direccion').value.trim();

    If (editClienteDirId !== null) {
        Db.collection('clientes').doc(editClienteDirId).update({ nombre: nom, telefono: tlf, direccion: dir })
        .then(() => {
            EditClienteDirId = null;
            Document.getElementById('form-cliente-title').innerHTML = `<i class="fa-solid fa-address-book" style="color:#ff6600"></i> Ficha de Registro de Clientes`;
            Document.getElementById('btn-submit-cliente-dir').innerHTML = `<i class="fa-solid fa-user-plus"></i> Guardar en Cartera`;
            Document.getElementById('form-directorio-cliente').reset();
            Swal.fire("Actualizado", "Datos del cliente modificados en la nube.", "success");
        });
    } else {
        Db.collection('clientes').add({ nombre: nom, telefono: tlf, direccion: dir, creado: Date.now() })
        .then(() => {
            Document.getElementById('form-directorio-cliente').reset();
            Swal.fire("Guardado", "Cliente nuevo añadido a la cartera comercial.", "success");
        });
    }
}

Function renderClientesDirectorio() {
    Const tbody = document.getElementById('tabla-clientes-directorio-body');
    Tbody.innerHTML = '';
    If(directorioClientes.length === 0) {
        Tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;" class="text-italic">Ningún cliente en la base de datos de la cartera.</td></tr>`;
        Return;
    }
    DirectorioClientes.forEach(c => {
        Tbody.innerHTML += `
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

Function editClienteDir(fId) {
    Const c = directorioClientes.find(item => item.firestoreId === fId);
    If (!c) return;
    EditClienteDirId = fId;
    Document.getElementById('form-cliente-title').innerHTML = `✏️ Editar Ficha Cliente`;
    Document.getElementById('btn-submit-cliente-dir').innerHTML = `Actualizar Cliente`;
    Document.getElementById('cli-nombre').value = c.nombre;
    Document.getElementById('cli-telefono').value = c.telefono;
    Document.getElementById('cli-direccion').value = c.direccion;
}

Function deleteClienteDir(fId) {
    Swal.fire({
        Title: '¿Eliminar de la cartera?',
        Text: "El cliente ya no aparecerá en las sugerencias automáticas.",
        Icon: 'warning',
        ShowCancelButton: true,
        ConfirmButtonColor: '#ff6600',
        CancelButtonColor: '#64748b',
        ConfirmButtonText: 'Sí, borrar',
        CancelButtonText: 'Cancelar'
    }).then((result) => {
        If (result.isConfirmed) {
            Db.collection('clientes').doc(fId).delete().then(() => {
                Swal.fire('Removido', 'Cliente desvinculado.', 'success');
            });
        }
    });
}

Function limpiarFiltrosBusqueda() {
    Const hoyISO = getVenezuelaDate();
    Document.getElementById('filtro-fecha-desde').value = hoyISO;
    Document.getElementById('filtro-fecha-hasta').value = hoyISO;
    Document.getElementById('filtro-aliado-busqueda').value = "";
    If(document.getElementById('filtro-motorizado-busqueda')) document.getElementById('filtro-motorizado-busqueda').value = "";
    RenderPedidos();
}

Function registerGasto(event) {
    Event.preventDefault();
    Const det = document.getElementById('gasto-detalle').value;
    Const mon = parseFloat(document.getElementById('gasto-monto').value) || 0;
    
    Db.collection('gastos').add({ detalle: det, monto: mon, fecha: getVenezuelaDate() }).then(() => {
        Document.getElementById('form-gastos').reset();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Gasto indexado', showConfirmButton: false, timer: 1500 });
    });
}

Function renderGastos() {
    Const container = document.getElementById('expense-container');
    If (gastos.length === 0) { container.innerHTML = 'Sin egresos registrados.'; return; }
    Container.innerHTML = '';
    Gastos.forEach(g => {
        Container.innerHTML += `<div class="expense-item"><span onclick="deleteGasto('${g.firestoreId}')" style="cursor:pointer;">❌ ${g.detalle}</span><b>$${g.monto.toFixed(2)}</b></div>`;
    });
    RenderPedidos(); 
}

Function deleteGasto(id) {
    Swal.fire({
        Title: '¿Eliminar Gasto?',
        Icon: 'question',
        ShowCancelButton: true,
        ConfirmButtonColor: '#ef4444',
        ConfirmButtonText: 'Eliminar'
    }).then((res) => {
        If(res.isConfirmed) db.collection('gastos').doc(id).delete();
    });
}

Function renderPedidos() {
    Const tbody = document.getElementById('tabla-pedidos-body');
    Tbody.innerHTML = '';

    Const fDesde = document.getElementById('filtro-fecha-desde').value;
    Const fHasta = document.getElementById('filtro-fecha-hasta').value;
    
    Const fAliado = usuarioActual.rol === 'aliado' ? UsuarioActual.aliadoComercial : document.getElementById('filtro-aliado-busqueda').value;
    Const fMotorizado = usuarioActual.rol === 'aliado' ? "" : document.getElementById('filtro-motorizado-busqueda').value;

    Const pedidosFiltrados = pedidos.filter(p => {
        If (p.pendiente_aprobacion) return false; 
        Const pedidoFechaISO = parseDateVEToISO(p.fecha);
        If (fDesde && pedidoFechaISO < fDesde) return false;
        If (fHasta && pedidoFechaISO > fHasta) return false;
        If (fAliado && p.aliado !== fAliado) return false;
        If (fMotorizado && p.motorizado !== fMotorizado) return false;
        Return true;
    });

    Let totalIngresos = 0;
    PedidosFiltrados.forEach(p => {
        TotalIngresos += p.costo;
    });
    
    Let totalGastos = 0;
    If (usuarioActual.rol === 'admin') {
        Const gastosFiltrados = gastos.filter(g => {
            If (fDesde && g.fecha < fDesde) return false;
            If (fHasta && g.fecha > fHasta) return false;
            Return true;
        });
        GastosFiltrados.forEach(g => totalGastos += g.monto);
    }

    Let neto = totalIngresos - totalGastos;

    Document.getElementById('dash-cant-pedidos').innerText = pedidosFiltrados.length;
    Document.getElementById('dash-ingreso-usd').innerText = `$${totalIngresos.toFixed(2)}`;
    
    If (usuarioActual.rol === 'admin') {
        Document.getElementById('dash-gasto-usd').innerText = `$${totalGastos.toFixed(2)}`;
        Document.getElementById('dash-balance-neto').innerText = `$${neto.toFixed(2)}`;
        Const boxNeto = document.getElementById('dash-neto-box');
        If(neto >= 0) { boxNeto.className = "dash-card neto-pos"; } else { boxNeto.className = "dash-card neto-neg"; }
    }

    If(pedidosFiltrados.length === 0) {
        Tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;" class="text-italic">No hay pedidos registrados con los filtros seleccionados.</td></tr>`;
        Return;
    }

    PedidosFiltrados.forEach(p => {
        Let btnAcciones = usuarioActual.rol === 'admin' ? `
            <td>
                <div class="action-cell">
                    <button type="button" class="action-btn" onclick="editPedido(event, '${p.firestoreId}')">✏️</button>
                    <button type="button" class="action-btn" onclick="deletePedido(event, '${p.firestoreId}')">🗑️</button>
                </div>
            </td>
        ` : `<td class="v-admin"></td>`;

        Tbody.innerHTML += `
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

Function processNewPedido(e) {
    E.preventDefault();
    Const clientName = document.getElementById('ped-nombre').value.trim();
    Const clientPhone = document.getElementById('ped-telefono').value.trim();
    Const clientDir = document.getElementById('ped-direccion').value.trim();
    
    Const chosenAliado = usuarioActual.rol === 'aliado' ? UsuarioActual.aliadoComercial : document.getElementById('ped-aliado').value;
    Const chosenMoto = usuarioActual.rol === 'aliado' ? "Pendiente por Asignar" : document.getElementById('ped-motorizado').value;
    
    Const costValue = parseFloat(document.getElementById('ped-costo').value) || 0;
    Const detailText = document.getElementById('ped-detalles').value || "Despacho";

    // Manejo de Fecha seleccionada
    Const inputFechaPed = document.getElementById('ped-fecha');
    Const selectedFechaISO = inputFechaPed && inputFechaPed.value ? InputFechaPed.value : getVenezuelaDate();
    Const fechaFormatSalida = formatISOToVE(selectedFechaISO);

    Const existeCliente = directorioClientes.some(c => c.telefono === clientPhone);
    If (!existeCliente && clientPhone && clientName) {
        Db.collection('clientes').add({ nombre: clientName, telefono: clientPhone, direccion: clientDir, creado: Date.now() });
    }

    Let pendingReferenceId = null;
    If (editPedidoId && editPedidoId.startsWith("PENDIENTE_")) {
        PendingReferenceId = editPedidoId.replace("PENDIENTE_", "");
    }

    If (editPedidoId !== null && !pendingReferenceId) {
        Db.collection('pedidos').doc(editPedidoId).update({
            Fecha: fechaFormatSalida,
            Cliente: clientName, telefono: clientPhone, direccion: clientDir,
            Aliado: chosenAliado, motorizado: chosenMoto, costo: costValue, detalles: detailText
        }).then(() => {
            EditPedidoId = null;
            Document.getElementById('form-pedido-title').innerHTML = `<i class="fa-solid fa-truck-ramp-box" style="color:#ff6600"></i> Agregar Nuevo Pedido`;
            Document.getElementById('btn-submit-pedido').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Pedido`;
            Document.getElementById('form-pedido').reset();
            If (inputFechaPed) inputFechaPed.value = getVenezuelaDate();
            Swal.fire("Modificado", "Pedido actualizado con éxito.", "success");
            SwitchTab('gestion');
        });
    } else {
        Const numericId = Date.now();

        Const nuevoPedido = {
            Id: numericId,
            Fecha: fechaFormatSalida,
            Hora: getVenezuelaTime(),
            Cliente: clientName, telefono: clientPhone, direccion: clientDir,
            Aliado: chosenAliado, motorizado: chosenMoto, costo: costValue, detalles: detailText
        };

        If (pendingReferenceId) {
            Db.collection('pedidos').doc(pendingReferenceId).delete();
            EditPedidoId = null;
        }

        Db.collection('pedidos').add(nuevoPedido).then(() => {
            Const dataAliado = aliados.find(a => a.nombre === nuevoPedido.aliado) || { telefono: "" };
            Const dataMoto = motorizados.find(m => m.nombre === nuevoPedido.motorizado) || { telefono: "" };
            
            Const msgCliente = encodeURIComponent(
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

            Const msgAliado = encodeURIComponent(
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

            Const msgMotorizado = encodeURIComponent(
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

            Document.getElementById('wa-btn-cliente').href = `https://api.whatsapp.com/send?phone=${nuevoPedido.telefono}&text=${msgCliente}`;
            Document.getElementById('wa-btn-aliado').href = `https://api.whatsapp.com/send?phone=${dataAliado.telefono}&text=${msgAliado}`;
            Document.getElementById('wa-btn-motorizado').href = `https://api.whatsapp.com/send?phone=${dataMoto.telefono}&text=${msgMotorizado}`;

            Document.getElementById('form-pedido').reset();
            If (inputFechaPed) inputFechaPed.value = getVenezuelaDate();
            
            Document.getElementById('form-pedido-title').innerHTML = `<i class="fa-solid fa-truck-ramp-box" style="color:#ff6600"></i> Agregar Nuevo Pedido`;
            Document.getElementById('btn-submit-pedido').innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Pedido`;
            Document.getElementById('whatsapp-modal').classList.add('active');
        });
    }
}

Function editPedido(event, fId) {
    If (event) event.stopPropagation();
    Const p = pedidos.find(item => item.firestoreId === fId);
    If (!p) return;
    
    EditPedidoId = fId;
    Document.getElementById('form-pedido-title').innerHTML = `✏️ Editar Pedido Comercial`;
    Document.getElementById('btn-submit-pedido').innerHTML = `Actualizar Pedido`;

    // Cargar fecha existente en el selector
    Const inputFechaPed = document.getElementById('ped-fecha');
    If (inputFechaPed) {
        InputFechaPed.value = parseDateVEToISO(p.fecha) || getVenezuelaDate();
    }

    Document.getElementById('ped-nombre').value = p.cliente;
    Document.getElementById('ped-telefono').value = p.telefono;
    Document.getElementById('ped-direccion').value = p.direccion;
    If(usuarioActual.rol === 'admin') document.getElementById('ped-aliado').value = p.aliado;
    Document.getElementById('ped-motorizado').value = p.motorizado;
    Document.getElementById('ped-costo').value = p.costo;
    Document.getElementById('ped-detalles').value = p.detalles;
    SwitchTab('agregar');
}

Function deletePedido(event, fId) {
    If (event) event.stopPropagation();
    Swal.fire({
        Title: '¿Eliminar Pedido?',
        Text: "Esta acción borrará el registro permanente en la nube.",
        Icon: 'warning',
        ShowCancelButton: true,
        ConfirmButtonColor: '#ff6600',
        ConfirmButtonText: 'Sí, borrar de la nube'
    }).then((res) => {
        If(res.isConfirmed) {
            Db.collection('pedidos').doc(fId).delete().then(() => {
                Swal.fire("Borrado", "El despacho fue eliminado.", "success");
            });
        }
    });
}

Function closeWhatsAppModal() {
    Document.getElementById('whatsapp-modal').classList.remove('active');
    SwitchTab('gestion');
}

Function renderMotorizados() {
    Const tbody = document.getElementById('tabla-motorizados-body');
    Tbody.innerHTML = '';
    If(motorizados.length === 0) {
        Tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;" class="text-italic">No hay motorizados registrados.</td></tr>`;
        Return;
    }
    Motorizados.forEach(m => {
        Tbody.innerHTML += `
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

Function saveMotorizado(e) {
    E.preventDefault();
    Const nom = document.getElementById('moto-nombre').value;
    Const tlf = document.getElementById('moto-telefono').value;
    Const plc = document.getElementById('moto-placa').value;
    Const dir = document.getElementById('moto-direccion').value;

    If (editMotoId !== null) {
        Db.collection('motorizados').doc(editMotoId).update({ nombre: nom, telefono: tlf, placa: plc, direccion: dir })
        .then(() => {
            EditMotoId = null;
            Document.getElementById('form-moto-title').innerHTML = `<i class="fa-solid fa-helmet-safety" style="color:#ff6600"></i> Panel de Repartidores`;
            Document.getElementById('btn-submit-moto').innerHTML = `<i class="fa-solid fa-circle-check"></i> Guardar Repartidor`;
            Document.getElementById('form-motorizado').reset();
            Swal.fire("Listo", "Motorizado actualizado.", "success");
        });
    } else {
        Db.collection('motorizados').add({ id: Date.now(), nombre: nom, telefono: tlf, placa: plc, direccion: dir })
        .then(() => {
            Document.getElementById('form-motorizado').reset();
            Swal.fire("Registrado", "Nuevo repartidor en línea.", "success");
        });
    }
}

Function editMotorizado(fId) {
    Const m = motorizados.find(item => item.firestoreId === fId);
    If (!m) return;
    EditMotoId = fId;
    Document.getElementById('form-moto-title').innerHTML = `✏️ Editar Motorizado`;
    Document.getElementById('btn-submit-moto').innerHTML = `Actualizar`;
    Document.getElementById('moto-nombre').value = m.nombre;
    Document.getElementById('moto-telefono').value = m.telefono;
    Document.getElementById('moto-placa').value = m.placa;
    Document.getElementById('moto-direccion').value = m.direccion;
}

Function deleteMotorizado(fId) {
    Swal.fire({ title: '¿Dar de baja repartidor?', icon: 'warning', showCancelButton: true }).then(r => {
        If(r.isConfirmed) db.collection('motorizados').doc(fId).delete();
    });
}

Function renderAliados() {
    Const tbody = document.getElementById('tabla-aliados-body');
    Tbody.innerHTML = '';
    If(aliados.length === 0) {
        Tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;" class="text-italic">No hay aliados comerciales registrados.</td></tr>`;
        Return;
    }
    Aliados.forEach(a => {
        Tbody.innerHTML += `
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

Function saveAliado(e) {
    E.preventDefault();
    Const nom = document.getElementById('aliado-nombre').value.trim();
    Const usrVal = document.getElementById('aliado-usuario').value.trim(); 
    Const pinVal = document.getElementById('aliado-pin').value.trim();
    Const tlf = document.getElementById('aliado-telefono').value;
    Const dir = document.getElementById('aliado-direccion').value;

    If (editAliadoId !== null) {
        Db.collection('aliados').doc(editAliadoId).update({ nombre: nom, usuario: usrVal, pin: pinVal, telefono: tlf, direccion: dir })
        .then(() => {
            EditAliadoId = null;
            Document.getElementById('form-aliado-title').innerHTML = `<i class="fa-solid fa-shop" style="color:#ff6600"></i> Registro Comercial Aliado`;
            Document.getElementById('btn-submit-aliado').innerHTML = `<i class="fa-solid fa-circle-check"></i> Guardar Comercio`;
            Document.getElementById('form-aliado').reset();
            Swal.fire("Completado", "Aliado comercial modificado.", "success");
        });
    } else {
        Db.collection('aliados').add({ id: Date.now(), nombre: nom, usuario: usrVal, pin: pinVal, telefono: tlf, direccion: dir })
        .then(() => {
            Document.getElementById('form-aliado').reset();
            Swal.fire("Perfecto", "Comercio aliado agregado con su respectiva clave y usuario.", "success");
        });
    }
}

Function editAliado(fId) {
    Const a = aliados.find(item => item.firestoreId === fId);
    If (!a) return;
    EditAliadoId = fId;
    Document.getElementById('form-aliado-title').innerHTML = `✏️ Editar Aliado Comercial`;
    Document.getElementById('btn-submit-aliado').innerHTML = `Actualizar`;
    Document.getElementById('aliado-nombre').value = a.nombre;
    Document.getElementById('aliado-usuario').value = a.usuario || ""; 
    Document.getElementById('aliado-pin').value = a.pin || "";
    Document.getElementById('aliado-telefono').value = a.telefono;
    Document.getElementById('aliado-direccion').value = a.direccion;
}

Function deleteAliado(fId) {
    Swal.fire({ title: '¿Remover Aliado de la red?', icon: 'warning', showCancelButton: true }).then(r => {
        If(r.isConfirmed) db.collection('aliados').doc(fId).delete();
    });
}

Function updateSelectDropdowns() {
    Const pAliado = document.getElementById('ped-aliado');
    Const pMoto = document.getElementById('ped-motorizado');
    Const iAliado = document.getElementById('invoice-aliado');
    Const bAliado = document.getElementById('filtro-aliado-busqueda');
    Const bMotorizado = document.getElementById('filtro-motorizado-busqueda');
    Const iMotorizadoPayroll = document.getElementById('invoice-motorizado-payroll');

    Const currentPAliado = pAliado.value;
    Const currentPMoto = pMoto.value;
    Const currentIAliado = iAliado.value;
    Const currentBAliado = bAliado.value;
    Const currentBMotorizado = bMotorizado ? BMotorizado.value : "";
    Const currentIMotoPayroll = iMotorizadoPayroll.value;

    PAliado.innerHTML = '<option value="">Seleccione un aliado...</option>';
    PMoto.innerHTML = '<option value="">Seleccione un motorizado...</option>';
    IAliado.innerHTML = '<option value="">Seleccione Aliado...</option><option value="TODOS_LOS_ALIADOS">-- SELECCIONAR TODOS LOS ALIADOS --</option>';
    If(bAliado) bAliado.innerHTML = '<option value="">Todos los Aliados</option>';
    If(bMotorizado) bMotorizado.innerHTML = '<option value="">Todos los Motorizados</option>';
    IMotorizadoPayroll.innerHTML = '<option value="">Seleccione Motorizado...</option>';

    Aliados.forEach(a => {
        PAliado.innerHTML += `<option value="${a.nombre}">${a.nombre}</option>`;
        IAliado.innerHTML += `<option value="${a.nombre}">${a.nombre}</option>`;
        If(bAliado) bAliado.innerHTML += `<option value="${a.nombre}">${a.nombre}</option>`;
    });
    Motorizados.forEach(m => {
        PMoto.innerHTML += `<option value="${m.nombre}">${m.nombre}</option>`;
        If(bMotorizado) bMotorizado.innerHTML += `<option value="${m.nombre}">${m.nombre}</option>`;
        IMotorizadoPayroll.innerHTML += `<option value="${m.nombre}">${m.nombre}</option>`;
    });

    If(currentPAliado) pAliado.value = currentPAliado;
    If(currentPMoto) pMoto.value = currentPMoto;
    If(currentIAliado) iAliado.value = currentIAliado;
    If(currentBAliado) bAliado.value = currentBAliado;
    If(bMotorizado && currentBMotorizado) bMotorizado.value = currentBMotorizado;
    If(currentIMotoPayroll) iMotorizadoPayroll.value = currentIMotoPayroll;
}

Function FormatearBs(monto) {
    Return monto.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

Function AntiXSS(str) {
    Return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

Function openReceiptModal(fId) {
    SelectedPedido = pedidos.find(p => p.firestoreId === fId);
    If(!selectedPedido) return;

    Document.getElementById('tkt-cliente').innerText = selectedPedido.cliente;
    Document.getElementById('tkt-tlf').innerText = selectedPedido.telefono;
    Document.getElementById('tkt-dir').innerText = selectedPedido.direccion;
    Document.getElementById('tkt-aliado').innerText = selectedPedido.aliado;
    Document.getElementById('tkt-moto').innerText = selectedPedido.motorizado || 'No asignado';
    Document.getElementById('modal-monto').value = selectedPedido.costo.toFixed(2);

    UpdateTicketCalculations();
    Document.getElementById('receipt-modal').classList.add('active');
}

Function updateTicketCalculations() {
    Const tasa = parseFloat(document.getElementById('modal-tasa').value) || 0;
    Const usd = parseFloat(document.getElementById('modal-monto').value) || 0;
    Document.getElementById('tkt-tasa-text').innerText = tasa.toFixed(2);
    Document.getElementById('tkt-usd-text').innerText = usd.toFixed(2);
    Document.getElementById('tkt-bs-text').innerText = FormatearBs(usd * tasa);
}

Function closeReceiptModal() {
    Document.getElementById('receipt-modal').classList.remove('active');
}

Function triggerDownloadJPG() {
    Const ticketArea = document.getElementById('print-ticket-area');
    Swal.fire({
        Title: 'Generando Imagen...',
        Html: 'Espere por favor.',
        DidOpen: () => { Swal.showLoading(); }
    });

    Html2canvas(ticketArea, { useCORS: true, scale: 3, backgroundColor: "#ffffff" }).then(canvas => {
        Const imgData = canvas.toDataURL('image/jpeg', 0.95);
        Const link = document.createElement('a');
        Link.href = imgData;
        Const nombreCliente = document.getElementById('tkt-cliente').innerText.replace(/\s+/g, '_') || 'Ticket';
        Link.download = `Ticket_${nombreCliente}.jpg`;
        Document.body.appendChild(link);
        Link.click();
        Document.body.removeChild(link);
        Swal.close();
    }).catch(err => {
        Console.error(err);
        Swal.fire("Error", "No se pudo compilar la captura del ticket.", "error");
    });
}

// INICIALIZACIÓN GLOBAL DE DATOS
SyncCloudData();
