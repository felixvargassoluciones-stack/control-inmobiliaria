// URL de despliegue que nos dio tu Google Apps Script en la nube
const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbwVNHAQzlN9MvXxbhNM_-c6VIie4dKA57q-GnWXzpbeyBj6NHXrGCz7exTT35lHsoYf/exec";

// BANDERAS DE CACHÉ INTELIGENTE PARA LOGRAR CARGA INSTANTÁNEA (EVITA SOLICITUDES REPETIDAS)
const CONFIG_CACHE_MODULOS = {
    fraccionamientosCargados: false,
    viviendasInicializadas: false,
    cobrosInicializados: false,
    reportesInicializados: false,
    arrendadosCargados: false // <-- INYECCIÓN QUIRÚRGICA DE CONTROL
};

// ==========================================================================
// 1. SISTEMA INTEGRAL DE NAVEGACIÓN ENTRE PESTAÑAS (TABS GENERALES) - ALTA VELOCIDAD
// ==========================================================================
const botonesMenu = document.querySelectorAll('.btn-menu');
const seccionesModulos = document.querySelectorAll('.seccion-modulo');

botonesMenu.forEach(boton => {
    boton.addEventListener('click', () => {
        // Desactivar el botón anterior
        document.querySelector('.btn-menu.active').classList.remove('active');
        // Activar el botón presionado
        boton.classList.add('active');
        
        // Ocultar todas las pantallas operativas
        seccionesModulos.forEach(sec => sec.classList.add('hidden'));
        
        // Mostrar la pantalla correspondiente al botón pulsado
        const tabId = boton.id.replace('btn-', '');
        document.getElementById(tabId).classList.remove('hidden');
        
        // DISPARADORES INTELIGENTES CON CARGA ÚNICA (SOLO CONSUMEN SI LA CACHÉ ESTÁ VACÍA)
        if (tabId === 'tab-fraccionamientos') {
            if (!CONFIG_CACHE_MODULOS.fraccionamientosCargados) {
                cargarFraccionamientos();
                CONFIG_CACHE_MODULOS.fraccionamientosCargados = true;
            }
        }
        
        if (tabId === 'tab-viviendas') {
            if (!CONFIG_CACHE_MODULOS.viviendasInicializadas) {
                inicializarModuloViviendas();
                CONFIG_CACHE_MODULOS.viviendasInicializadas = true;
            }
            // Mantiene el contenedor limpio sin volver a llamar al servidor de forma masiva
            if (!selectFraccionamiento.value) {
                document.getElementById('contenedor-tarjetas').innerHTML = `<div class="mensaje-vacio">Selecciona un fraccionamiento arriba para visualizar su catálogo contable.</div>`;
            }
        }

        if (tabId === 'tab-inventarios') {
            inicializarModuloInventarios();
        }

        if (tabId === 'tab-reportes') {
            if (!CONFIG_CACHE_MODULOS.reportesInicializados) {
                inicializarModuloReportes();
                CONFIG_CACHE_MODULOS.reportesInicializados = true;
            }
        }

        if (tabId === 'tab-cobros') {
            if (!CONFIG_CACHE_MODULOS.cobrosInicializados) {
                inicializarModuloCobros();
                CONFIG_CACHE_MODULOS.cobrosInicializados = true;
            }
        }

                if (tabId === 'tab-arrendados') {
            if (!CONFIG_CACHE_MODULOS.arrendadosCargados) {
                cargarInquilinosLegales();
                CONFIG_CACHE_MODULOS.arrendadosCargados = true;
            }
        }





    });
});

// ==========================================================================
// 2. LOGICA OPERATIVA DEL MÓDULO 1: FRACCIONAMIENTOS
// ==========================================================================
const formFraccionamiento = document.getElementById('form-fraccionamiento');
const listaFraccionamientos = document.getElementById('lista-fraccionamientos');
const txtContadorFrac = document.getElementById('txt-contador-frac');

async function cargarFraccionamientos() {
    mostrarCarga("Actualizando catálogo de fraccionamientos...");
    try {
        const res = await fetch(`${GOOGLE_API_URL}?accion=leerFraccionamientos`);
        const datos = await res.json();
        
        listaFraccionamientos.innerHTML = "";
        txtContadorFrac.innerText = `${datos.length} Registrados`;
        
        if (datos.length === 0) {
            listaFraccionamientos.innerHTML = `<div class="mensaje-vacio">No hay fraccionamientos registrados. Crea el primero a la izquierda.</div>`;
            return;
        }
        datos.forEach(frac => {
            const item = document.createElement('div');
            item.className = "tarjeta-item-simple";
            item.innerHTML = `
                <div>
                    <h4>${frac.nombre_fraccionamiento}</h4>
                    <p>📍 Ciudad: ${frac.ubicacion_ciudad}</p>
                </div>
                <span class="contador-badge">${frac.id_fraccionamiento}</span>
            `;
            listaFraccionamientos.appendChild(item);
        });
    } catch (e) {
        listaFraccionamientos.innerHTML = `<div class="mensaje-vacio" style="color: #ef4444;">Error de enlace con Google Sheets.</div>`;
    } finally {
        ocultarCarga();
    }
}

