package com.summit.backend.arca;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;

/**
 * Lo mínimo para armar y leer los mensajes SOAP de ARCA sin generar clases desde el WSDL: son pocos métodos y así se
 * ve exactamente qué se manda. Los elementos se buscan por su nombre local (sin importar el prefijo del namespace).
 */
final class Xml {

    private Xml() {
    }

    /** Escapa un texto para ponerlo dentro de un elemento. */
    static String esc(String texto) {
        if (texto == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(texto.length());
        for (char c : texto.toCharArray()) {
            switch (c) {
                case '&' -> sb.append("&amp;");
                case '<' -> sb.append("&lt;");
                case '>' -> sb.append("&gt;");
                case '"' -> sb.append("&quot;");
                case '\'' -> sb.append("&apos;");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }

    /** Lee un XML sin permitir DTD ni entidades externas (la respuesta viene de afuera). */
    static Document leer(String xml) throws IOException {
        if (xml == null || xml.isBlank()) {
            throw new IOException("La respuesta llegó vacía");
        }
        try {
            DocumentBuilderFactory fabrica = DocumentBuilderFactory.newInstance();
            fabrica.setNamespaceAware(true);
            fabrica.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            fabrica.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            fabrica.setXIncludeAware(false);
            fabrica.setExpandEntityReferences(false);
            return fabrica.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
        } catch (ParserConfigurationException | SAXException e) {
            throw new IOException("La respuesta no es un XML válido: " + e.getMessage(), e);
        }
    }

    /** El primer elemento con ese nombre dentro de nodo (en cualquier nivel), o null. */
    static Element primero(Node nodo, String nombre) {
        NodeList lista = nodo instanceof Document d ? d.getElementsByTagNameNS("*", nombre)
                : ((Element) nodo).getElementsByTagNameNS("*", nombre);
        return lista.getLength() == 0 ? null : (Element) lista.item(0);
    }

    /** El texto del primer elemento con ese nombre dentro de nodo, sin espacios alrededor; null si no está o está vacío. */
    static String texto(Node nodo, String nombre) {
        Element elemento = primero(nodo, nombre);
        if (elemento == null) {
            return null;
        }
        String texto = elemento.getTextContent().trim();
        return texto.isEmpty() ? null : texto;
    }

    static List<Element> todos(Node nodo, String nombre) {
        NodeList lista = nodo instanceof Document d ? d.getElementsByTagNameNS("*", nombre)
                : ((Element) nodo).getElementsByTagNameNS("*", nombre);
        List<Element> elementos = new ArrayList<>(lista.getLength());
        for (int i = 0; i < lista.getLength(); i++) {
            elementos.add((Element) lista.item(i));
        }
        return elementos;
    }
}
