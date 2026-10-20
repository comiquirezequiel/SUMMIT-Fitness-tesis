package com.summit.backend.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.security.Key;
import java.util.Base64;
import java.util.Date;

/**
 * Proveedor de tokens JWT.
 * Genera, firma y valida tokens de autenticación.
 */
@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expiration}")
    private long jwtExpiration;

    private Key signingKey;

    @PostConstruct
    public void init() {
        // La clave viene de afuera del repositorio (JWT_SECRET): si falta o es corta, se avisa al arrancar y no
        // recién en el primer login. HS512 exige una clave de 512 bits: con 48 caracteres o más alcanza.
        if (jwtSecret.strip().length() < 48) {
            throw new IllegalStateException("JWT_SECRET falta o es muy corta (mínimo 48 caracteres): "
                    + "definila en application-local.properties (ver README)");
        }
        byte[] keyBytes = Base64.getEncoder().encode(jwtSecret.getBytes());
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * Genera un token JWT firmado con el email y rol del usuario.
     */
    public String generateToken(String email, String rol) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpiration);

        return Jwts.builder()
                .setSubject(email)
                .claim("rol", rol)
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(signingKey, SignatureAlgorithm.HS512)
                .compact();
    }

    /**
     * Extrae el email (subject) del token.
     */
    public String getEmailFromToken(String token) {
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(signingKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
        return claims.getSubject();
    }

    /**
     * Extrae el rol del token.
     */
    public String getRolFromToken(String token) {
        Claims claims = Jwts.parserBuilder()
                .setSigningKey(signingKey)
                .build()
                .parseClaimsJws(token)
                .getBody();
        return claims.get("rol", String.class);
    }

    /**
     * Valida la integridad y vigencia del token.
     * Retorna false si el token está expirado, mal formado o con firma inválida.
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder()
                    .setSigningKey(signingKey)
                    .build()
                    .parseClaimsJws(token);
            return true;
        } catch (ExpiredJwtException ex) {
            // Token expirado
        } catch (MalformedJwtException ex) {
            // Token mal formado
        } catch (UnsupportedJwtException ex) {
            // Token no soportado
        } catch (IllegalArgumentException ex) {
            // Claims vacíos
        } catch (io.jsonwebtoken.security.SecurityException ex) {
            // Firma inválida
        }
        return false;
    }
}