formFraccionamiento.addEventListener('submit', async (e) => {
    e.preventDefault();
    mostrarCarga("Escribiendo nuevo fraccionamiento en Google Sheets...");

    const payload = {
        accion: "guardarFraccionamiento",
        id_fraccionamiento: document.getElementById('inp-frac-id').value,
        nombre_fraccionamiento: document.getElementById('inp-frac-nombre').value,
        ubicacion_ciudad: document.getElementById('inp-frac-ciudad').value
    };

    try {
        const res = await fetch(GOOGLE_API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const res_data = await res.json();
        if (res_data.estatus === "exito") {
            alert("Fraccionamiento registrado con éxito en la Sheet Maestro.");
            formFraccionamiento.reset();
            cargarFraccionamientos();
        }
    } catch (error) {
        alert("Error de red al guardar el fraccionamiento.");
    } finally {
        ocultarCarga();
    }
});
// ==========================================================================
// 3. LOGICA OPERATIVA DEL MÓDULO 2: VIVIENDAS
// ==========================================================================
const selectFracVivienda = document.getElementById('select-frac-vivienda');
const selectFraccionamiento = document.getElementById('select-fraccionamiento');
const formPropiedad = document.getElementById('form-propiedad');
const contenedorTarjetas = document.getElementById('contenedor-tarjetas');
const txtContador = document.getElementById('txt-contador');
const modalCarga = document.getElementById('modal-carga');
const txtModalCarga = document.getElementById('txt-modal-carga');

// VARIABLE GLOBAL DE MEMORIA DE CONTRATOS (DECLARADA SOLO UNA VEZ AQUÍ):
let memoriaViviendasActuales = [];

async function inicializarModuloViviendas() {
    try {
        const res = await fetch(`${GOOGLE_API_URL}?accion=leerFraccionamientos`);
        const datos = await res.json();
        
        const valorPrevioFiltro = selectFraccionamiento.value;
        const valorPrevioAlta = selectFracVivienda.value;

        selectFracVivienda.innerHTML = '<option value="">-- Selecciona Fraccionamiento --</option>';
        selectFraccionamiento.innerHTML = '<option value="">-- Selecciona Fraccionamiento --</option>';
        
        datos.forEach(frac => {
            const opt = `<option value="${frac.id_fraccionamiento}">${frac.nombre_fraccionamiento}</option>`;
            selectFracVivienda.innerHTML += opt;
            selectFraccionamiento.innerHTML += opt;
        });

        if(valorPrevioFiltro) selectFraccionamiento.value = valorPrevioFiltro;
        if(valorPrevioAlta) selectFracVivienda.value = valorPrevioAlta;
    } catch (e) {
        console.error("Error al poblar selectores de fraccionamiento.");
    }
}

selectFraccionamiento.addEventListener('change', async (e) => {
    const idFrac = e.target.value;
    if (!idFrac) {
        contenedorTarjetas.innerHTML = `<div class="mensaje-vacio">Selecciona un fraccionamiento arriba para visualizar su catálogo contable.</div>`;
        txtContador.innerText = "0 Propiedades";
        return;
    }
    
    mostrarCarga("Descargando historial de propiedades...");
    try {
        const respuesta = await fetch(`${GOOGLE_API_URL}?accion=leerViviendas&id_fraccionamiento=${idFrac}`);
        const propiedades = await respuesta.json();
        
        // RESPALDO INTERMEDIO DE DATOS CONTRACTUALES EN MEMORIA:
        memoriaViviendasActuales = propiedades;
        
        renderizarTarjetas(propiedades);
    } catch (error) {
        alert("Error de conexión al leer el Google Sheet.");
    } finally {
        ocultarCarga();
    }
});
formPropiedad.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idFracAsignado = selectFracVivienda.value;
    if (!idFracAsignado) {
        alert("Por favor, asigna la propiedad a un fraccionamiento válido.");
        return;
    }

    // DETECTAR MODO EDICIÓN USANDO EL CAMPO DE CÓDIGO BLOQUEADO
    const esEdicion = document.getElementById('inp-codigo').readOnly;

    mostrarCarga(esEdicion ? "Actualizando configuración contractual en Google Sheets..." : "Subiendo datos y archivos multimedia a Google Drive...");

        const datos = {
        accion: esEdicion ? "actualizarPropiedadContractual" : "guardarPropiedad",

        id_fraccionamiento: idFracAsignado,
        id_vivienda: document.getElementById('inp-codigo').value,
        estatus: document.getElementById('sel-estatus').value,
        direccion: document.getElementById('inp-direccion').value,
        monto_renta: document.getElementById('inp-renta').value,
        monto_mantenimiento: document.getElementById('inp-mantenimiento').value,
        
        // DATOS DEL INQUILINO (EXISTENTES)
        nombre_inquilino: document.getElementById('inp-inquilino').value,
        correo: document.getElementById('inp-correo').value,
        telefono: document.getElementById('inp-telefono').value,
        
        // 💼 CONEXIÓN SENIOR: SE CAPTURAN LAS TRES NUEVAS VARIABLES DEL PROPIETARIO
        nombre_propietario: document.getElementById('inp-propietario-nombre').value,
        correo_propietario: document.getElementById('inp-propietario-correo').value,
        telefono_propietario: document.getElementById('inp-propietario-telefono').value,
        
        // Extraemos limpiamente el día calendario del formato AAAA-MM-DD
        dia_pago: document.getElementById('inp-inicio-contrato').value ? parseInt(document.getElementById('inp-inicio-contrato').value.split('-')[2], 10) : "",
        fecha_inicio_contrato: document.getElementById('inp-inicio-contrato').value,

        // NUEVOS CAMPOS INTELIGENTES ADICIONALES:
        mantenimiento_responsable: document.getElementById('sel-mantenimiento-resp').value,
        agua_responsable: document.getElementById('sel-agua-resp').value,
        luz_responsable: document.getElementById('sel-luz-resp').value,
        tipo_comision_inmobiliaria: document.getElementById('sel-tipo-comision').value,
        valor_comision_inmobiliaria: document.getElementById('inp-valor-comision').value,
        archivos: []
    };

    const inputArchivos = document.getElementById('inp-multimedia').files;
    if (inputArchivos && inputArchivos.length > 0) {
        for (let i = 0; i < inputArchivos.length; i++) {
            const archivoBase64 = await convertirBase64(inputArchivos[i]);
            datos.archivos.push({
                nombre: inputArchivos[i].name,
                tipo: inputArchivos[i].type,
                base64: archivoBase64.split(',')[1]
            });
        }
    }
    try {
        const response = await fetch(GOOGLE_API_URL, { method: 'POST', body: JSON.stringify(datos) });
        const resultado = await response.json();
        if (resultado.estatus === "exito") {
            alert(esEdicion ? "🎉 Configuración contractual y montos actualizados correctamente." : "Propiedad registrada con éxito. Carpeta de Drive estructurada.");
            
            // Restaurar formulario a su estado original de Alta
            formPropiedad.reset();
            
            const selFrac = document.getElementById('select-frac-vivienda');
            const inputCodigo = document.getElementById('inp-codigo');
            const inputDireccion = document.getElementById('inp-direccion');

            // Liberar restricciones de los campos estructurales fijos
            selFrac.disabled = false;
            selFrac.style.backgroundColor = "#fff";
            selFrac.style.cursor = "default";

            inputCodigo.readOnly = false;
            inputCodigo.style.backgroundColor = "#fff";
            inputCodigo.style.cursor = "text";

            inputDireccion.readOnly = false;
            inputDireccion.style.backgroundColor = "#fff";
            inputDireccion.style.cursor = "text";

            const btnGuardar = document.querySelector('#form-propiedad .btn-guardar');
            if (btnGuardar) {
                btnGuardar.innerText = "💾 Guardar Propiedad";
                btnGuardar.style.backgroundColor = "#10b981"; // Regresa a verde esmeralda
            }

            selectFraccionamiento.value = idFracAsignado;
            selectFraccionamiento.dispatchEvent(new Event('change'));
        }
    } catch (error) { 
        alert("Error en el envío de datos de la propiedad."); 
    } finally { 
        ocultarCarga(); 
    }
});
function renderizarTarjetas(lista) {
    contenedorTarjetas.innerHTML = "";
    txtContador.innerText = `${lista.length} Propiedades`;
    if (lista.length === 0) {
        contenedorTarjetas.innerHTML = `<div class="mensaje-vacio">Ninguna vivienda registrada en este fraccionamiento todavía.</div>`;
        return;
    }
    lista.forEach(casa => {
        const tarjeta = document.createElement('div');
        tarjeta.className = "tarjeta-casa-dinamica";
        
        tarjeta.innerHTML = `
            <div>
                <div class="casa-header">
                    <h3>${casa.nombre_propiedad}</h3>
                    <span class="badge-status" style="background-color: ${casa.estatus === 'Rentada' ? '#d1fae5' : '#e2e8f0'}; color: ${casa.estatus === 'Rentada' ? '#065f46' : '#475569'};">${casa.estatus}</span>
                </div>
                <p style="font-size: 11px; color:#9ca3af; margin-bottom:10px;">Código: ${casa.id_vivienda}</p>
                <div class="casa-info" style="display: flex; flex-direction: column; gap: 4px;">
                    <p><strong>Inquilino:</strong> ${casa.nombre_inquilino || 'Sin arrendar'}</p>
                    <p><strong>Día de Pago Pactado:</strong> ${casa.dia_pago || 'N/A'}</p>
                    <p style="font-size: 11px; color: #6b7280; margin-top: 4px; border-top: 1px dashed #e2e8f0; padding-top: 4px;"> Renta Base: $${casa.renta_base || 0} | Mant: $${casa.mantenimiento_base || 0}</p>
                </div>
            </div>
            <div class="grid-botones-casa">
                <button onclick="window.open('${casa.fotos_links || '#'}', '_blank')" class="btn-casa-action gray">📁 Carpeta Drive</button>
                <button onclick="prepararEdicionContrato('${casa.id_vivienda}')" class="btn-casa-action" style="background-color: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1;">✏️ Modificar</button>
            </div>
        `;
        contenedorTarjetas.appendChild(tarjeta);
    });
}

