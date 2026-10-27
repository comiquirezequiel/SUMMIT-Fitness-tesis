package com.summit.backend.arca;

/**
 * ARCA respondió con un error, o falta algo de la configuración (el certificado). El mensaje es para mostrarle al
 * admin tal cual. Si es reintentable, puede andar más tarde sin cambiar nada (ARCA caído, un permiso que hay que
 * renovar).
 */
public class ArcaException extends Exception {

    private final String codigo;
    private final boolean reintentable;

    public ArcaException(String codigo, String mensaje, boolean reintentable) {
        super(mensaje);
        this.codigo = codigo;
        this.reintentable = reintentable;
    }

    public ArcaException(String codigo, String mensaje, boolean reintentable, Throwable causa) {
        super(mensaje, causa);
        this.codigo = codigo;
        this.reintentable = reintentable;
    }

    public String codigo() {
        return codigo;
    }

    public boolean reintentable() {
        return reintentable;
    }
}
