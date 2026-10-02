package com.summit.backend.config;

import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

/**
 * Filtro de control de tasa (Rate Limiting) por IP.
 * Protege endpoints críticos contra ataques de fuerza bruta y saturación.
 *
 * Límites configurados:
 * - Login: máximo 5 peticiones por minuto por IP
 * - Check-in: máximo 10 peticiones por minuto por IP
 * - General: máximo 30 peticiones por minuto por IP
 *
 * Si se excede el límite, responde HTTP 429 Too Many Requests.
 */
@Component
@Order(1)
public class RateLimitingFilter implements Filter {

    // Mapa de timestamps de peticiones por IP
    private final ConcurrentHashMap<String, List<Long>> requestTimestamps = new ConcurrentHashMap<>();

    // Límites por minuto
    private static final int MAX_REQUESTS_PER_MINUTE = 30;
    private static final int LOGIN_MAX_REQUESTS_PER_MINUTE = 5;
    private static final int CHECKIN_MAX_REQUESTS_PER_MINUTE = 10;

    // Ventana de tiempo en milisegundos (1 minuto)
    private static final long WINDOW_MS = 60_000L;

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse,
                         FilterChain chain) throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) servletRequest;
        HttpServletResponse response = (HttpServletResponse) servletResponse;

        String clientIp = getClientIp(request);
        String uri = request.getRequestURI();

        // Determinar el límite según el endpoint
        int maxRequests;
        if (uri.contains("/api/auth/login")) {
            maxRequests = LOGIN_MAX_REQUESTS_PER_MINUTE;
        } else if (uri.contains("/api/asistencia/checkin")) {
            maxRequests = CHECKIN_MAX_REQUESTS_PER_MINUTE;
        } else {
            maxRequests = MAX_REQUESTS_PER_MINUTE;
        }

        // Obtener o crear la lista de timestamps para esta IP
        List<Long> timestamps = requestTimestamps.computeIfAbsent(clientIp,
                k -> new CopyOnWriteArrayList<>());

        long now = System.currentTimeMillis();

        // Limpiar timestamps más antiguos que la ventana de 1 minuto
        List<Long> recentTimestamps = timestamps.stream()
                .filter(ts -> (now - ts) < WINDOW_MS)
                .collect(Collectors.toList());
        timestamps.clear();
        timestamps.addAll(recentTimestamps);

        // Verificar si se excede el límite
        if (timestamps.size() >= maxRequests) {
            response.setStatus(429);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                    "{\"error\": \"Demasiadas solicitudes. Intente de nuevo en un momento.\", \"codigo\": 429}"
            );
            return;
        }

        // Registrar esta petición y continuar
        timestamps.add(now);
        chain.doFilter(request, response);
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
     * Elimina IPs que no han hecho peticiones en los últimos 5 minutos.
     */
    @Scheduled(fixedRate = 300_000)
    public void cleanupStaleEntries() {
        long now = System.currentTimeMillis();
        requestTimestamps.entrySet().removeIf(entry -> {
            entry.getValue().removeIf(ts -> (now - ts) >= WINDOW_MS);
            return entry.getValue().isEmpty();
        });
    }
}