function prepararEdicionContrato(idVivienda) {
    const casa = memoriaViviendasActuales.find(item => item.id_vivienda === idVivienda);
    
    if (!casa) {
        alert("🛑 No se encontraron los datos contractuales de esta propiedad.");
        return;
    }

    // 1. Auto-llenar Campos Generales Base y heredar fraccionamiento del filtro derecho
    document.getElementById('select-frac-vivienda').value = document.getElementById('select-fraccionamiento').value;
    document.getElementById('inp-codigo').value = casa.id_vivienda;
    document.getElementById('sel-estatus').value = casa.estatus;
    document.getElementById('inp-direccion').value = casa.direccion_exacta || "";
    
    // Dejar libres y editables las variables financieras maestros reajustables
document.getElementById('inp-renta').value = casa.renta_base || 0;
document.getElementById('inp-mantenimiento').value = casa.mantenimiento_base || 0;

// 💼 CONEXIÓN SENIOR: AUTO-LLENAR LOS CAMPOS UNIFICADOS DEL PROPIETARIO EN MODO EDICIÓN
document.getElementById('inp-propietario-nombre').value = casa.nombre_propietario || "";
document.getElementById('inp-propietario-correo').value = casa.correo_propietario || "";
document.getElementById('inp-propietario-telefono').value = casa.telefono_propietario || "";

// 2. Auto-llenar Campos Contractuales del Inquilino (Variables libres)
document.getElementById('inp-inquilino').value = casa.nombre_inquilino || "";

    document.getElementById('inp-correo').value = casa.correo_inquilino || "";
    document.getElementById('inp-telefono').value = casa.telefono_inquilino || "";
    document.getElementById('inp-diapago').value = casa.dia_pago || "";

    // 3. Auto-llenar Matrices Inteligentes de Responsabilidad (Variables libres)
    document.getElementById('sel-mantenimiento-resp').value = casa.mantenimiento_responsable || "Inquilino";
    document.getElementById('sel-agua-resp').value = casa.agua_responsable || "Inquilino";
    document.getElementById('sel-luz-resp').value = casa.luz_responsable || "Inquilino";
    document.getElementById('sel-tipo-comision').value = casa.tipo_comision_inmobiliaria || "Porcentaje";
    document.getElementById('inp-valor-comision').value = casa.valor_comision_inmobiliaria || 0;

    // 4. CONGELAMIENTO DE DATOS FIJOS E INMUTABLES DE LA VIVIENDA (ESTRUCTURAL)
    const selFrac = document.getElementById('select-frac-vivienda');
    const inputCodigo = document.getElementById('inp-codigo');
    const inputDireccion = document.getElementById('inp-direccion');

    selFrac.disabled = true;
    selFrac.style.backgroundColor = "#f1f5f9";
    selFrac.style.cursor = "not-allowed";

    inputCodigo.readOnly = true;
    inputCodigo.style.backgroundColor = "#f1f5f9";
    inputCodigo.style.cursor = "not-allowed";

    inputDireccion.readOnly = true;
    inputDireccion.style.backgroundColor = "#f1f5f9";
    inputDireccion.style.cursor = "not-allowed";

    // 5. Transformar visualmente el botón de guardado a modo Actualización
    const btnGuardar = document.querySelector('#form-propiedad .btn-guardar');
    if (btnGuardar) {
        btnGuardar.innerText = "✏️ Actualizar Configuración Contractual";
        btnGuardar.style.backgroundColor = "#3b82f6";
    }

    document.getElementById('form-propiedad').scrollIntoView({ behavior: 'smooth' });
}
async function solicitarPDF(idVivienda, destinatario = "Inquilino") {
    mostrarCarga(`Generando estado de cuenta en PDF para el ${destinatario}...`);
    try {
        // ⚡ CONEXIÓN SENIOR: Se añade el parámetro &destinatario de forma dinámica en la URL de red
        const respuesta = await fetch(`${GOOGLE_API_URL}?accion=generarPDF&id_vivienda=${idVivienda}&destinatario=${destinatario}`);
        const resultado = await respuesta.json();
        
        if (resultado.estatus === "exito") {
            alert(`🎉 ¡Proceso Exitoso!\n\nEl Estado de Cuenta digital en PDF ha sido enviado automáticamente al correo correspondiente del ${destinatario}.`);
        } else {
            alert("No se encontraron cobros o movimientos pendientes para generar el reporte de este periodo.");
        }
    } catch (e) { 
        alert("🛑 Error de red crítico al solicitar la expedición de PDF a la Caja Inmobiliaria."); 
    } finally { 
        ocultarCarga(); 
    }
}


function convertirBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); 
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result); 
        reader.onerror = error => reject(error);
    });
}

function mostrarCarga(msg) { 
    txtModalCarga.innerText = msg; 
    modalCarga.classList.remove('hidden'); 
}

function ocultarCarga() { 
    modalCarga.classList.add('hidden'); 
}

const btnDashFrac = document.getElementById('dash-fraccionamientos');
const btnDashViv = document.getElementById('dash-viviendas');
const btnDashArr = document.getElementById('dash-arrendados');
const btnDashCob = document.getElementById('dash-cobros');
const btnDashInv = document.getElementById('dash-inventarios');
const btnDashRep = document.getElementById('dash-reportes');

if (btnDashFrac) { 
    btnDashFrac.addEventListener('click', () => { 
        const m = document.getElementById('btn-tab-fraccionamientos'); 
        if (m) m.click(); 
    }); 
}
if (btnDashViv) { 
    btnDashViv.addEventListener('click', () => { 
        const m = document.getElementById('btn-tab-viviendas'); 
        if (m) m.click(); 
    }); 
}
if (btnDashArr) { 
    btnDashArr.addEventListener('click', () => { 
        const m = document.getElementById('btn-tab-arrendados'); 
        if (m) m.click(); 
    }); 
}
if (btnDashCob) { 
    btnDashCob.addEventListener('click', () => { 
        const m = document.getElementById('btn-tab-cobros'); 
        if (m) m.click(); 
    }); 
}
if (btnDashInv) { 
    btnDashInv.addEventListener('click', () => { 
        const m = document.getElementById('btn-tab-inventarios'); 
        if (m) m.click(); 
    }); 
}
if (btnDashRep) { 
    btnDashRep.addEventListener('click', () => { 
        const m = document.getElementById('btn-tab-reportes'); 
        if (m) m.click(); 
    }); 
}
// ==========================================================================
// 6. LÓGICA DE AUDITORÍA MULTIMEDIA CON MEMORIA INTERMEDIA INTEGRADA
// ==========================================================================
const inpFotoInventario = document.getElementById('inp-foto-inventario');
const contenedorAuditoria = document.getElementById('contenedor-auditoria-local');
const txtContadorFotosInv = document.getElementById('txt-contador-fotos-inventario');
const formInventario = document.getElementById('form-inventario');

