package com.summit.service;

import com.mercadopago.client.common.IdentificationRequest;
import com.mercadopago.client.payment.PaymentClient;
import com.mercadopago.client.payment.PaymentCreateRequest;
import com.mercadopago.client.payment.PaymentPayerRequest;
import com.mercadopago.resources.payment.Payment;
import com.summit.dto.PagoRequestDTO;
import com.summit.model.entity.Pago;
import com.summit.model.entity.Plan;
import com.summit.model.entity.Usuario;
import com.summit.model.enums.EstadoPago;
import com.summit.model.enums.EstadoUsuario;
import com.summit.model.enums.MetodoPago;
import com.summit.repository.PagoRepository;
import com.summit.repository.PlanRepository;
import com.summit.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PagoService {

    @Autowired
    private PagoRepository pagoRepository;
    @Autowired
    private UsuarioRepository usuarioRepository;
    @Autowired
    private PlanRepository planRepository;

    @Transactional
    public Pago procesarPagoTarjeta(PagoRequestDTO request) throws Exception {
        
        // 1. Buscamos al Socio y el Plan en nuestra Base de Datos
        Usuario usuario = usuarioRepository.findByDni(request.getDniSocio())
                .orElseThrow(() -> new Exception("Socio no encontrado"));
                
        Plan plan = planRepository.findById(request.getPlanId())
                .orElseThrow(() -> new Exception("Plan no encontrado"));

        // 2. Construimos la petición para Mercado Pago usando el Patrón Builder (SDK v3)
        PaymentClient client = new PaymentClient();
        
        PaymentCreateRequest createRequest = PaymentCreateRequest.builder()
                // CAMBIO DE SEGURIDAD: Leemos el precio desde MySQL, no del DTO del Frontend.
                .transactionAmount(plan.getPrecioBase())
                .token(request.getToken())
                .description("Pago de Plan: " + plan.getNombrePlan() + " - SUMMIT Fitness")
                .installments(request.getInstallments())
                .paymentMethodId(request.getPaymentMethodId())
                .issuerId(request.getIssuerId())
                .payer(PaymentPayerRequest.builder()
                        .email(request.getPayerEmail())
                        .identification(IdentificationRequest.builder()
                                .type(request.getPayerIdentificationType())
                                .number(request.getPayerIdentificationNumber())
                                .build())
                        .build())
                .build();

        // 3. Enviamos la petición a Mercado Pago
        Payment mpPayment = client.create(createRequest);

        // 4. Guardamos el resultado en NUESTRA base de datos (Historial y Dashboard)
        Pago pagoLocal = new Pago();
        pagoLocal.setUsuario(usuario);
        pagoLocal.setPlan(plan);
        // CAMBIO DE SEGURIDAD: Guardamos el monto real cobrado
        pagoLocal.setMontoAbonado(plan.getPrecioBase());
        pagoLocal.setMetodoPago(MetodoPago.MERCADO_PAGO);
        pagoLocal.setMpPaymentId(mpPayment.getId().toString()); // ¡Guardamos el ID de Mercado Pago!

        // Evaluamos qué nos respondió MP
        if ("approved".equals(mpPayment.getStatus())) {
            pagoLocal.setEstadoPago(EstadoPago.APROBADO);
        } else if ("in_process".equals(mpPayment.getStatus()) || "pending".equals(mpPayment.getStatus())) {
            pagoLocal.setEstadoPago(EstadoPago.PENDIENTE);
        } else {
            pagoLocal.setEstadoPago(EstadoPago.RECHAZADO);
        }

        if (usuario.getEstado() == EstadoUsuario.PENDIENTE) {
            usuario.setEstado(EstadoUsuario.ACTIVO); usuarioRepository.save(usuario); }

        return pagoRepository.save(pagoLocal);
    }
}