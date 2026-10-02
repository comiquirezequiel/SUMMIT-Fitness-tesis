package com.summit.backend.config;

import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Filtro de control de tasa (Rate Limiting) por IP.
 * Protege endpoints críticos contra ataques de fuerza bruta y saturación.
 *
 * Límites configurados:
 * - Login: máximo 5 peticiones por minuto por IP
 * - Check-in: máximo 10 peticiones por minuto por IP
 * - General: máximo 120 peticiones por minuto por IP
 * Cada categoría cuenta por separado: navegar el panel no bloquea el login.
 *
 * Si se excede el límite, responde HTTP 429 Too Many Requests.
 */
@Component
@Order(1)
public class RateLimitingFilter implements Filter {

    // Timestamps de peticiones por IP y categoría ("ip|login", "ip|checkin", "ip|general"), del más viejo al más nuevo
    private final ConcurrentHashMap<String, Deque<Long>> requestTimestamps = new ConcurrentHashMap<>();

    // Límites por minuto (cada categoría tiene su propio contador)
    private static final int MAX_REQUESTS_PER_MINUTE = 120;
    private static final int LOGIN_MAX_REQUESTS_PER_MINUTE = 5;
    private static final int CHECKIN_MAX_REQUESTS_PER_MINUTE = 10;

    // Ventana de tiempo en milisegundos (1 minuto)
    private static final long WINDOW_MS = 60_000L;

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse,
                         FilterChain chain) throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) servletRequest;
        HttpServletResponse response = (HttpServletResponse) servletResponse;

        // Las consultas previas de CORS (OPTIONS) las manda el navegador solo: no cuentan para el límite
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(request);
        String uri = request.getRequestURI();

        // Determinar el límite según el endpoint
        int maxRequests;
        String categoria;
        if (uri.contains("/api/auth/login")) {
            maxRequests = LOGIN_MAX_REQUESTS_PER_MINUTE;
            categoria = "login";
        } else if (uri.contains("/api/asistencia/checkin")) {
            maxRequests = CHECKIN_MAX_REQUESTS_PER_MINUTE;
            categoria = "checkin";
        } else {
            maxRequests = MAX_REQUESTS_PER_MINUTE;
            categoria = "general";
        }

        // Obtener o crear la cola de timestamps para esta IP en esta categoría
        Deque<Long> timestamps = requestTimestamps.computeIfAbsent(clientIp + "|" + categoria,
                k -> new ArrayDeque<>());

        // Limpiar, verificar y registrar en un solo paso: el panel manda varias peticiones a la vez
        // y, si se hace por separado, dos hilos pueden duplicar la lista y bloquear antes del límite
        boolean excedido;
        synchronized (timestamps) {
            long now = System.currentTimeMillis();
            descartarVencidos(timestamps, now);
            excedido = timestamps.size() >= maxRequests;
            if (!excedido) {
                timestamps.addLast(now);
            }
        }

        if (excedido) {
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                    "{\"error\": \"Demasiadas solicitudes. Intente de nuevo en un momento.\", \"codigo\": 429}"
            );
            return;
        }

        chain.doFilter(request, response);
    }

    /**
     * Quita del frente de la cola los timestamps que ya salieron de la ventana de 1 minuto.
     * Debe llamarse con la cola sincronizada.
     */
    private static void descartarVencidos(Deque<Long> timestamps, long now) {
        while (!timestamps.isEmpty() && now - timestamps.peekFirst() >= WINDOW_MS) {
            timestamps.pollFirst();
        }
    }

    /**
     * Obtiene la IP real del cliente, considerando proxies (X-Forwarded-For).
     */
    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    /**
     * Limpieza periódica del mapa cada 5 minutos.
     * Elimina las claves (IP y categoría) que no tuvieron peticiones en el último minuto.
     */
    @Scheduled(fixedRate = 300_000)
    public void cleanupStaleEntries() {
        long now = System.currentTimeMillis();
        requestTimestamps.entrySet().removeIf(entry -> {
            Deque<Long> timestamps = entry.getValue();
            synchronized (timestamps) {
                descartarVencidos(timestamps, now);
                return timestamps.isEmpty();
            }
        });
    }
}
