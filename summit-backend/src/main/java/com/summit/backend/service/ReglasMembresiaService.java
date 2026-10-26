package com.summit.backend.service;

import com.summit.backend.model.ReglasMembresia;
import com.summit.backend.repository.ReglasMembresiaRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Reglas de las membresías: matrícula de inscripción y límites de los congelamientos.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReglasMembresiaService {

    private static final Long ID_REGLAS = 1L;

    // Con lo que arranca un gimnasio: sin matrícula, y congelamientos de 7 días o más, hasta 30 por año
    private static final int REINSCRIPCION_DIAS_POR_DEFECTO = 30;
    private static final int CONGELAMIENTO_MIN_POR_DEFECTO = 7;
    private static final int CONGELAMIENTO_MAX_POR_DEFECTO = 30;

    private static final BigDecimal MATRICULA_MAXIMA = new BigDecimal("10000000");

    private final ReglasMembresiaRepository repository;

    @PostConstruct
    public void initReglas() {
        if (!repository.existsById(ID_REGLAS)) {
            log.info("Creando las reglas de membresía por defecto...");
            repository.save(ReglasMembresia.builder()
                    .idReglas(ID_REGLAS)
                    .matriculaMonto(BigDecimal.ZERO)
                    .matriculaReinscripcionDias(REINSCRIPCION_DIAS_POR_DEFECTO)
                    .congelamientoMinDias(CONGELAMIENTO_MIN_POR_DEFECTO)
                    .congelamientoMaxDiasAnio(CONGELAMIENTO_MAX_POR_DEFECTO)
                    .build());
        }
    }

    public ReglasMembresia obtener() {
        return repository.findById(ID_REGLAS)
                .orElseThrow(() -> new IllegalStateException("No se encontraron las reglas de membresía"));
    }

    /**
     * Guarda lo que se edita en Membresías > Descuentos y reglas (la pantalla manda las reglas completas).
     */
    @Transactional
    public ReglasMembresia actualizar(ReglasMembresia cambios) {
        BigDecimal matricula = cambios.getMatriculaMonto() != null ? cambios.getMatriculaMonto() : BigDecimal.ZERO;
        if (matricula.signum() < 0 || matricula.compareTo(MATRICULA_MAXIMA) >= 0) {
            throw new IllegalArgumentException("El monto de la matrícula no es válido");
        }
        int reinscripcion = cambios.getMatriculaReinscripcionDias();
        if (reinscripcion < 0 || reinscripcion > 3650) {
            throw new IllegalArgumentException("Los días sin cuota para volver a cobrar la matrícula tienen que estar entre 0 y 3650");
        }
        int minimo = cambios.getCongelamientoMinDias();
        int maximo = cambios.getCongelamientoMaxDiasAnio();
        if (maximo < 0 || maximo > 365) {
            throw new IllegalArgumentException("El máximo de días congelados por año tiene que estar entre 0 y 365");
        }
        if (minimo < 1 || minimo > 365) {
            throw new IllegalArgumentException("El mínimo de días de un congelamiento tiene que estar entre 1 y 365");
        }
        if (maximo > 0 && minimo > maximo) {
            throw new IllegalArgumentException("El mínimo de días de un congelamiento no puede superar el máximo por año");
        }

        ReglasMembresia reglas = obtener();
        reglas.setMatriculaMonto(matricula.setScale(2, RoundingMode.HALF_UP));
        reglas.setMatriculaReinscripcionDias(reinscripcion);
        reglas.setCongelamientoMinDias(minimo);
        reglas.setCongelamientoMaxDiasAnio(maximo);
        return repository.save(reglas);
    }
}