let listaFichasInventarioConsolidadas = [];
if (inpFotoInventario) {
    inpFotoInventario.addEventListener('change', (e) => {
        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) return;
        
        const archivoFisico = fileList[0];
        const campoObservacion = document.getElementById('inp-observacion-inventario').value.trim();
        
        if (!campoObservacion) {
            alert("🛑 Atención: Primero escribe la observación específica de este detalle en el cuadro de texto y luego carga la foto.");
            inpFotoInventario.value = "";
            return;
        }

        if (listaFichasInventarioConsolidadas.length === 0 && contenedorAuditoria.querySelector('.mensaje-vacio')) {
            contenedorAuditoria.innerHTML = "";
        }

        const urlTemporalMemoria = URL.createObjectURL(archivoFisico);
        const tarjetaAuditoria = document.createElement('div');
        tarjetaAuditoria.className = "tarjeta-casa-dinamica";
        tarjetaAuditoria.style.border = "2px dashed #3b82f6";
        tarjetaAuditoria.innerHTML = `
            <div style="text-align: center;" id="bloque-controles-auditoria">
                <p style="font-size: 11px; color: #3b82f6; font-weight: bold; margin-bottom: 8px;">🔬 DETALLE EN AUDITORÍA LOCAL</p>
                <img src="${urlTemporalMemoria}" style="width: 100%; max-height: 180px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;">
                <p style="font-size: 13px; color: #1e293b; font-weight: 600; margin-bottom: 4px;">📝 Obs: "${campoObservacion}"</p>
                <p style="font-size: 11px; color: #6b7280; word-break: break-all; margin-bottom: 12px;">${archivoFisico.name}</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button class="btn-casa-action blue" style="background-color: #10b981; color: white;" id="btn-aprobar-foto">✔️ Confirmar y Subir</button>
                    <button class="btn-casa-action gray" style="background-color: #ef4444; color: white;" id="btn-descartar-foto">❌ Descartar</button>
                </div>
            </div>
        `;
        contenedorAuditoria.insertBefore(tarjetaAuditoria, contenedorAuditoria.firstChild);
        const btnAprobar = tarjetaAuditoria.querySelector('#btn-aprobar-foto');
        const btnDescartar = tarjetaAuditoria.querySelector('#btn-descartar-foto');
        const bloqueControles = tarjetaAuditoria.querySelector('#bloque-controles-auditoria');

        btnDescartar.addEventListener('click', () => {
            tarjetaAuditoria.remove();
            URL.revokeObjectURL(urlTemporalMemoria);
            inpFotoInventario.value = "";
            if (contenedorAuditoria.children.length === 0) {
                contenedorAuditoria.innerHTML = `<div class="mensaje-vacio">Toma o selecciona una foto a la izquierda para auditar su calidad en este espacio.</div>`;
            }
        });
        btnAprobar.addEventListener('click', async () => {
            const idViviendaAsignada = document.getElementById('select-vivienda-inventario').value;
            if (!idViviendaAsignada) {
                alert("🛑 Error: Selecciona la vivienda antes de aprobar la evidencia.");
                return;
            }

            bloqueControles.innerHTML = `
                <p style="font-size: 11px; color: #f59e0b; font-weight: bold; margin-bottom: 8px;">⏳ SUBIENDO A DRIVE...</p>
                <div class="spinner" style="width:24px; height:24px; margin-bottom:10px;"></div>
                <p style="font-size: 11px; color: #6b7280;">Asegurando archivo binario aislado...</p>
            `;

            try {
                const resultadoBase64 = await convertirBase64(archivoFisico);
                const paqueteImagenUnica = {
                    accion: "subirFotoIndividualInventario", 
                    id_vivienda: idViviendaAsignada,
                    archivo: { nombre: archivoFisico.name, tipo: archivoFisico.type, base64: resultadoBase64.split(',')[1] }
                };

                const response = await fetch(GOOGLE_API_URL, { method: 'POST', body: JSON.stringify(paqueteImagenUnica) });
                const resultado = await response.json();

                if (resultado.estatus === "exito") {
                    const objetoFichaFase = { urlRealDrive: resultado.urlRealDrive, observacionEspecifica: campoObservacion };
                    listaFichasInventarioConsolidadas.push(objetoFichaFase);
                    txtContadorFotosInv.innerText = `${listaFichasInventarioConsolidadas.length} Listas`;

                    tarjetaAuditoria.style.border = "1px solid #dcfce7";
                    tarjetaAuditoria.innerHTML = `
                        <div style="background-color: #f0fdf4; padding: 12px; border-radius: 12px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="background-color: #d1fae5; color: #065f46; font-size: 10px; padding: 2px 6px; border-radius: 6px; font-weight: bold;">✔️ RESPALDADO EN DRIVE</span>
                                <button class="btn-casa-action gray" style="padding: 2px 6px; background-color: #f1f5f9; cursor: pointer; border:none;" id="btn-remover-subida">🗑️</button>
                            </div>
                            <img src="${urlTemporalMemoria}" style="width: 100%; max-height: 130px; object-fit: cover; border-radius: 8px; margin-bottom: 6px;">
                            <p style="font-size: 11px; color: #1e293b; text-align: left; font-weight:600; line-height: 14px;">Obs: "${campoObservacion}"</p>
                        </div>
                    `;

                    tarjetaAuditoria.querySelector('#btn-remover-subida').addEventListener('click', () => {
                        listaFichasInventarioConsolidadas = listaFichasInventarioConsolidadas.filter(item => item !== objetoFichaFase);
                        txtContadorFotosInv.innerText = `${listaFichasInventarioConsolidadas.length} Listas`;
                        tarjetaAuditoria.remove();
                        URL.revokeObjectURL(urlTemporalMemoria);
                        if (listaFichasInventarioConsolidadas.length === 0 && contenedorAuditoria.children.length === 0) {
                            contenedorAuditoria.innerHTML = `<div class="mensaje-vacio">Toma o selecciona una foto a la izquierda para auditar su calidad en este espacio.</div>`;
                        }
                    });

                    document.getElementById('inp-observacion-inventario').value = "";
                    inpFotoInventario.value = "";
                }
            } catch (errRed) { 
                alert("🛑 Fallo al subir esta foto por peso excesivo."); 
                tarjetaAuditoria.remove(); 
            }
        });
    });
}
async function inicializarModuloInventarios() {
    const selectFracInv = document.getElementById('select-frac-inventario');
    const selectVivInventario = document.getElementById('select-vivienda-inventario');
    if (!selectFracInv || !selectVivInventario) return;

    mostrarCarga("Cargando catálogo residencial relacional...");
    try {
        const respuesta = await fetch(`${GOOGLE_API_URL}?accion=leerFraccionamientos`);
        const fraccionamientos = await respuesta.json();
        
        selectFracInv.innerHTML = '<option value="">-- Selecciona Fraccionamiento --</option>';
        selectVivInventario.innerHTML = '<option value="">-- Primero elige un complejo --</option>';

        fraccionamientos.forEach(frac => {
            const opcion = document.createElement('option');
            opcion.value = frac.id_fraccionamiento;
            opcion.innerText = frac.nombre_fraccionamiento;
            selectFracInv.appendChild(opcion);
        });

        selectFracInv.replaceWith(selectFracInv.cloneNode(true));
        const nuevoSelectFracInv = document.getElementById('select-frac-inventario');
        
        nuevoSelectFracInv.addEventListener('change', async (e) => {
            const idFracSeleccionado = e.target.value;
            if (!idFracSeleccionado) {
                selectVivInventario.innerHTML = '<option value="">-- Primero elige un complejo --</option>';
                return;
            }
            mostrarCarga("Filtrando viviendas correspondientes...");
            try {
                const resViv = await fetch(`${GOOGLE_API_URL}?accion=leerViviendas&id_fraccionamiento=${idFracSeleccionado}`);
                const propiedades = await resViv.json();
                
                selectVivInventario.innerHTML = '<option value="">-- Selecciona Propiedad --</option>';
                propiedades.forEach(casa => {
                    const opt = document.createElement('option');
                    opt.value = casa.id_vivienda;
                    opt.innerText = `${casa.id_vivienda} - ${casa.nombre_propiedad}`;
                    selectVivInventario.appendChild(opt);
                });
            } catch (err) {
                selectVivInventario.innerHTML = '<option value="">⚠️ Error de carga</option>';
            } finally {
                ocultarCarga();
            }
        });

    } catch (error) { 
        selectFracInv.innerHTML = '<option value="">⚠️ Error</option>'; 
    } finally { 
        ocultarCarga(); 
    }
}
if (formInventario) {
    formInventario.addEventListener('submit', async (e) => {
        e.preventDefault();

        const selectFrac = document.getElementById('select-frac-inventario');
        const idFracAsignado = selectFrac.value;
        const nombreFracAsignado = selectFrac.options[selectFrac.selectedIndex].text;
        
        const idViviendaAsignada = document.getElementById('select-vivienda-inventario').value;
        const tipoEventoAsignado = document.getElementById('sel-tipo-inventario').value;

        if (listaFichasInventarioConsolidadas.length === 0) {
            alert("🛑 Detalle: No hay evidencias multimedia aprobadas y subidas a Drive en tu mesa de auditoría.");
            return;
        }

        mostrarCarga(`Escribiendo las ${listaFichasInventarioConsolidadas.length} filas del inventario en Google Sheets...`);
        let erroresContados = 0;

        const hoy = new Date();
        const anio = hoy.getFullYear();
        const mes = String(hoy.getMonth() + 1).padStart(2, '0');
        const dia = String(hoy.getDate()).padStart(2, '0');
        const fechaLocalAjustada = `${anio}-${mes}-${dia}`;

        for (let i = 0; i < listaFichasInventarioConsolidadas.length; i++) {
            const ficha = listaFichasInventarioConsolidadas[i];
            
            const paqueteFilaLigera = {
                accion: "guardarFilaInventarioIndividual",
                id_vivienda: idViviendaAsignada,
                tipo_evento: tipoEventoAsignado,
                observacion_general: ficha.observacionSpecifica,
                id_fraccionamiento: idFracAsignado,
                nombre_fraccionamiento: nombreFracAsignado,
                enlaces_evidencias: ficha.urlRealDrive,
                fecha_registro: fechaLocalAjustada
            };
            try {
                const response = await fetch(GOOGLE_API_URL, {
                    method: 'POST',
                    body: JSON.stringify(paqueteFilaLigera)
                });
                const resultado = await response.json();
                if (resultado.estatus !== "exito") erroresContados++;
            } catch (errLoop) {
                erroresContados++;
            }
        }

        ocultarCarga();

        if (erroresContados === 0) {
            alert(`🎉 ¡Inventario concluido con éxito!\n\nSe han registrado las ${listaFichasInventarioConsolidadas.length} filas correspondientes con fecha ${fechaLocalAjustada}.`);
            formInventario.reset();
            listaFichasInventarioConsolidadas = [];
            txtContadorFotosInv.innerText = "0 Listas";
            contenedorAuditoria.innerHTML = `<div class="mensaje-vacio">Toma o selecciona una foto a la izquierda para auditar su calidad en este espacio.</div>`;
            const btnInicio = document.getElementById('btn-tab-dashboard'); 
            if (btnInicio) btnInicio.click();
        } else {
            alert(`⚠️ El inventario se guardó parcialmente. Hubo problemas con ${erroresContados} filas.`);
        }
    });
}

