package com.summit.service;

import com.summit.dto.EditarSocioDTO;
import com.summit.dto.NuevoSocioDTO;
import com.summit.dto.SocioListadoDTO;
import com.summit.model.entity.CertificadoMedico;
import com.summit.model.entity.Pago;
import com.summit.model.entity.Usuario;
import com.summit.model.enums.EstadoLegal;
import com.summit.model.enums.EstadoUsuario;
import com.summit.model.enums.Rol;
import com.summit.repository.UsuarioRepository;
import com.summit.repository.PagoRepository;
import com.summit.repository.CertificadoMedicoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.ArrayList;

@Service
public class UsuarioService {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private PagoRepository pagoRepository;

    @Autowired
    private CertificadoMedicoRepository certificadoRepository;


    @Transactional
    public Usuario registrarNuevoSocio(NuevoSocioDTO dto) throws Exception {
        // Validación básica para no duplicar DNIs
        if (usuarioRepository.findByDni(dto.getDni()).isPresent()) {
            throw new Exception("El DNI ya se encuentra registrado en el sistema.");
        }

        Usuario nuevoSocio = new Usuario();
        nuevoSocio.setDni(dto.getDni());
        nuevoSocio.setNombreCompleto(dto.getNombre() + " " + dto.getApellido());
        nuevoSocio.setEmail(dto.getEmail());
        
        // Contraseña por defecto (DNI). A futuro se encriptará con cifrado AES-256 o similar según tus RNF
        nuevoSocio.setPassword(dto.getDni()); 
        
        // Aplicamos el Control de Roles RBAC y Estado
        nuevoSocio.setRol(Rol.SOCIO); 
        nuevoSocio.setEstado(EstadoUsuario.PENDIENTE);
        nuevoSocio.setFechaRegistro(LocalDateTime.now());

        return usuarioRepository.save(nuevoSocio);

    }

    @Transactional(readOnly = true)
    public List<SocioListadoDTO> obtenerTodosLosSocios() {
        List<Usuario> usuarios = usuarioRepository.findAll();
        List<SocioListadoDTO> listaDtos = new ArrayList<>();

        for (Usuario u : usuarios) {
            SocioListadoDTO dto = new SocioListadoDTO();
            dto.setId(u.getId());
            dto.setNombreCompleto(u.getNombreCompleto());
            dto.setDni(u.getDni());
            dto.setEmail(u.getEmail());
            dto.setTelefono(u.getTelefono());
            dto.setEstado(u.getEstado().name());
            dto.setFechaRegistro(u.getFechaRegistro());

            // Cálculo Analítico Legal
            Optional<CertificadoMedico> cert = certificadoRepository.findTopByUsuarioIdOrderByFechaEmisionDesc(u.getId());
            boolean sinApto = cert.isEmpty() || 
                              cert.get().getEstadoLegal() != EstadoLegal.VIGENTE || 
                              cert.get().getFechaVencimiento().isBefore(LocalDate.now());
            dto.setAlertaMedico(sinApto);

            // Cálculo Analítico Financiero
            Optional<Pago> pago = pagoRepository.findTopByUsuarioIdOrderByFechaPagoDesc(u.getId());
            boolean sinPago = pago.isEmpty() || 
                              pago.get().getFechaPago().plusDays(30).isBefore(LocalDateTime.now());
            dto.setAlertaPago(sinPago);

            listaDtos.add(dto);
        }

        return listaDtos;
    }

    @Transactional
    public void eliminarSocio(Long id) throws Exception {
        Usuario socio = usuarioRepository.findById(id)
                .orElseThrow(() -> new Exception("Socio no encontrado en la base de datos."));
        
        // BAJA LÓGICA: En lugar de borrar la fila (lo cual rompe la integridad referencial), 
        // cambiamos su estado a INACTIVO.
        socio.setEstado(EstadoUsuario.INACTIVO);
        usuarioRepository.save(socio);
    }

    
    @Transactional
    public Usuario actualizarSocio(Long id, EditarSocioDTO dto) throws Exception {
        Usuario socio = usuarioRepository.findById(id)
                .orElseThrow(() -> new Exception("Socio no encontrado en la base de datos."));

        socio.setNombreCompleto(dto.getNombreCompleto());
        socio.setEmail(dto.getEmail());
        socio.setTelefono(dto.getTelefono());
        
        // Convertimos el texto enviado desde React al Enum correspondiente
        socio.setEstado(EstadoUsuario.valueOf(dto.getEstado().toUpperCase()));

        return usuarioRepository.save(socio);
    }

}