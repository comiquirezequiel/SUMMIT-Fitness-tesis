document.addEventListener('DOMContentLoaded', () => {
    const modeloPrincipal    = document.getElementById('modelo-interactivo');
    const partesModelo       = document.querySelectorAll('.parte-modelo');
    const contenedorDetalle  = document.getElementById('contenedor-detalle');
    const subMusculos        = document.querySelectorAll('.sub-musculo');
    const btnVolver          = document.getElementById('btn-volver');
    const columnaLista       = document.getElementById('columna-lista');
    const columnaVisual      = document.getElementById('columna-visual');
    const tituloPanel        = document.getElementById('titulo-panel');
    const textoMecanico      = document.getElementById('texto-mecanico');
    const instruccionInicial = document.getElementById('instruccion-inicial');
    const leyendaColores     = document.getElementById('leyenda-colores');
    const tooltip            = document.getElementById('tooltip-zona');
    const badgeZona          = document.getElementById('badge-zona-activa');
    const sheetHandle        = document.getElementById('sheet-handle');
    const btnChevron         = document.getElementById('btn-chevron');

    let animando          = false;
    let badgeTimeout      = null;
    let ultimoTituloVisto = '';

    // ──────────────────────────────────────────────
    // DATOS — cargados desde el script global
    // ──────────────────────────────────────────────
    const infoMecanicaData = MUSCULOS_DATA.musculos;
    const leyendasPorVista = MUSCULOS_DATA.leyendas;

    // ──────────────────────────────────────────────
    // HELPERS
    // ──────────────────────────────────────────────

    const esMobile = () => window.innerWidth <= 768;

    function mostrarBadge(titulo) {
        clearTimeout(badgeTimeout);
        badgeZona.textContent = `↩ ${titulo}`;
        badgeZona.classList.add('visible');
        badgeTimeout = setTimeout(() => {
            badgeZona.classList.remove('visible');
        }, 2500);
    }

    /** Construye la leyenda de regiones (dentro del panel de info) */
    function construirLeyenda(idVista) {
        const ids = leyendasPorVista[idVista];
        if (!ids) { leyendaColores.style.display = 'none'; return; }

        leyendaColores.innerHTML = '<div class="leyenda-titulo">Regiones</div>';
        ids.forEach(id => {
            const datos = infoMecanicaData[id];
            if (!datos) return;
            const item = document.createElement('div');
            item.className = 'leyenda-item';
            item.innerHTML = `<span class="leyenda-dot" style="background:${datos.color}"></span><span>${datos.titulo}</span>`;
            item.addEventListener('click', () => {
                const el = document.getElementById(id);
                if (el) {
                    el.dispatchEvent(new Event('click'));
                } else {
                    // Músculo sin path SVG (ej: serrato-anterior)
                    subMusculos.forEach(s => s.classList.remove('activo'));
                    tituloPanel.innerText = datos.titulo;
                    instruccionInicial.style.display = 'none';
                    textoMecanico.innerHTML = datos.mecanica;
                }
            });
            leyendaColores.appendChild(item);
        });
        leyendaColores.style.display = 'block';
    }

    // ── SHEET EXPAND / COLLAPSE (solo móvil) ──
    function expandirSheet() {
        columnaLista.classList.add('expandido');
    }

    function contraerSheet() {
        columnaLista.classList.remove('expandido');
    }

    // ──────────────────────────────────────────────
    // TOOLTIP FLOTANTE (solo desktop)
    // ──────────────────────────────────────────────
    partesModelo.forEach(parte => {
        const tituloZona = parte.getAttribute('data-titulo');
        if (!tituloZona) return;

        parte.addEventListener('mouseenter', () => {
            if (esMobile()) return;
            tooltip.textContent = tituloZona;
            tooltip.classList.add('visible');
        });

        parte.addEventListener('mousemove', (e) => {
            if (esMobile()) return;
            tooltip.style.left = (e.clientX + 16) + 'px';
            tooltip.style.top  = (e.clientY - 10) + 'px';
        });

        parte.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
        });
    });

    // ──────────────────────────────────────────────
    // 1. CLIC EN PARTE DEL MODELO GENERAL
    // ──────────────────────────────────────────────
    partesModelo.forEach(parte => {
        parte.addEventListener('click', () => {
            if (animando) return;

            const idDetalle     = parte.getAttribute('data-detalle');
            const tituloSeccion = parte.getAttribute('data-titulo');
            if (!idDetalle) return;

            animando = true;
            tooltip.classList.remove('visible');
            clearTimeout(badgeTimeout);
            badgeZona.classList.remove('visible');
            ultimoTituloVisto = tituloSeccion || 'Detalle Muscular';

            // Activar el SVG de detalle correcto
            document.querySelectorAll('.svg-detalle').forEach(svg => svg.classList.remove('activo'));
            const svgAMostrar = document.getElementById(idDetalle);
            if (svgAMostrar) svgAMostrar.classList.add('activo');

            // Ocultar modelo principal y esperar la transición
            modeloPrincipal.classList.add('oculto');

            modeloPrincipal.addEventListener('transitionend', () => {
                contenedorDetalle.classList.add('activo');
                btnVolver.classList.add('visible');
                columnaLista.classList.add('visible');

                tituloPanel.innerText = ultimoTituloVisto;
                instruccionInicial.style.display = 'flex';
                textoMecanico.innerHTML = '';

                // Construir leyenda de regiones (en el panel, debajo de la info)
                construirLeyenda(idDetalle);

                animando = false;
            }, { once: true });
        });
    });

    // ──────────────────────────────────────────────
    // 2. CLIC EN UN MÚSCULO DE COLOR
    // ──────────────────────────────────────────────
    subMusculos.forEach(sub => {
        sub.addEventListener('click', (e) => {
            e.stopPropagation();
            subMusculos.forEach(s => s.classList.remove('activo'));
            sub.classList.add('activo');

            const datos = infoMecanicaData[sub.id];
            if (datos) {
                tituloPanel.innerText = datos.titulo;
                instruccionInicial.style.display = 'none';
                textoMecanico.innerHTML = datos.mecanica;
            }
        });
    });

    // ──────────────────────────────────────────────
    // 3. CLIC EN "VOLVER"
    // ──────────────────────────────────────────────
    btnVolver.addEventListener('click', () => {
        if (animando) return;
        animando = true;

        contenedorDetalle.classList.remove('activo');
        btnVolver.classList.remove('visible');
        columnaLista.classList.remove('visible');
        subMusculos.forEach(s => s.classList.remove('activo'));

        setTimeout(() => {
            tituloPanel.innerText = '—';
            textoMecanico.innerHTML = '';
            instruccionInicial.style.display = 'flex';
            leyendaColores.style.display = 'none';
            leyendaColores.innerHTML = '';
            contraerSheet();
        }, 300);

        setTimeout(() => {
            document.querySelectorAll('.svg-detalle').forEach(svg => svg.classList.remove('activo'));
            modeloPrincipal.classList.remove('oculto');

            modeloPrincipal.addEventListener('transitionend', () => {
                if (ultimoTituloVisto) mostrarBadge(ultimoTituloVisto);
                animando = false;
            }, { once: true });
        }, 150);
    });

    // ──────────────────────────────────────────────
    // 4. HANDLE DEL SHEET (tap = expandir/colapsar)
    // ──────────────────────────────────────────────
    if (sheetHandle) {
        sheetHandle.addEventListener('click', () => {
            if (!esMobile()) return;
            if (columnaLista.classList.contains('expandido')) {
                contraerSheet();
            } else {
                expandirSheet();
            }
        });
    }

    // ──────────────────────────────────────────────
    // 5. SWIPE EN EL SHEET (móvil)
    // ──────────────────────────────────────────────
    let touchStartY  = 0;
    let touchOnHandle = false;

    columnaLista.addEventListener('touchstart', (e) => {
        touchStartY   = e.touches[0].clientY;
        touchOnHandle = sheetHandle && sheetHandle.contains(e.target);
    }, { passive: true });

    columnaLista.addEventListener('touchend', (e) => {
        if (!esMobile() || animando) return;
        const deltaY       = e.changedTouches[0].clientY - touchStartY;
        const estaExpandido = columnaLista.classList.contains('expandido');

        if (Math.abs(deltaY) < 20) return;

        if (estaExpandido) {
            if (deltaY > 60) contraerSheet();
        } else {
            if (deltaY < -60) {
                expandirSheet();
            } else if (deltaY > 60 && touchOnHandle) {
                btnVolver.click();
            }
        }
    }, { passive: true });
});