// ==========================================================================
// 7. MÓDULO DE CONSULTA, PREVISUALIZACIÓN Y REPORTES EN PDF (2.6)
// ==========================================================================
let memoriaInternaReportesBuscados = []; 
async function inicializarModuloReportes() {
    const selectFracRep = document.getElementById('select-frac-reporte');
    const selectVivRep = document.getElementById('select-vivienda-reporte');
    if (!selectFracRep || !selectVivRep) return;

    mostrarCarga("Poblando filtros del visualizador...");
    try {
        const respuesta = await fetch(`${GOOGLE_API_URL}?accion=leerFraccionamientos`);
        const fraccionamientos = await respuesta.json();
        
        selectFracRep.innerHTML = '<option value="">-- Selecciona Fraccionamiento --</option>';
        selectVivRep.innerHTML = '<option value="">-- Todas las Viviendas --</option>';

        fraccionamientos.forEach(frac => {
            const opcion = document.createElement('option');
            opcion.value = frac.id_fraccionamiento;
            opcion.innerText = frac.nombre_fraccionamiento;
            selectFracRep.appendChild(opcion);
        });
        selectFracRep.replaceWith(selectFracRep.cloneNode(true));
        const nuevoSelectFracRep = document.getElementById('select-frac-reporte');
        
        nuevoSelectFracRep.addEventListener('change', async (e) => {
            const idFrac = e.target.value;
            if (!idFrac) {
                selectVivRep.innerHTML = '<option value="">-- Todas las Viviendas --</option>';
                return;
            }
            mostrarCarga("Actualizando catálogo secundario...");
            try {
                const resViv = await fetch(`${GOOGLE_API_URL}?accion=leerViviendas&id_fraccionamiento=${idFrac}`);
                const propiedades = await resViv.json();
                
                selectVivRep.innerHTML = '<option value="">-- Todas las Viviendas --</option>';
                propiedades.forEach(casa => {
                    const opt = document.createElement('option');
                    opt.value = casa.id_vivienda;
                    opt.innerText = `${casa.id_vivienda} - ${casa.nombre_propiedad}`;
                    selectVivRep.appendChild(opt);
                });
            } catch (err) {
                selectVivRep.innerHTML = '<option value="">⚠️ Error</option>';
            } finally {
                ocultarCarga();
            }
        });

    } catch (error) {
        console.error("Falla en la sincronización de selectores del reporte.");
    } finally {
        ocultarCarga();
    }
}

const btnEjecutarBusqueda = document.getElementById('btn-ejecutar-busqueda');
const contenedorResultadosReporte = document.getElementById('contenedor-resultados-reporte');
const txtContadorReportes = document.getElementById('txt-contador-reportes');
const btnExportarPdfInventario = document.getElementById('btn-exportar-pdf-inventario');

if (btnEjecutarBusqueda) {
    btnEjecutarBusqueda.addEventListener('click', async () => {
        const idFrac = document.getElementById('select-frac-reporte').value;
        const idViv = document.getElementById('select-vivienda-reporte').value;
        const fecha = document.getElementById('inp-fecha-reporte').value;

        if (!idFrac) {
            alert("🛑 Campo Requerido: Selecciona al menos un Fraccionamiento para iniciar la consulta.");
            return;
        }

        mostrarCarga("Escaneando el libro contable de Google Sheets...");
        try {
            const urlQuery = `${GOOGLE_API_URL}?accion=consultarInventarioFiltrado&id_fraccionamiento=${idFrac}&id_vivienda=${idViv}&fecha=${fecha}`;
            const response = await fetch(urlQuery);
            memoriaInternaReportesBuscados = await response.json();
            
            renderizarPrevisualizadorReportes(memoriaInternaReportesBuscados);
        } catch (errRed) {
            contenedorResultadosReporte.innerHTML = `<div class="mensaje-vacio" style="color: #ef4444;">Error de red al consultar las evidencias de auditoría.</div>`;
        } finally {
            ocultarCarga();
        }
    });
}
function renderizarPrevisualizadorReportes(lista) {
    contenedorResultadosReporte.innerHTML = "";
    txtContadorReportes.innerText = `${lista.length} Encontrados`;

    if (lista.length === 0) {
        contenedorResultadosReporte.innerHTML = `<div class="mensaje-vacio">No se encontraron evidencias que coincidan con los filtros aplicados.</div>`;
        btnExportarPdfInventario.disabled = true;
        return;
    }

    btnExportarPdfInventario.disabled = false; 

    lista.forEach(reg => {
        const tarjeta = document.createElement('div');
        tarjeta.className = "tarjeta-casa-dinamica";
        tarjeta.style.borderLeft = (reg.tipo_evento === "Entrega") ? "5px solid #10b981" : "5px solid #f97316";
        
        let srcImagen = reg.enlaces_evidencias || "https://unsplash.com";
        
        if (srcImagen.includes("://google.com") || srcImagen.includes("google.com")) {
            let matches = srcImagen.match(/\/file\/d\/([^\/]+)/) || srcImagen.match(/[?&]id=([^&]+)/);
            if (matches && matches[1]) {
                srcImagen = "https://googleusercontent.com" + matches[1];
            }
        }
        
        tarjeta.innerHTML = `
            <div style="display: flex; gap: 14px; align-items: start;">
                <img src="${srcImagen}" style="width: 110px; height: 110px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; background: #f8fafc;">
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 4px; ${reg.tipo_evento === 'Entrega' ? 'background:#d1fae5; color:#065f46;' : 'background:#ffedd5; color:#9a3412;'}">${reg.tipo_evento}</span>
                        <span style="font-size: 11px; color:#6b7280; font-weight:600;">📅 ${reg.fecha_registro}</span>
                    </div>
                    <p style="font-size: 12px; color: #1e293b; margin-bottom: 2px;"><strong>Casa:</strong> ${reg.id_vivienda} | <strong>ID:</strong> ${reg.id_inventario}</p>
                    <p style="font-size: 12px; color: #4b5563; font-style: italic; line-height:15px; margin-top:4px;">"${reg.observacion_general}"</p>
                </div>
            </div>
        `;
        contenedorResultadosReporte.appendChild(tarjeta);
    });
}

if (btnExportarPdfInventario) {
    btnExportarPdfInventario.addEventListener('click', async () => {
        if (memoriaInternaReportesBuscados.length === 0) return;
        mostrarCarga("Maquetando archivo de dos columnas y exportando a PDF...");
        const payload = { accion: "generarPDFInventario", registros: memoriaInternaReportesBuscados };
        try {
            const response = await fetch(GOOGLE_API_URL, { method: 'POST', body: JSON.stringify(payload) });
            const resultado = await response.json();
            if (resultado.estatus === "exito") {
                alert("🎉 ¡Reporte PDF generado con éxito!\n\nPresiona 'Aceptar' para abrir el documento técnico en una nueva pestaña listo para su descarga o impresión.");
                window.open(resultado.urlPdf, '_blank');
            } else { alert("⚠️ El servidor no pudo procesar la maqueta HTML."); }
        } catch (error) { alert("🛑 Error de conexión al generar el archivo digital."); } finally { ocultarCarga(); }
    });
}

