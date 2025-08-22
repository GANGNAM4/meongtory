package com.my.backend.store.controller;

import com.my.backend.store.dto.CartOrderRequestDto;
import com.my.backend.store.dto.OrderRequestDto;
import com.my.backend.store.dto.OrderResponseDto;
import com.my.backend.store.dto.PaymentOrderRequest;
import com.my.backend.store.dto.NaverProductOrderRequest;
import com.my.backend.store.entity.OrderStatus;
import com.my.backend.store.service.OrderService;
import com.my.backend.global.security.user.UserDetailsImpl;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    // 단일 주문 생성
    @PostMapping
    public ResponseEntity<OrderResponseDto> createOrder(@Valid @RequestBody OrderRequestDto requestDto) {
        System.out.println("=== OrderController.createOrder ===");
        System.out.println("받은 요청 데이터: " + requestDto);
        System.out.println("AccountId: " + requestDto.getAccountId());
        System.out.println("ProductId: " + requestDto.getProductId());
        System.out.println("Quantity: " + requestDto.getQuantity());
        
        try {
            // 요청 데이터 검증
            if (requestDto.getAccountId() == null) {
                throw new IllegalArgumentException("AccountId는 필수입니다.");
            }
            if (requestDto.getProductId() == null) {
                throw new IllegalArgumentException("ProductId는 필수입니다.");
            }
            if (requestDto.getQuantity() <= 0) {
                throw new IllegalArgumentException("Quantity는 0보다 커야 합니다.");
            }
            
            OrderResponseDto responseDto = orderService.createOrder(requestDto);
            System.out.println("주문 생성 성공: " + responseDto.getId());
            return ResponseEntity.ok(responseDto);
        } catch (Exception e) {
            System.out.println("주문 생성 실패: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(null);
        }
    }

    // 결제용 주문 생성 (간단한 버전)
    @PostMapping("/payment")
    public ResponseEntity<?> createPaymentOrder(@RequestBody PaymentOrderRequest request) {
        try {
            // 간단한 주문 생성 로직
            return ResponseEntity.ok().body("Order created for payment");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Failed to create order: " + e.getMessage());
        }
    }

    // 네이버 상품 주문 생성
    @PostMapping("/naver-product")
    public ResponseEntity<OrderResponseDto> createNaverProductOrder(@RequestBody NaverProductOrderRequest request) {
        System.out.println("=== OrderController.createNaverProductOrder ===");
        System.out.println("받은 요청 데이터: " + request);
        System.out.println("AccountId: " + request.getAccountId());
        System.out.println("NaverProductId: " + request.getNaverProductId());
        System.out.println("Quantity: " + request.getQuantity());
        
        try {
            // 요청 데이터 검증
            if (request.getAccountId() == null) {
                throw new IllegalArgumentException("AccountId는 필수입니다.");
            }
            if (request.getNaverProductId() == null) {
                throw new IllegalArgumentException("NaverProductId는 필수입니다.");
            }
            if (request.getQuantity() <= 0) {
                throw new IllegalArgumentException("Quantity는 0보다 커야 합니다.");
            }
            
            OrderResponseDto responseDto = orderService.createNaverProductOrder(
                request.getAccountId(), 
                request.getNaverProductId(), 
                request.getQuantity()
            );
            System.out.println("네이버 상품 주문 생성 성공: " + responseDto.getId());
            return ResponseEntity.ok(responseDto);
        } catch (Exception e) {
            System.out.println("네이버 상품 주문 생성 실패: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(null);
        }
    }

    // 단일 주문 조회
    @GetMapping("/{id}")
    public ResponseEntity<OrderResponseDto> getOrder(@PathVariable Long id) {
        OrderResponseDto responseDto = orderService.getOrder(id);
        return ResponseEntity.ok(responseDto);
    }

    // 사용자의 전체 주문 조회
    @GetMapping
    public ResponseEntity<List<OrderResponseDto>> getAllOrders() {
        List<OrderResponseDto> list = orderService.getAllOrders();
        return ResponseEntity.ok(list);
    }

    // 특정 사용자의 주문 조회
    @GetMapping("/user/{accountId}")
    public ResponseEntity<List<OrderResponseDto>> getUserOrders(@PathVariable Long accountId) {
        try {
            // 현재 로그인한 사용자의 권한 확인
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
            
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            String userRole = userDetails.getAccount().getRole();
            Long currentUserId = userDetails.getAccount().getId();
            
            System.out.println("사용자별 주문 조회 요청 - 요청자: " + userDetails.getAccount().getEmail() + 
                             ", 요청된 accountId: " + accountId + ", 현재 사용자 ID: " + currentUserId);
            
            // 관리자이거나 본인의 주문만 조회 가능
            if (!"ADMIN".equals(userRole) && !currentUserId.equals(accountId)) {
                System.out.println("권한이 없습니다. 본인의 주문만 조회 가능합니다.");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            
            List<OrderResponseDto> userOrders = orderService.getUserOrders(accountId);
            System.out.println("사용자별 주문 조회 성공: " + userOrders.size() + "개 주문");
            return ResponseEntity.ok(userOrders);
        } catch (Exception e) {
            System.out.println("사용자별 주문 조회 실패: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // 장바구니 기반 전체 주문 생성
    @PostMapping("/bulk")
    public ResponseEntity<List<OrderResponseDto>> createOrdersFromCart(@Valid @RequestBody CartOrderRequestDto requestDto) {
        System.out.println("=== OrderController.createOrdersFromCart ===");
        System.out.println("받은 요청 데이터: " + requestDto);
        System.out.println("AccountId: " + requestDto.getAccountId());
        
        try {
            // 요청 데이터 검증
            if (requestDto.getAccountId() == null) {
                throw new IllegalArgumentException("AccountId는 필수입니다.");
            }
            
            List<OrderResponseDto> responseDtos = orderService.createOrdersFromCart(requestDto.getAccountId());
            System.out.println("Bulk 주문 생성 성공: " + responseDtos.size() + "개 주문");
            return ResponseEntity.ok(responseDtos);
        } catch (Exception e) {
            System.out.println("Bulk 주문 생성 실패: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(null);
        }
    }

    // 관리자용 모든 사용자의 주문 조회
    @GetMapping("/admin/all")
    public ResponseEntity<List<OrderResponseDto>> getAllOrdersForAdmin() {
        try {
            // 현재 로그인한 사용자의 권한 확인
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
            
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            String userRole = userDetails.getAccount().getRole();
            
            System.out.println("관리자 주문 조회 요청 - 사용자: " + userDetails.getAccount().getEmail() + ", 권한: " + userRole);
            
            if (!"ADMIN".equals(userRole)) {
                System.out.println("관리자 권한이 없습니다: " + userRole);
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            
            List<OrderResponseDto> allOrders = orderService.getAllOrders(); // 서비스에서 전체 조회
            System.out.println("관리자 주문 조회 성공: " + allOrders.size() + "개 주문");
            return ResponseEntity.ok(allOrders);
        } catch (Exception e) {
            System.out.println("관리자 주문 조회 실패: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // 주문 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOrder(@PathVariable Long id) {
        orderService.deleteOrder(id);
        return ResponseEntity.noContent().build();
    }

    // 주문 상태 변경 (관리자용)
    @PatchMapping("/{id}/status")
    public ResponseEntity<OrderResponseDto> updateOrderStatus(
            @PathVariable Long id,
            @RequestParam OrderStatus status) {
        OrderResponseDto updatedOrder = orderService.updateOrderStatus(id, status);
        return ResponseEntity.ok(updatedOrder);
    }

}
