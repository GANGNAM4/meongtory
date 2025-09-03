package com.my.backend.store.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.my.backend.global.security.user.UserDetailsImpl;
import com.my.backend.store.dto.*;
import com.my.backend.store.entity.TossPayment;
import com.my.backend.store.entity.TossPaymentStatus;
import com.my.backend.store.service.PaymentService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class PaymentController {

    private final ObjectMapper objectMapper;
    private final PaymentService paymentService;

    // 환경변수에서 토스페이먼츠 시크릿 키 주입
    @Value("${toss.payments.secret-key}")
    private String secretKey;

    /**
     * Basic Authorization 헤더 생성
     */
    private String getAuthorizationHeader() {
        // 시크릿 키 뒤에 ":" 반드시 포함해서 base64 인코딩
        String encoded = Base64.getEncoder().encodeToString((secretKey + ":").getBytes(StandardCharsets.UTF_8));
        return "Basic " + encoded;
    }

    /**
     * 결제 금액 임시 저장 (보안 검증용)
     */
    @PostMapping("/saveAmount")
    public ResponseEntity<?> saveAmount(
            HttpSession session,
            @RequestBody SaveAmountRequest request,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        if (userDetails == null) {
            log.warn("인증되지 않은 사용자의 결제 금액 저장 시도");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(PaymentErrorResponse.builder()
                            .code(401)
                            .message("로그인이 필요합니다.")
                            .build());
        }

        try {
            // 세션에 주문 ID와 금액 저장
            session.setAttribute(request.orderId(), request.amount().toString());
            return ResponseEntity.ok().body("Payment amount saved successfully");
        } catch (Exception e) {
            log.error("결제 금액 저장 실패: orderId={}, error={}", request.orderId(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(PaymentErrorResponse.builder()
                            .code(500)
                            .message("결제 금액 저장 중 오류가 발생했습니다.")
                            .build());
        }
    }

    /**
     * 결제 금액 검증
     */
    @PostMapping("/verifyAmount")
    public ResponseEntity<?> verifyAmount(HttpSession session, @RequestBody ConfirmPaymentRequest request) {

        try {
            // 세션에서 저장된 금액 조회
            String savedAmountStr = (String) session.getAttribute(request.orderId());
            if (savedAmountStr == null) {
                log.warn("저장된 결제 금액이 없습니다: orderId={}", request.orderId());
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(PaymentErrorResponse.builder()
                                .code(400)
                                .message("저장된 결제 금액이 없습니다.")
                                .build());
            }

            Long savedAmount = Long.valueOf(savedAmountStr);
            if (!savedAmount.equals(request.amount())) {
                log.warn("결제 금액이 일치하지 않습니다: saved={}, requested={}", savedAmount, request.amount());
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(PaymentErrorResponse.builder()
                                .code(400)
                                .message("결제 금액이 일치하지 않습니다.")
                                .build());
            }

            return ResponseEntity.ok().body("Amount verification successful");
        } catch (Exception e) {
            log.error("결제 금액 검증 실패: orderId={}, error={}", request.orderId(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(PaymentErrorResponse.builder()
                            .code(500)
                            .message("결제 금액 검증 중 오류가 발생했습니다.")
                            .build());
        }
    }

    /**
     * 결제 승인 (일반 상품 + 네이버 상품)
     */
    @PostMapping("/confirm")
    public ResponseEntity<?> confirmPayment(
            HttpSession session,
            @RequestBody ConfirmPaymentRequest request,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        if (userDetails == null) {
            log.warn("인증되지 않은 사용자의 결제 승인 시도: paymentKey={}", request.paymentKey());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(PaymentErrorResponse.builder()
                            .code(401)
                            .message("로그인이 필요합니다.")
                            .build());
        }

        try {
            // 1. 요청 데이터 검증
            if (request.paymentKey() == null || request.paymentKey().trim().isEmpty()) {
                throw new IllegalArgumentException("paymentKey가 비어있습니다.");
            }
            if (request.orderId() == null || request.orderId().trim().isEmpty()) {
                throw new IllegalArgumentException("orderId가 비어있습니다.");
            }
            if (request.amount() == null || request.amount() <= 0) {
                throw new IllegalArgumentException("amount가 유효하지 않습니다: " + request.amount());
            }

            // 2. 토스페이먼츠 결제 승인 API 호출
            HttpResponse<String> response = requestTossPaymentConfirm(request);

            if (response.statusCode() == 200) {
                // 3. 결제 성공 시 DB 저장
                try {
                    if (response.body() == null || response.body().trim().isEmpty()) {
                        throw new RuntimeException("토스페이먼츠 API 응답이 비어있습니다.");
                    }

                    TossPayment payment = paymentService.savePaymentInfo(request, response.body(), userDetails.getAccount());

                    // 4. 응답 데이터 생성
                    ConfirmPaymentResponse confirmResponse = createConfirmResponse(payment, response.body());

                    return ResponseEntity.ok(confirmResponse);
                } catch (Exception e) {
                    log.error("DB 저장 실패: orderId={}, error={}", request.orderId(), e.getMessage(), e);
                    log.error("스택 트레이스:", e);
                    // DB 저장 실패 시 결제 취소
                    requestPaymentCancel(request.paymentKey(), "결제 승인 후 DB 저장 실패");
                    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(PaymentErrorResponse.builder()
                                    .code(500)
                                    .message("결제 승인 후 DB 저장 중 오류가 발생하여 결제가 취소되었습니다.")
                                    .build());
                }
            } else {
                // 4. 토스페이먼츠 API 호출 실패
                log.error("토스페이먼츠 API 호출 실패: statusCode={}, body={}", response.statusCode(), response.body());
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(parseTossErrorResponse(response.body()));
            }
        } catch (Exception e) {
            log.error("결제 승인 처리 실패: orderId={}, error={}", request.orderId(), e.getMessage(), e);
            log.error("스택 트레이스:", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(PaymentErrorResponse.builder()
                            .code(500)
                            .message("결제 승인 처리 중 오류가 발생했습니다: " + e.getMessage())
                            .build());
        }
    }

    /**
     * 결제 취소
     */
    @PostMapping("/cancel")
    public ResponseEntity<?> cancelPayment(@RequestBody CancelPaymentRequest request) {
        try {
            // 1. 토스페이먼츠 결제 취소 API 호출
            HttpResponse<String> response = requestTossPaymentCancel(request);

            if (response.statusCode() == 200) {
                // 2. 결제 상태 업데이트
                paymentService.updatePaymentStatus(request.paymentKey(), TossPaymentStatus.CANCELED);

                return ResponseEntity.ok().body("Payment canceled successfully");
            } else {
                log.error("토스페이먼츠 취소 API 호출 실패: statusCode={}, body={}", response.statusCode(), response.body());
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(parseTossErrorResponse(response.body()));
            }
        } catch (Exception e) {
            log.error("결제 취소 처리 실패: paymentKey={}, error={}", request.paymentKey(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(PaymentErrorResponse.builder()
                            .code(500)
                            .message("결제 취소 처리 중 오류가 발생했습니다.")
                            .build());
        }
    }

    /**
     * 결제 정보 조회
     */
    @GetMapping("/payment/{orderId}")
    public ResponseEntity<?> getPaymentInfo(@PathVariable String orderId) {
        try {
            TossPayment payment = paymentService.getPaymentByOrderId(orderId);
            ConfirmPaymentResponse response = createConfirmResponse(payment, null);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("결제 정보 조회 실패: orderId={}, error={}", orderId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(PaymentErrorResponse.builder()
                            .code(404)
                            .message("결제 정보를 찾을 수 없습니다.")
                            .build());
        }
    }

    /**
     * 토스페이먼츠 결제 승인 API 호출
     */
    private HttpResponse<String> requestTossPaymentConfirm(ConfirmPaymentRequest request) throws IOException, InterruptedException {
        // 토스페이먼츠 결제 승인 API 요청 본문 생성
        JsonNode requestObj = objectMapper.createObjectNode()
                .put("orderId", request.orderId())
                .put("amount", request.amount())
                .put("paymentKey", request.paymentKey());

        String requestBody = objectMapper.writeValueAsString(requestObj);

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create("https://api.tosspayments.com/v1/payments/confirm"))
                .header("Authorization", getAuthorizationHeader())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        try {
            HttpResponse<String> response = HttpClient.newHttpClient().send(httpRequest, HttpResponse.BodyHandlers.ofString());
            log.info("토스페이먼츠 API 응답 상태: {}", response.statusCode());
            log.info("토스페이먼츠 API 응답 본문: {}", response.body());

            return response;
        } catch (Exception e) {
            log.error("토스페이먼츠 API 호출 실패: {}", e.getMessage(), e);
            throw new RuntimeException("토스페이먼츠 API 호출 중 오류 발생", e);
        }
    }

    /**
     * 토스페이먼츠 결제 취소 API 호출
     */
    private HttpResponse<String> requestTossPaymentCancel(CancelPaymentRequest request) throws IOException, InterruptedException {
        // 토스페이먼츠 결제 취소 API 요청 본문 생성
        JsonNode requestObj = objectMapper.createObjectNode()
                .put("cancelReason", request.cancelReason());

        if (request.cancelAmount() != null) {
            requestObj = ((com.fasterxml.jackson.databind.node.ObjectNode) requestObj)
                    .put("cancelAmount", request.cancelAmount());
        }

        String requestBody = objectMapper.writeValueAsString(requestObj);
        log.debug("토스페이먼츠 취소 API 요청 본문: {}", requestBody);

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create("https://api.tosspayments.com/v1/payments/" + request.paymentKey() + "/cancel"))
                .header("Authorization", getAuthorizationHeader())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        return HttpClient.newHttpClient().send(httpRequest, HttpResponse.BodyHandlers.ofString());
    }

    /**
     * 결제 취소 요청 (에러 처리용)
     */
    private void requestPaymentCancel(String paymentKey, String reason) {
        try {
            CancelPaymentRequest cancelRequest = new CancelPaymentRequest(paymentKey, reason, null);
            requestTossPaymentCancel(cancelRequest);
        } catch (Exception e) {
            log.error("결제 취소 실패: paymentKey={}, error={}", paymentKey, e.getMessage(), e);
        }
    }

    /**
     * 토스페이먼츠 에러 응답 파싱
     */
    private PaymentErrorResponse parseTossErrorResponse(String responseBody) {
        try {
            JsonNode errorNode = objectMapper.readTree(responseBody);
            return PaymentErrorResponse.builder()
                    .code(errorNode.has("code") ? 400 : 500)
                    .message(errorNode.has("message") ? errorNode.get("message").asText() : "알 수 없는 오류")
                    .errorCode(errorNode.has("code") ? errorNode.get("code").asText() : null)
                    .build();
        } catch (Exception e) {
            log.error("에러 응답 파싱 실패: responseBody={}, error={}", responseBody, e.getMessage(), e);
            return PaymentErrorResponse.builder()
                    .code(500)
                    .message("에러 응답 파싱 중 오류가 발생했습니다.")
                    .build();
        }
    }

    /**
     * 결제 승인 응답 생성
     */
    private ConfirmPaymentResponse createConfirmResponse(TossPayment payment, String tossResponseBody) {
        // LocalDateTime을 String으로 변환하기 위한 포매터
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

        return ConfirmPaymentResponse.builder()
                .paymentKey(payment.getPaymentKey())
                .orderId(payment.getOrder().getId().toString())
                .status(payment.getStatus().name())
                .method(payment.getPaymentMethod().getDisplayName())
                .requestedAt(payment.getRequestedAt() != null ? payment.getRequestedAt().format(formatter) : null)
                .approvedAt(payment.getApprovedAt() != null ? payment.getApprovedAt().format(formatter) : null)
                .totalAmount(payment.getTotalAmount())
                .build();
    }
}