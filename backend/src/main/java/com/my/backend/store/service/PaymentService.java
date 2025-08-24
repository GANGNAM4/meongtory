package com.my.backend.store.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.my.backend.account.entity.Account;
import com.my.backend.store.dto.ConfirmPaymentRequest;
import com.my.backend.store.dto.ConfirmPaymentResponse;
import com.my.backend.store.entity.Order;
import com.my.backend.store.entity.OrderStatus;
import com.my.backend.store.entity.TossPayment;
import com.my.backend.store.entity.TossPaymentMethod;
import com.my.backend.store.entity.TossPaymentStatus;
import com.my.backend.store.repository.OrderRepository;
import com.my.backend.store.repository.TossPaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final TossPaymentRepository tossPaymentRepository;
    private final OrderRepository orderRepository;
    private final OrderService orderService;
    private final ObjectMapper objectMapper;

    /**
     * 결제 정보를 DB에 저장
     */
    @Transactional
    public TossPayment savePaymentInfo(ConfirmPaymentRequest request, String tossResponseBody, Account account) {
        log.info("결제 정보 저장 시작: paymentKey={}, orderId={}", request.paymentKey(), request.orderId());
        log.info("응답 본문 길이: {}", tossResponseBody != null ? tossResponseBody.length() : "null");
        log.info("응답 본문: {}", tossResponseBody);
        
        JsonNode jsonNode;
        try {
            jsonNode = objectMapper.readTree(tossResponseBody);
            log.info("JSON 파싱 성공");
        } catch (Exception e) {
            log.error("JSON 파싱 실패: {}", e.getMessage(), e);
            throw new RuntimeException("토스페이먼츠 응답 파싱 실패", e);
        }

        // 주문 정보 조회 (일반 상품 + 네이버 상품)
        log.info("주문 정보 조회 시작: orderId={}", request.orderId());
        Order order;
        try {
            order = orderRepository.findByMerchantOrderId(request.orderId())
                    .orElseThrow(() -> new RuntimeException("주문을 찾을 수 없습니다. orderId: " + request.orderId()));
            log.info("주문 정보 조회 완료: orderId={}, merchantOrderId={}, isNaverProduct={}", 
                    order.getId(), order.getMerchantOrderId(), order.getNaverProduct() != null);
        } catch (Exception e) {
            log.error("주문 정보 조회 실패: {}", e.getMessage(), e);
            throw new RuntimeException("주문 정보 처리 실패", e);
        }
        
        // 주문의 소유자와 현재 사용자가 일치하는지 확인
        if (!order.getAccount().getId().equals(account.getId())) {
            throw new IllegalArgumentException("해당 주문에 대한 권한이 없습니다. orderId: " + request.orderId());
        }

        // 결제 수단 파싱
        String methodStr = jsonNode.get("method").asText();
        TossPaymentMethod paymentMethod = parsePaymentMethod(methodStr);

        // 결제 상태 파싱
        String statusStr = jsonNode.get("status").asText();
        TossPaymentStatus status = parsePaymentStatus(statusStr);

        // 시간 파싱
        LocalDateTime requestedAt = parseDateTime(jsonNode.get("requestedAt").asText());
        LocalDateTime approvedAt = null;
        if (jsonNode.has("approvedAt") && !jsonNode.get("approvedAt").isNull()) {
            approvedAt = parseDateTime(jsonNode.get("approvedAt").asText());
        }

        // 영수증 URL
        String receiptUrl = null;
        if (jsonNode.has("receipt") && !jsonNode.get("receipt").isNull()) {
            receiptUrl = jsonNode.get("receipt").get("url").asText();
        }

        // 체크아웃 URL
        String checkoutUrl = null;
        if (jsonNode.has("checkout") && !jsonNode.get("checkout").isNull()) {
            checkoutUrl = jsonNode.get("checkout").get("url").asText();
        }

        // 결제 정보 저장
        TossPayment payment = TossPayment.builder()
                .paymentKey(request.paymentKey())
                .tossOrderId(jsonNode.get("orderId").asText())
                .order(order)
                .totalAmount(jsonNode.get("totalAmount").asLong())
                .paymentMethod(paymentMethod)
                .status(status)
                .requestedAt(requestedAt)
                .approvedAt(approvedAt)
                .receiptUrl(receiptUrl)
                .checkoutUrl(checkoutUrl)
                .cardInfo(extractCardInfo(jsonNode))
                .virtualAccountInfo(extractVirtualAccountInfo(jsonNode))
                .transferInfo(extractTransferInfo(jsonNode))
                .metadata(extractMetadata(jsonNode))
                .build();

        log.info("결제 정보 저장 완료: paymentKey={}, orderId={}, status={}", 
                request.paymentKey(), request.orderId(), status);
        
        TossPayment savedPayment = tossPaymentRepository.save(payment);
        
        // 결제 성공 시 주문 상태 업데이트
        if (status == TossPaymentStatus.DONE) {
            // 현재 주문을 PAID로 업데이트
            order.setStatus(OrderStatus.PAID);
            order.setPaidAt(LocalDateTime.now());
            orderRepository.save(order);
            log.info("주문 상태 업데이트 완료: orderId={}, status=PAID", request.orderId());
            
            // 같은 사용자의 다른 CREATED 상태 주문들도 함께 PAID로 업데이트
            List<Order> relatedOrders = orderRepository.findByAccountAndStatusAndCreatedAtBetween(
                account, 
                OrderStatus.CREATED, 
                order.getCreatedAt().minusMinutes(5), // 5분 이내 생성된 주문들
                order.getCreatedAt().plusMinutes(5)
            );
            
            for (Order relatedOrder : relatedOrders) {
                if (!relatedOrder.getId().equals(order.getId())) {
                    relatedOrder.setStatus(OrderStatus.PAID);
                    relatedOrder.setPaidAt(LocalDateTime.now());
                    orderRepository.save(relatedOrder);
                    log.info("관련 주문 상태 업데이트 완료: orderId={}, status=PAID", relatedOrder.getMerchantOrderId());
                }
            }
            
            log.info("총 {}개의 주문이 PAID 상태로 업데이트되었습니다.", relatedOrders.size() + 1);
        }
        
        return savedPayment;
    }

    /**
     * 주문 ID로 결제 정보 조회
     */
    public TossPayment getPaymentByOrderId(String orderId) {
        log.info("결제 정보 조회: orderId={}", orderId);
        return tossPaymentRepository.findByOrder_MerchantOrderId(orderId)
                .orElseThrow(() -> new IllegalArgumentException("결제 정보를 찾을 수 없습니다. orderId: " + orderId));
    }

    /**
     * 결제 키로 결제 정보 조회
     */
    public TossPayment getPaymentByPaymentKey(String paymentKey) {
        log.info("결제 정보 조회: paymentKey={}", paymentKey);
        return tossPaymentRepository.findByPaymentKey(paymentKey)
                .orElseThrow(() -> new IllegalArgumentException("결제 정보를 찾을 수 없습니다. paymentKey: " + paymentKey));
    }

    /**
     * 결제 상태 업데이트
     */
    @Transactional
    public void updatePaymentStatus(String paymentKey, TossPaymentStatus status) {
        TossPayment payment = getPaymentByPaymentKey(paymentKey);
        payment.setStatus(status);
        
        if (status == TossPaymentStatus.FAILED) {
            payment.setFailedAt(LocalDateTime.now());
        }
        
        // 결제 취소 시 주문 상태도 함께 업데이트
        if (status == TossPaymentStatus.CANCELED || status == TossPaymentStatus.PARTIAL_CANCELED) {
            Order order = payment.getOrder();
            if (order != null) {
                orderService.updateOrderStatus(order.getId(), OrderStatus.CANCELED);
                log.info("결제 취소로 인한 주문 상태 업데이트: orderId={}, status=CANCELED", order.getId());
            }
        }
        
        log.info("결제 상태 업데이트: paymentKey={}, status={}", paymentKey, status);
    }

    /**
     * 결제 수단 파싱
     */
    private TossPaymentMethod parsePaymentMethod(String method) {
        return switch (method.toUpperCase()) {
            case "CARD" -> TossPaymentMethod.CARD;
            case "EASY_PAY", "간편결제" -> TossPaymentMethod.EASY_PAY;
            case "VIRTUAL_ACCOUNT", "가상계좌" -> TossPaymentMethod.VIRTUAL_ACCOUNT;
            case "TRANSFER", "계좌이체" -> TossPaymentMethod.TRANSFER;
            case "MOBILE", "휴대폰" -> TossPaymentMethod.MOBILE;
            case "GIFT_CERTIFICATE", "상품권" -> TossPaymentMethod.GIFT_CERTIFICATE;
            default -> throw new IllegalArgumentException("지원하지 않는 결제 수단입니다: " + method);
        };
    }

    /**
     * 결제 상태 파싱
     */
    private TossPaymentStatus parsePaymentStatus(String status) {
        return switch (status.toUpperCase()) {
            case "READY" -> TossPaymentStatus.READY;
            case "IN_PROGRESS" -> TossPaymentStatus.IN_PROGRESS;
            case "DONE" -> TossPaymentStatus.DONE;
            case "CANCELED" -> TossPaymentStatus.CANCELED;
            case "PARTIAL_CANCELED" -> TossPaymentStatus.PARTIAL_CANCELED;
            case "ABORTED" -> TossPaymentStatus.ABORTED;
            case "FAILED" -> TossPaymentStatus.FAILED;
            default -> throw new IllegalArgumentException("지원하지 않는 결제 상태입니다: " + status);
        };
    }

    /**
     * 날짜 시간 파싱
     */
    private LocalDateTime parseDateTime(String dateTimeStr) {
        // ISO 8601 형식 (예: 2022-06-08T15:40:09+09:00)
        String formatted = dateTimeStr.substring(0, 19); // 시간대 정보 제거
        return LocalDateTime.parse(formatted, DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"));
    }

    /**
     * 카드 정보 추출
     */
    private String extractCardInfo(JsonNode jsonNode) {
        if (jsonNode.has("card") && !jsonNode.get("card").isNull()) {
            try {
                return objectMapper.writeValueAsString(jsonNode.get("card"));
            } catch (Exception e) {
                log.warn("카드 정보 파싱 실패", e);
            }
        }
        return null;
    }

    /**
     * 가상계좌 정보 추출
     */
    private String extractVirtualAccountInfo(JsonNode jsonNode) {
        if (jsonNode.has("virtualAccount") && !jsonNode.get("virtualAccount").isNull()) {
            try {
                return objectMapper.writeValueAsString(jsonNode.get("virtualAccount"));
            } catch (Exception e) {
                log.warn("가상계좌 정보 파싱 실패", e);
            }
        }
        return null;
    }

    /**
     * 계좌이체 정보 추출
     */
    private String extractTransferInfo(JsonNode jsonNode) {
        if (jsonNode.has("transfer") && !jsonNode.get("transfer").isNull()) {
            try {
                return objectMapper.writeValueAsString(jsonNode.get("transfer"));
            } catch (Exception e) {
                log.warn("계좌이체 정보 파싱 실패", e);
            }
        }
        return null;
    }

    /**
     * 메타데이터 추출
     */
    private String extractMetadata(JsonNode jsonNode) {
        if (jsonNode.has("metadata") && !jsonNode.get("metadata").isNull()) {
            try {
                return objectMapper.writeValueAsString(jsonNode.get("metadata"));
            } catch (Exception e) {
                log.warn("메타데이터 파싱 실패", e);
            }
        }
        return null;
    }
}