// ==========================================================================
// 8. LOGICA OPERATIVA DEL MÓDULO 4: SERVICIOS Y COBROS (CORREGIDA Y OPTIMIZADA)
// ==========================================================================
async function inicializarModuloCobros() {
    const selectFracCob = document.getElementById('select-frac-cobros');
    const selectFiltroFracCob = document.getElementById('select-filtro-frac-cobros');
    const selectVivCob = document.getElementById('select-vivienda-cobros');
    
    if (!selectFracCob || !selectVivCob || !selectFiltroFracCob) return;

    mostrarCarga("Conectando con el catálogo financiero residencial...");
    try {
        const respuesta = await fetch(`${GOOGLE_API_URL}?accion=leerFraccionamientos`);
        const fraccionamientos = await respuesta.json();
        
        selectFracCob.innerHTML = '<option value="">-- Selecciona Fraccionamiento --</option>';
        selectFiltroFracCob.innerHTML = '<option value="">-- Filtrar Complejo Residencial --</option>';
        selectVivCob.innerHTML = '<option value="">-- Primero elige un complejo --</option>';

        fraccionamientos.forEach(frac => {
            const opt = `<option value="${frac.id_fraccionamiento}">${frac.nombre_fraccionamiento}</option>`;
            selectFracCob.innerHTML += opt;
            selectFiltroFracCob.innerHTML += opt;
        });

        // CONTROLADOR DE CAMBIO PARA EL FORMULARIO DE ALTA (IZQUIERDO)
        selectFracCob.onchange = async (e) => {
            const idFracSeleccionado = e.target.value;
            if (!idFracSeleccionado) {
                selectVivCob.innerHTML = '<option value="">-- Primero elige un complejo --</option>';
                return;
            }
            mostrarCarga("Filtrando catálogo de viviendas para cobro...");
            try {
                const resViv = await fetch(`${GOOGLE_API_URL}?accion=leerViviendas&id_fraccionamiento=${idFracSeleccionado}`);
                const propiedades = await resViv.json();
                
                memoriaViviendasActuales = propiedades;
                selectVivCob.innerHTML = '<option value="">-- Selecciona Propiedad --</option>';

                propiedades.forEach(casa => {
                    const opt = document.createElement('option');
                    opt.value = casa.id_vivienda;
                    opt.dataset.renta = casa.renta_base || 0;
                    opt.dataset.mantenimiento = casa.mantenimiento_base || 0;
                    opt.innerText = `${casa.id_vivienda} - ${casa.nombre_propiedad}`;
                    selectVivCob.appendChild(opt);
                });
            } catch (err) {
                selectVivCob.innerHTML = '<option value="">⚠️ Error al mapear viviendas</option>';
            } finally {
                ocultarCarga();
            }
        };
        // EVENTO DE ESCUCHA DIRECTO PARA LAS VARIABLES DEL FORMULARIO
        selectVivCob.onchange = (evt) => {
            const optSel = evt.target.options[evt.target.selectedIndex];
            const inputAgua = document.getElementById('inp-agua-cobros');
            const inputLuz = document.getElementById('inp-luz-cobros');
            const inputOtros = document.getElementById('inp-otros-cobros');
            const selEntidad = document.getElementById('sel-entidad-afectada');
            
            const casaContrato = memoriaViviendasActuales.find(c => c.id_vivienda === evt.target.value);
            
            if (optSel && casaContrato) {
                selEntidad.value = "Inquilino";
                
                function aplicarReglasInteligentesContractuales(entidad) {
                    const bloqueDeduccion = document.getElementById('bloque-deduccion-inquilino');

                    if (entidad === "Inquilino") {
                        if (bloqueDeduccion) bloqueDeduccion.classList.remove('hidden');

                        if (casaContrato.agua_responsable === "Inquilino") {
                            inputAgua.value = ""; inputAgua.readOnly = false; inputAgua.style.background = "#fff";
                        } else {
                            inputAgua.value = 0; inputAgua.readOnly = true; inputAgua.style.background = "#f1f5f9";
                        }
                        if (casaContrato.luz_responsable === "Inquilino") {
                            inputLuz.value = ""; inputLuz.readOnly = false; inputLuz.style.background = "#fff";
                        } else {
                            inputLuz.value = 0; inputLuz.readOnly = true; inputLuz.style.background = "#f1f5f9";
                        }
                        inputOtros.value = "";
                        inputOtros.readOnly = false;
                        inputOtros.style.background = "#fff";
                    } else {
                        if (bloqueDeduccion) bloqueDeduccion.classList.add('hidden');

                        if (casaContrato.agua_responsable === "Dueño") {
                            inputAgua.value = ""; inputAgua.readOnly = false; inputAgua.style.background = "#fff";
                        } else {
                            inputAgua.value = 0; inputAgua.readOnly = true; inputAgua.style.background = "#f1f5f9";
                        }
                        if (casaContrato.luz_responsable === "Dueño") {
                            inputLuz.value = ""; inputLuz.readOnly = false; inputLuz.style.background = "#fff";
                        } else {
                            inputLuz.value = 0; inputLuz.readOnly = true; inputLuz.style.background = "#f1f5f9";
                        }
                        inputOtros.value = "";
                        inputOtros.readOnly = false;
                        inputOtros.style.background = "#fff";
                    }
                }

                aplicarReglasInteligentesContractuales("Inquilino");
                selEntidad.onchange = (e) => aplicarReglasInteligentesContractuales(e.target.value);

            } else {
                if (inputAgua) { inputAgua.value = ""; inputAgua.readOnly = false; inputAgua.style.background = "#fff"; }
                if (inputLuz) { inputLuz.value = ""; inputLuz.readOnly = false; inputLuz.style.background = "#fff"; }
                if (inputOtros) inputOtros.value = "";
            }
        };
                // CONTROLADOR DE FILTRO PARA RENDERIZADO DUAL DE TARJETAS (DERECHO) - ESTRUCTURA BALANCEADA
        selectFiltroFracCob.onchange = async (e) => {
            const idFrac = e.target.value;
            const contenedor = document.getElementById('contenedor-tarjetas-cobros');
            const txtContador = document.getElementById('txt-contador-cobros');
            
            if (!idFrac) {
                contenedor.innerHTML = `<div class="mensaje-vacio">Selecciona un fraccionamiento arriba para visualizar su estado de cuenta contable unificado.</div>`;
                txtContador.innerText = "0 Pendientes";
                return;
            }
            
            mostrarCarga("Descargando cuentas de servicios pendientes...");
            try {
                const respuesta = await fetch(`${GOOGLE_API_URL}?accion=leerViviendas&id_fraccionamiento=${idFrac}`);
                const propiedades = await respuesta.json();
                
                contenedor.innerHTML = "";
                txtContador.innerText = `${propiedades.length} Propiedades`;
                
                if (propiedades.length === 0) {
                    contenedor.innerHTML = `<div class="mensaje-vacio">🎉 Ninguna vivienda registrada en este complejo residencial.</div>`;
                    return;
                }
                
                      propiedades.forEach(casa => {
                    const tarjeta = document.createElement('div');
                    tarjeta.className = "contenedor-casa-unificado";
                    tarjeta.style.gridColumn = "1 / -1";
                    tarjeta.style.backgroundColor = "#ffffff";
                    tarjeta.style.border = "1px solid #cbd5e1";
                    tarjeta.style.borderRadius = "16px";
                    tarjeta.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
                    tarjeta.style.marginBottom = "24px";
                    tarjeta.style.overflow = "hidden";
                    
                    const saldoInquilino = casa.saldo_inquilino || 0; 
                    const balancePropietario = casa.saldo_propietario || 0;

                    tarjeta.innerHTML = `
                        <!-- ENCABEZADO SÓLIDO DE DISTINCIÓN DE VIVIENDA -->
                        <div style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1; padding: 16px 20px;">
                            <div class="casa-header" style="display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="font-size: 18px; color: #0f172a; font-weight: 700; margin: 0;">🏡 ${casa.nombre_propiedad}</h3>
                                <span class="badge-status" style="background-color: #334155; color: #ffffff; font-size: 11px; padding: 4px 10px; border-radius: 6px; font-weight: bold;">Código: ${casa.id_vivienda}</span>
                            </div>
                            <p style="font-size: 13px; color: #475569; margin-top: 6px; margin-bottom: 0;">Arrendatario Activo: <strong style="color: #0f172a;">${casa.nombre_inquilino || 'Sin Arrendar'}</strong> | Día Pactado de Pago: <strong style="color: #0f172a;">${casa.dia_pago || 'N/A'}</strong></p>
                        </div>
                        
                        <!-- PANEL DUAL DE TARJETAS ESPEJO INTERNAS -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px; background-color: #fff;">
                            <!-- CUENTA INDEPENDIENTE DEL INQUILINO -->
                            <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; border-top: 4px solid #0284c7; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                                <div>
                                    <h4 style="font-size: 12px; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; font-weight: 700;">👤 Cuenta del Inquilino</h4>
                                    <div class="${saldoInquilino > 0 ? 'alert-box-pago' : 'success-box-pago'}" style="margin-bottom: 14px; padding: 10px 14px; border-radius: 8px;">
                                        <div>
                                            <p style="font-size: 10px; margin: 0; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${saldoInquilino > 0 ? 'Saldo Neto Pendiente' : 'Al Corriente'}</p>
                                            <p style="font-size: 18px; font-weight: 800; margin: 4px 0 0 0;">$${saldoInquilino} MXN</p>
                                        </div>
                                    </div>
                                </div>
                                
<div class="grid-botones-casa" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: auto;">
    <button onclick="solicitarPDF('${casa.id_vivienda}', 'Inquilino')" class="btn-casa-action blue" style="padding: 8px; font-size: 12px; font-weight: bold; border-radius: 6px;">📄 Estado de Cuenta</button>
    <button onclick="abrirModalLiquidacion('${casa.id_vivienda}', '${saldoInquilino}')" class="btn-casa-action" style="padding: 8px; font-size: 12px; font-weight: bold; border-radius: 6px; background-color: #10b981; color: white;" ${saldoInquilino === 0 ? 'disabled style="background-color: #cbd5e1; cursor: not-allowed;"' : ''}>💰 Registrar Pago</button>
</div>
                            </div>

                            <!-- BALANCE INDEPENDIENTE DEL PROPIETARIO (BOTONES SIMÉTRICOS) -->
                            <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; border-top: 4px solid #b45309; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                                <div>
                                    <h4 style="font-size: 12px; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; font-weight: 700;">💼 Balance del Propietario</h4>
                                    <div class="success-box-pago" style="background-color: #f0fdf4; border-color: #dcfce7; color: #166534; margin-bottom: 14px; padding: 10px 14px; border-radius: 8px;">
                                        <div>
                                            <p style="font-size: 10px; margin: 0; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Fondos Retenidos netos</p>
                                            <p style="font-size: 18px; font-weight: 800; margin: 4px 0 0 0;">$${balancePropietario} MXN</p>
                                        </div>
                                    </div>
                                </div>
                               
<div class="grid-botones-casa" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: auto;">
    <button onclick="solicitarPDF('${casa.id_vivienda}', 'Propietario')" class="btn-casa-action blue" style="padding: 8px; font-size: 12px; font-weight: bold; border-radius: 6px; background-color: #475569; color: white;">📄 Estado de Cuenta</button>
    <button onclick="abrirCortePropietario('${casa.id_vivienda}', '${balancePropietario}')" class="btn-casa-action" style="padding: 8px; font-size: 12px; font-weight: bold; border-radius: 6px; background-color: #1e293b; color: white;" ${balancePropietario === 0 ? 'disabled style="background-color: #cbd5e1; cursor: not-allowed;"' : ''}>🧾 Generar Corte Dueño</button>
</div>
                            </div>
                        </div>
                    `;
                    contenedor.appendChild(tarjeta);
                });

            } catch (error) {
                contenedor.innerHTML = `<div class="mensaje-vacio" style="color: #ef4444;">Error al conectar con la base de datos de cobros.</div>`;
            } finally {
                ocultarCarga();
            }
        };
    } catch (error) { 
        selectFracCob.innerHTML = '<option value="">⚠️ Error de sincronización</option>'; 
    } finally { 
        ocultarCarga(); 
    }
}


