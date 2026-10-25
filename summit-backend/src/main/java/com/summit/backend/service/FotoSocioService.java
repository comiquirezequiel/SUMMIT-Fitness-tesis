package com.summit.backend.service;

import com.summit.backend.model.PerfilSocio;
import com.summit.backend.model.Rol;
import com.summit.backend.model.Usuario;
import com.summit.backend.repository.PerfilSocioRepository;
import com.summit.backend.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Foto del socio, para que recepción vea quién entra (PLAN-APP-SOCIOS.md, A4). La saca recepción con la cámara
 * de la PC o del celular; el socio la ve en su credencial, pero no la puede cambiar.
 *
 * <p>La imagen se revisa y se vuelve a codificar (ver Fotos) y queda en la carpeta summit.uploads.dir/fotos de la
 * PC del gimnasio, como los certificados.</p>
 */
@Service
@RequiredArgsConstructor
public class FotoSocioService {

    private final UsuarioRepository usuarioRepository;
    private final PerfilSocioRepository perfilSocioRepository;
    private final ArchivoService archivoService;

    /**
     * Guarda la foto del socio (JPG o PNG), reemplazando la anterior, y devuelve su versión.
     */
    public long guardar(Long idSocio, MultipartFile archivo) {
        Usuario socio = buscarSocio(idSocio);
        byte[] jpg = Fotos.normalizar(archivo);
        PerfilSocio perfil = perfilSocioRepository.findByUsuarioIdUsuario(idSocio)
                .orElseGet(() -> PerfilSocio.builder().usuario(socio).build());
        String anterior = perfil.getFotoUrl();
        perfil.setFotoUrl(archivoService.guardarContenido(jpg, "fotos", "socio-" + idSocio, ".jpg"));
        perfil.setFotoActualizada(LocalDateTime.now());
        perfilSocioRepository.save(perfil);
        // Recién con la nueva ya guardada se borra el archivo de la anterior
        if (anterior != null) {
            archivoService.eliminar(anterior);
        }
        return version(perfil);
    }

    /**
     * La foto del socio, o vacío si no tiene.
     */
    public Optional<ArchivoService.Archivo> cargar(Long idSocio) {
        return perfilSocioRepository.findByUsuarioIdUsuario(idSocio)
                .map(PerfilSocio::getFotoUrl)
                .map(archivoService::cargar);
    }

    /**
     * Quita la foto (por ejemplo, si el socio lo pide): se borra también el archivo.
     */
    public void eliminar(Long idSocio) {
        buscarSocio(idSocio);
        perfilSocioRepository.findByUsuarioIdUsuario(idSocio)
                .filter(perfil -> perfil.getFotoUrl() != null)
                .ifPresent(perfil -> {
                    String ruta = perfil.getFotoUrl();
                    perfil.setFotoUrl(null);
                    perfil.setFotoActualizada(null);
                    perfilSocioRepository.save(perfil);
                    archivoService.eliminar(ruta);
                });
    }

    /**
     * Versión de la foto de un usuario, o null si no tiene (el personal nunca tiene).
     */
    public Long version(Long idUsuario) {
        return perfilSocioRepository.findByUsuarioIdUsuario(idUsuario).map(FotoSocioService::version).orElse(null);
    }

    /**
     * Versiones de las fotos de varios usuarios en una sola consulta: idUsuario -> versión (sin los que no tienen).
     */
    public Map<Long, Long> versiones(Collection<Long> idsUsuario) {
        if (idsUsuario.isEmpty()) {
            return Map.of();
        }
        return perfilSocioRepository.fotosDe(idsUsuario).stream()
                .collect(Collectors.toMap(fila -> (Long) fila[0], fila -> Fotos.version((LocalDateTime) fila[1])));
    }

    /** Versión de la foto (ver Fotos.version), o null si el socio no tiene. */
    public static Long version(PerfilSocio perfil) {
        return perfil == null || perfil.getFotoUrl() == null ? null : Fotos.version(perfil.getFotoActualizada());
    }

    private Usuario buscarSocio(Long idSocio) {
        return usuarioRepository.findById(idSocio)
                .filter(u -> u.getRol() == Rol.SOCIO)
                .orElseThrow(() -> new IllegalArgumentException("Socio no encontrado con ID: " + idSocio));
    }
}
