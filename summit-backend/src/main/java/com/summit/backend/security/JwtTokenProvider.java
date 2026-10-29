package com.summit.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import javax.crypto.SecretKey;
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

    private SecretKey signingKey;

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
     * Genera un token JWT firmado con el email y rol del usuario, que vence a los jwt.expiration milisegundos.
     */
    public String generateToken(String email, String rol) {
        Date now = new Date();
        return Jwts.builder()
                .subject(email)
                .claim("rol", rol)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + jwtExpiration))
                .signWith(signingKey, Jwts.SIG.HS512)
                .compact();
    }

    /**
     * Los datos del token (email en el subject y fecha de emisión), o null si el token está vencido, mal formado o
     * tiene la firma inválida.
     */
    public Claims leer(String token) {
        try {
            return Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token).getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
}