// FORMULARIO DE ENVÍO DE COBROS MANUALES ADICIONALES
const formCobros = document.getElementById('form-cobros');
if (formCobros) {
    formCobros.addEventListener('submit', async (e) => {

        e.preventDefault();
        
        const idFrac = document.getElementById('select-frac-cobros').value;
        const idViv = document.getElementById('select-vivienda-cobros').value;
        
        if (!idFrac || !idViv) {
            alert("🛑 Por favor, asigna el cobro a un complejo y vivienda válidos.");
            return;
        }
        
        const entidadAfectada = document.getElementById('sel-entidad-afectada').value;
        
        // CAPTURA DE VARIABLES MAESTRAS DE CONSUMOS VARIABLES PROTEGIDOS
        const valAgua = document.getElementById('inp-agua-cobros') ? document.getElementById('inp-agua-cobros').value : "";
        const valLuz = document.getElementById('inp-luz-cobros') ? document.getElementById('inp-luz-cobros').value : "";
        const montoOtrosInput = document.getElementById('inp-otros-cobros') ? Number(document.getElementById('inp-otros-cobros').value) : 0;
        
        const conceptoTxt = document.getElementById('inp-concepto-otros').value.trim();
        const periodoBase = document.getElementById('inp-periodo-cobros').value.trim();
        const periodoConsolidado = conceptoTxt ? `${periodoBase} (${conceptoTxt})` : periodoBase;

        // EXTRAER VALORES DEL NUEVO BLOQUE DE DEDUCCIÓN DEL INQUILINO
        const montoDeduccion = document.getElementById('inp-monto-deduccion') ? Number(document.getElementById('inp-monto-deduccion').value) : 0;
        const conceptoDeduccion = document.getElementById('inp-concepto-deduccion') ? document.getElementById('inp-concepto-deduccion').value.trim() : "";
        const chkAutorizado = document.getElementById('chk-autorizado-dueno') ? document.getElementById('chk-autorizado-dueno').checked : false;

        // VALIDACIÓN INTERNA ANTES DEL EMBARQUE DE DATOS
        if (entidadAfectada === "Inquilino" && montoDeduccion > 0) {
            if (!conceptoDeduccion) {
                alert("🛑 Campo Requerido: Especifica la descripción o motivo del gasto que se va a deducir de la renta.");
                return;
            }
            if (!chkAutorizado) {
                alert("🛑 Validación de Auditoría: Debes confirmar explícitamente que el gasto cuenta con la autorización del propietario.");
                return;
            }
            
            // DOBLE CONFIRMACIÓN OPERATIVA PARA BLINDAJE LEGAL
            const confirmacionMaestra = confirm(
                `🔬 RESUMEN DE AUDITORÍA CONTABLE:\n\n` +
                `¿Estás seguro de asentar una Deducción Autorizada por $${montoDeduccion} MXN a la cuenta del Inquilino para la vivienda [${idViv}]?\n\n` +
                `Esto impactará negativamente su deuda y cargará un gasto directo al balance del Propietario de forma simétrica.`
            );
            
            if (!confirmacionMaestra) {
                return; // Aborta el envío si el administrador cancela
            }
        }
        mostrarCarga("Escribiendo estado de cuenta mensual en Google Sheets...");

        const payload = {
            accion: "guardarNuevoCobroMensual",
            id_vivienda: idViv,
            mes_periodo: periodoConsolidado,
            monto_renta: 0, 
            monto_agua: valAgua === "" ? 0 : Number(valAgua),
            monto_luz: valLuz === "" ? 0 : Number(valLuz),
            monto_mantenimiento: 0, 
            monto_otros: montoOtrosInput,        
            fecha_limite: document.getElementById('inp-limite-cobros').value,
            entidad_afectada: entidadAfectada,
            
            // INYECCIÓN DE LAS NUEVAS VARIABLES DE DEDUCCIÓN DE RENTA
            monto_deduccion_inquilino: montoDeduccion,
            concepto_deduccion_inquilino: conceptoDeduccion,
            auditoria_autorizado_dueno: chkAutorizado ? "SÍ" : "NO"
        };

        try {
            const res = await fetch(GOOGLE_API_URL, { method: 'POST', body: JSON.stringify(payload) });
            const res_data = await res.json();
            
            if (res_data.estatus === "exito") {
                alert("🎉 Cuenta mensual y/o movimiento de deducción registrado con éxito en el Libro Mayor.");
                formCobros.reset();
                
                // Forzar refresco automático en caliente de la pantalla derecha de saldos
                document.getElementById('select-filtro-frac-cobros').value = idFrac;
                document.getElementById('select-filtro-frac-cobros').dispatchEvent(new Event('change'));
            } else {
                alert(`⚠️ Error devuelto por el servidor: ${res_data.mensaje || 'No se pudo procesar.'}`);
            }
        } catch (error) {
            alert("🛑 Error de red crítico al procesar el cobro inmobiliario.");
        } finally {
            ocultarCarga();
        }
    });
}
// ==========================================================================
// 9. MOTOR OPERATIVO DE CAJA PARCIAL: CHECKLIST REAL BASADO EN EL LIBRO MAYOR
// ==========================================================================
async function abrirModalLiquidacion(idVivienda, saldoPendiente) {
    await procesarVentanaCajaChecklist(idVivienda, "Inquilino", "👤 Registrar Pago Parcial / Total - Inquilino");
}

async function abrirCortePropietario(idVivienda, fondosNetos) {
    await procesarVentanaCajaChecklist(idVivienda, "Propietario", "💼 Generar Corte Parcial / Total - Propietario");
}

