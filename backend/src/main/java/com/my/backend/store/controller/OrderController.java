package com.my.backend.store.controller;

import com.my.backend.store.dto.CartOrderRequestDto;
import com.my.backend.store.dto.OrderRequestDto;
import com.my.backend.store.dto.OrderResponseDto;
import com.my.backend.store.dto.PaymentOrderRequest;
import com.my.backend.store.dto.NaverProductOrderRequest;
import com.my.backend.store.dto.BulkAllOrderRequestDto;
import com.my.backend.store.dto.BulkAllOrderResponseDto;
import com.my.backend.global.dto.ResponseDto;
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
    public ResponseEntity<ResponseDto<List<OrderResponseDto>>> getAllOrders() {
        List<OrderResponseDto> list = orderService.getAllOrders();
        return ResponseEntity.ok(ResponseDto.success(list));
    }

    // 특정 사용자의 주문 조회
    @GetMapping("/user/{accountId}")
    public ResponseEntity<ResponseDto<List<OrderResponseDto>>> getUserOrders(@PathVariable Long accountId) {
        try {
            // 현재 로그인한 사용자의 권한 확인
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
            
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            String userRole = userDetails.getAccount().getRole();
            Long currentUserId = userDetails.getAccount().getId();
            
            // 관리자이거나 본인의 주문만 조회 가능
            if (!"ADMIN".equals(userRole) && !currentUserId.equals(accountId)) {
                System.out.println("권한이 없습니다. 본인의 주문만 조회 가능합니다.");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            
            List<OrderResponseDto> userOrders = orderService.getUserOrders(accountId);
            return ResponseEntity.ok(ResponseDto.success(userOrders));
        } catch (Exception e) {
            System.out.println("사용자별 주문 조회 실패: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // 장바구니 기반 전체 주문 생성
    @PostMapping("/bulk")
    public ResponseEntity<List<OrderResponseDto>> createOrdersFromCart(@Valid @RequestBody CartOrderRequestDto requestDto) {
        try {
            // 요청 데이터 검증
            if (requestDto.getAccountId() == null) {
                throw new IllegalArgumentException("AccountId는 필수입니다.");
            }
            
            List<OrderResponseDto> responseDtos = orderService.createOrdersFromCart(requestDto.getAccountId());
            return ResponseEntity.ok(responseDtos);
        } catch (Exception e) {
            System.out.println("Bulk 주문 생성 실패: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(null);
        }
    }

    // 전체 상품 일괄 주문 생성 (일반 상품 + 네이버 상품)
    @PostMapping("/bulk-all")
    public ResponseEntity<BulkAllOrderResponseDto> createBulkAllOrders(@Valid @RequestBody BulkAllOrderRequestDto requestDto) {
        try {
            // 요청 데이터 검증
            if (requestDto.getAccountId() == null) {
                throw new IllegalArgumentException("AccountId는 필수입니다.");
            }
            if (requestDto.getItems() == null || requestDto.getItems().isEmpty()) {
                throw new IllegalArgumentException("주문할 상품 목록은 비어있을 수 없습니다.");
            }
            
            List<OrderResponseDto> responseDtos = orderService.createBulkAllOrders(requestDto);
            
            BulkAllOrderResponseDto response = BulkAllOrderResponseDto.builder()
                    .success(true)
                    .message("전체 주문이 성공적으로 생성되었습니다.")
                    .orders(responseDtos)
                    .totalItems(responseDtos.size())
                    .build();
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.out.println("Bulk All 주문 생성 실패: " + e.getMessage());
            e.printStackTrace();
            
            BulkAllOrderResponseDto errorResponse = BulkAllOrderResponseDto.builder()
                    .success(false)
                    .message("주문 생성에 실패했습니다: " + e.getMessage())
                    .orders(null)
                    .totalItems(0)
                    .build();
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(errorResponse);
        }
    }

    // 관리자용 모든 사용자의 주문 조회 (페이징 지원)
    @GetMapping("/admin/all")
    public ResponseEntity<ResponseDto<List<OrderResponseDto>>> getAllOrdersForAdmin(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            // 현재 로그인한 사용자의 권한 확인
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
            
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            String userRole = userDetails.getAccount().getRole();
            
            if (!"ADMIN".equals(userRole)) {
                System.out.println("관리자 권한이 없습니다: " + userRole);
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            
            List<OrderResponseDto> orders = orderService.getAllOrdersWithPaging(page, size);
            return ResponseEntity.ok(ResponseDto.success(orders));
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
        try {
            // 현재 로그인한 사용자의 권한 확인
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
            
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
            String userRole = userDetails.getAccount().getRole();
            
            if (!"ADMIN".equals(userRole)) {
                System.out.println("관리자 권한이 없습니다: " + userRole);
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            
            OrderResponseDto updatedOrder = orderService.updateOrderStatus(id, status);
            return ResponseEntity.ok(updatedOrder);
        } catch (Exception e) {
            System.out.println("주문 상태 변경 실패: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

}