// FUNCIÓN INTEGRAL GENERADORA DEL SUB-MODAL DINÁMICO CON BARRIDO REAL DE CONCEPTOS
async function procesarVentanaCajaChecklist(idVivienda, entidadFiltro, tituloModal) {
    if (!idVivienda) return alert("🛑 Error de Referencia Contable.");

    mostrarCarga("Conectando con el Libro Mayor... Escaneando renglones pendientes.");
    try {
        // ⚡ CONEXIÓN SENIOR: Consumimos la nueva acción GET que extrae los asientos pendientes de la Sheet
        const urlFetchAsientos = `${GOOGLE_API_URL}?accion=obtenerAsientosPendientes&id_vivienda=${idVivienda}&entidad_afectada=${entidadFiltro}`;
        const resAsientos = await fetch(urlFetchAsientos);
        const asientosPendientes = await resAsientos.json();

        let htmlChecklist = "";
        
        // Barremos la matriz devuelta por el servidor para dibujar un checkbox independiente por fila real
        if (asientosPendientes && asientosPendientes.length > 0) {
            asientosPendientes.forEach(asiento => {
                const montoAjustado = Number(asiento.monto) || 0;
                // Formateamos visualmente los montos negativos o positivos para la mesa de caja
                const textoMonto = montoAjustado < 0 ? `-$${Math.abs(montoAjustado)}` : `$${montoAjustado}`;
                const estiloMonto = montoAjustado < 0 ? "color: #10b981; font-weight: bold;" : "color: #1f2937; font-weight: bold;";

                htmlChecklist += `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; background:#f8fafc; padding:10px 14px; border-radius:8px; border:1px solid #e2e8f0; hover:background:#f1f5f9;">
                        <div style="display:flex; gap:12px; align-items:center; flex:1;">
                            <input type="checkbox" class="chk-concepto-caja" value="${asiento.concepto}" style="width:18px; height:18px; cursor:pointer;" checked>
                            <label style="margin:0; text-transform:none; font-size:12px; color:#374151; cursor:pointer; font-weight:600; line-height:14px;">${asiento.concepto}</label>
                        </div>
                        <span style="font-size:13px; ${estiloMonto} margin-left:10px; white-space:nowrap;">${textoMonto} MXN</span>
                    </div>`;
            });
        }

        ocultarCarga();

        // INYECCIÓN DINÁMICA DEL CONTENEDOR EN EL DOM DEL NAVEGADOR
        const modalFlotante = document.createElement('div');
        modalFlotante.style = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(15,23,42,0.7); display:flex; align-items:center; justify-content:center; z-index:200; animation:fadeIn 0.2s;";
        modalFlotante.innerHTML = `
            <div style="background:white; padding:24px; border-radius:16px; max-width:450px; width:92%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border-top: 5px solid ${entidadFiltro === 'Inquilino' ? '#0284c7' : '#b45309'};">
                <h3 style="margin:0 0 6px 0; font-size:15px; color:#0f172a; font-weight:700;">${tituloModal}</h3>
                <p style="font-size:11px; color:#64748b; margin-bottom:14px; text-transform:none; line-height:14px;">Vivienda: [${idVivienda}]. Selecciona los conceptos específicos que deseas liquidar en esta sesión de caja:</p>
                <div id="lista-conceptos-caja" style="max-height:240px; overflow-y:auto; margin-bottom:18px; padding-right:4px;">
                    ${htmlChecklist || '<div class="mensaje-vacio" style="padding:20px; font-size:12px; color:#9ca3af;">🎉 No se localizaron asientos pendientes de cobro para esta cuenta.</div>'}
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <button id="btn-cancelar-caja" style="padding:10px; background:#f1f5f9; color:#475569; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px;">❌ Cancelar</button>
                    <button id="btn-confirmar-caja" style="padding:10px; background:#10b981; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px;" ${!htmlChecklist ? 'disabled style="background-color:#cbd5e1; cursor:not-allowed; opacity:0.6;"' : ''}>✔️ Aplicar Caja</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalFlotante);

        // MANEJO DE EVENTOS INTERNOS DEL POPUP
        modalFlotante.querySelector('#btn-cancelar-caja').onclick = () => modalFlotante.remove();
        
        modalFlotante.querySelector('#btn-confirmar-caja').onclick = async () => {
            // Recolectamos de forma quirúrgica los nombres exactos de los renglones que fueron marcados
            const seleccionados = Array.from(modalFlotante.querySelectorAll('.chk-concepto-caja:checked')).map(cb => cb.value);
            if (seleccionados.length === 0) return alert("🛑 Operación Cancelada: Debes seleccionar al menos un renglón contable de la lista para procesar un abono.");

            modalFlotante.remove();
            mostrarCarga("Consolidando caja general... Escribiendo asientos de liquidación en lote.");

            const payload = {
                accion: entidadFiltro === "Inquilino" ? "liquidarCobrosPendientes" : "liquidarCortePropietario",
                id_vivienda: idVivienda,
                conceptos: seleccionados // Enviamos la lista depurada para el procesamiento de code.gs
            };

            const response = await fetch(GOOGLE_API_URL, { method: 'POST', body: JSON.stringify(payload) });
            const resultado = await response.json();

            if (resultado.estatus === "exito") {
                alert("🎉 Comprobante de Caja Asentado:\n\nLos conceptos seleccionados se han conciliado como 'Pagado' exitosamente en el Libro Mayor.");
                // Forzamos el refresco automático de las tarjetas espejo para reflejar los nuevos saldos disminuidos
                const selectorFiltro = document.getElementById('select-filtro-frac-cobros');
                if (selectorFiltro && selectorFiltro.value) selectorFiltro.dispatchEvent(new Event('change'));
            } else {
                alert("⚠️ Servidor falló al procesar: " + resultado.mensaje);
            }
            ocultarCarga();
        };

            // FORZAMOS EL CIERRE SINTÁCTICO CORRECTO DE LA FUNCIÓN DE CAJA AQUÍ:
    } catch (errCaja) {
        alert("🛑 Error de sincronización al conectar con el servidor de Caja Inmobiliaria.");
        ocultarCarga();
    }
} // <-- AQUÍ SE CIERRA CORRECTAMENTE 'procesarVentanaCajaChecklist'

// ==========================================================================
// 10. LÓGICA OPERATIVA DEL MÓDULO 3: DIRECTORIO DE INQUILINOS Y CONTRATOS
// ==========================================================================
async function cargarInquilinosLegales() {
    const contenedor = document.getElementById('contenedor-tarjetas-arrendados');
    const txtContador = document.getElementById('txt-contador-arrendados');
    if (!contenedor || !txtContador) return;

    mostrarCarga("Descargando expedientes y vigencias de contratos...");
    try {
        const res = await fetch(`${GOOGLE_API_URL}?accion=leerTablaArrendados`);
        const datos = await res.json();
        
        contenedor.innerHTML = "";
        txtContador.innerText = `${datos.length} Contratos`;
        
        if (datos.length === 0) {
            contenedor.innerHTML = `<div class="mensaje-vacio">👤 No hay contratos de arrendamiento registrados en la base de datos.</div>`;
            return;
        }

                      datos.forEach(inquilino => {
            const tarjeta = document.createElement('div');
            tarjeta.className = "tarjeta-casa-dinamica";
            tarjeta.style.borderTop = "4px solid #a855f7"; // Distintivo morado del módulo
            
            tarjeta.innerHTML = `
                <div>
                    <div class="casa-header" style="margin-bottom: 8px;">
                        <h3 style="font-size: 16px; color: #0f172a; font-weight: 700;">👤 ${inquilino.nombre_inquilino}</h3>
                        <span class="badge-status" style="background-color: #f3e8ff; color: #6b21a8;">ID: ${inquilino.id_arrendado}</span>
                    </div>
                    <p style="font-size: 11px; color: #9ca3af; margin-bottom: 12px;">🏠 Vivienda Asignada: <strong style="color: #4b5563;">${inquilino.id_vivienda}</strong></p>
                    
                    <div class="casa-info" style="display: flex; flex-direction: column; gap: 6px; background: #fafafa; padding: 10px; border-radius: 8px; border: 1px solid #f3f4f6;">
                        <p style="font-size: 12px;"><strong>📞 Teléfono:</strong> ${inquilino.telefono || 'N/A'}</p>
                        <p style="font-size: 12px;"><strong>✉️ Correo:</strong> ${inquilino.correo || 'N/A'}</p>
                        <p style="font-size: 12px;"><strong>📅 Día de Pago:</strong> Casa pactada los días ${inquilino.dia_pago || 'N/A'}</p>
                        <p style="font-size: 11px; color: #6b7280; margin-top: 4px; border-top: 1px dashed #e5e7eb; padding-top: 4px;">
                            ⏳ Contrato: ${inquilino.fecha_inicio_contrato} al ${inquilino.fecha_fin_contrato || 'Vigente'}
                        </p>
                    </div>
                </div>
                <div class="grid-botones-casa" style="margin-top: 8px;">
                    <a href="https://wa.me${inquilino.telefono.replace(/[^0-9]/g, '')}" target="_blank" class="btn-casa-action gray" style="text-decoration: none; display: flex; align-items: center; justify-content: center; background: #e0f2fe; color: #0369a1;">💬 WhatsApp</a>
                    <button onclick="redirigirCobranzaInquilino('${inquilino.id_vivienda}')" class="btn-casa-action blue" style="background-color: #a855f7;">💰 Ver Estado</button>
                </div>
            `;
            contenedor.appendChild(tarjeta);
        });


    } catch (e) {
        contenedor.innerHTML = `<div class="mensaje-vacio" style="color: #ef4444;">Error al conectar con la base de datos de Arrendados.</div>`;
    } finally {
        ocultarCarga();
    }
}

// FUNCIÓN INTERACTIVA DE ENLACE DE MÓDULOS DE ALTA VELOCIDAD
function redirigirCobranzaInquilino(idVivienda) {
    const botonCobros = document.getElementById('btn-tab-cobros');
    if (botonCobros) {
        botonCobros.click(); // Salta de forma automatizada al panel de cobros
        alert(`🔍 Módulo Financiero: Se ha abierto el panel contable. Por favor, selecciona el fraccionamiento de la vivienda [${idVivienda}] para auditar sus cuentas.`);
    }
}

// ==========================================================================
// FIN DEL ARCHIVO MAESTRO OPERATIVO FRONTEND: app.js
// InmoScript Inmobiliaria - Ecosistema de balances espejos 100% Granular
// ==========================================================================
