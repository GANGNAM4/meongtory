package com.my.backend.store.service;

import com.my.backend.account.entity.Account;
import com.my.backend.account.repository.AccountRepository;
import com.my.backend.store.dto.OrderRequestDto;
import com.my.backend.store.dto.OrderResponseDto;
import com.my.backend.store.entity.Order;
import com.my.backend.store.entity.OrderStatus;
import com.my.backend.store.entity.Product;
import com.my.backend.store.entity.NaverProduct;
import com.my.backend.store.repository.CartRepository;
import com.my.backend.store.repository.OrderRepository;
import com.my.backend.store.repository.ProductRepository;
import com.my.backend.store.repository.NaverProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.my.backend.store.entity.Cart;


import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderService {
    private final CartRepository cartRepository; // 추가

    private final OrderRepository orderRepository;
    private final AccountRepository accountRepository;
    private final ProductRepository productRepository;
    private final NaverProductRepository naverProductRepository;
    private final CartService cartService;

    // 단일 주문 생성
    @Transactional
    public OrderResponseDto createOrder(OrderRequestDto requestDto) {
        System.out.println("=== 주문 생성 요청 ===");
        System.out.println("요청 데이터: " + requestDto);
        System.out.println("AccountId: " + requestDto.getAccountId());
        System.out.println("ProductId: " + requestDto.getProductId());
        System.out.println("Quantity: " + requestDto.getQuantity());
        
        // 주문자 조회
        Account account = accountRepository.findById(requestDto.getAccountId())
                .orElseThrow(() -> new IllegalArgumentException("Account not found: " + requestDto.getAccountId()));
        System.out.println("찾은 계정: " + account.getEmail() + " (ID: " + account.getId() + ")");

        // 상품 조회
        Product product = productRepository.findById(requestDto.getProductId())
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + requestDto.getProductId()));
        System.out.println("찾은 상품: " + product.getName() + " (ID: " + product.getId() + ", 가격: " + product.getPrice() + ", 재고: " + product.getStock() + ")");

        // 재고 확인 및 차감
        if (product.getStock() < requestDto.getQuantity()) {
            throw new IllegalArgumentException("재고가 부족합니다. (재고: " + product.getStock() + "개, 요청: " + requestDto.getQuantity() + "개)");
        }
        
        // 재고 차감
        product.setStock(product.getStock() - requestDto.getQuantity());
        productRepository.save(product);
        System.out.println("재고 차감 완료: " + product.getStock() + "개 남음");

        // 중복 주문 방지: 최근 10초 내에 같은 사용자가 같은 상품에 대해 주문한 경우 기존 주문 반환
        LocalDateTime tenSecondsAgo = LocalDateTime.now().minusSeconds(10);
        List<Order> recentOrders = orderRepository.findByAccountIdAndProductIdAndCreatedAtAfter(
                requestDto.getAccountId(), 
                requestDto.getProductId(), 
                tenSecondsAgo
        );
        
        if (!recentOrders.isEmpty()) {
            Order existingOrder = recentOrders.get(0);
            System.out.println("중복 주문 방지: 기존 주문 반환 - " + existingOrder.getMerchantOrderId());
            return mapToResponseDto(existingOrder);
        }

        // 금액 계산
        long amount = (long) product.getPrice() * requestDto.getQuantity();
        System.out.println("계산된 금액: " + amount);

        // merchantOrderId 자동 생성
        String merchantOrderId = generateMerchantOrderId();
        System.out.println("생성된 주문 ID: " + merchantOrderId);

        // 주문 생성
        Order order = Order.builder()
                .merchantOrderId(merchantOrderId)
                .amount(amount)
                .status(OrderStatus.CREATED)
                .createdAt(LocalDateTime.now())
                .quantity(requestDto.getQuantity())
                .account(account)
                .product(product)
                .build();

        Order saved = orderRepository.save(order);
        System.out.println("주문 저장 완료: " + saved.getId());
        
        // 장바구니에서 해당 상품 삭제
        try {
            System.out.println("장바구니 삭제 시작 - AccountId: " + requestDto.getAccountId() + ", ProductId: " + requestDto.getProductId());
            
            List<Cart> cartItems = cartRepository.findByAccount_Id(requestDto.getAccountId());
            System.out.println("찾은 장바구니 아이템 수: " + cartItems.size());
            
            List<Cart> itemsToDelete = cartItems.stream()
                .filter(cart -> {
                    boolean shouldDelete = cart.getProduct() != null && cart.getProduct().getId().equals(requestDto.getProductId());
                    if (shouldDelete) {
                        System.out.println("삭제할 장바구니 아이템 발견 - CartId: " + cart.getId() + ", ProductId: " + cart.getProduct().getId());
                    }
                    return shouldDelete;
                })
                .collect(Collectors.toList());
            
            System.out.println("삭제할 아이템 수: " + itemsToDelete.size());
            
            if (!itemsToDelete.isEmpty()) {
                // 개별 삭제로 변경하여 더 안정적으로 처리
                for (Cart cartItem : itemsToDelete) {
                    cartRepository.delete(cartItem);
                    System.out.println("장바구니 아이템 삭제 완료 - CartId: " + cartItem.getId());
                }
                System.out.println("장바구니에서 상품 삭제 완료: " + itemsToDelete.size() + "개 항목");
            } else {
                System.out.println("삭제할 장바구니 아이템이 없습니다.");
            }
        } catch (Exception e) {
            System.out.println("장바구니 삭제 중 오류 발생: " + e.getMessage());
            e.printStackTrace();
            // 장바구니 삭제 실패는 주문 생성에 영향을 주지 않도록 함
        }
        
        System.out.println("================================");
        
        return mapToResponseDto(saved);
    }

    // 단일 주문 조회
    @Transactional(readOnly = true)
    public OrderResponseDto getOrder(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Order not found id=" + id));
        return mapToResponseDto(order);
    }

    // 모든 사용자의 주문 조회 (관리자용) - 결제 완료된 주문만
    @Transactional(readOnly = true)
    public List<OrderResponseDto> getAllOrders() {
        return orderRepository.findAll().stream()
                .filter(order -> order.getStatus() == OrderStatus.PAID) // 결제 완료된 주문만 필터링
                .map(this::mapToResponseDto)
                .collect(Collectors.toList());
    }

    // 특정 사용자의 주문 조회 (결제 완료된 주문만)
    @Transactional(readOnly = true)
    public List<OrderResponseDto> getUserOrders(Long accountId) {
        return orderRepository.findByAccountId(accountId).stream()
                .filter(order -> order.getStatus() == OrderStatus.PAID) // 결제 완료된 주문만 필터링
                .map(this::mapToResponseDto)
                .collect(Collectors.toList());
    }

    // 주문 삭제
    @Transactional
    public void deleteOrder(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Order not found id=" + id));
        orderRepository.delete(order);
    }

    @Transactional
    public List<OrderResponseDto> createOrdersFromCart(Long accountId) {
        // account 조회
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new IllegalArgumentException("Account not found: " + accountId));

        // CartService를 통해 장바구니 아이템 조회
        List<Cart> cartItems = cartService.getCartByAccountId(accountId);
        if (cartItems.isEmpty()) {
            throw new IllegalArgumentException("장바구니가 비어있습니다.");
        }

        List<Order> orders = cartItems.stream().map(cart -> {
            Product product = cart.getProduct();
            String merchantOrderId = generateMerchantOrderId();

            Order order = Order.builder()
                    .merchantOrderId(merchantOrderId)
                    .amount((Long) product.getPrice() * cart.getQuantity())
                    .status(OrderStatus.CREATED)
                    .createdAt(LocalDateTime.now())
                    .account(account)
                    .quantity(cart.getQuantity())
                    .product(product)
                    .build();

            return orderRepository.save(order);
        }).toList();

        // 주문 생성 후 장바구니 비우기
        cartItems.forEach(cart -> cartService.removeFromCart(cart.getId()));

        return orders.stream().map(this::mapToResponseDto).collect(Collectors.toList());
    }

    // 주문 엔티티 → DTO 매핑 (일반 상품 + 네이버 상품)
    private OrderResponseDto mapToResponseDto(Order order) {
        // 일반 상품인 경우
        if (order.getProduct() != null) {
            Long productId = order.getProduct().getId();
            String productName = order.getProduct().getName();
            String imageUrl = order.getProduct().getImageUrl() != null ? order.getProduct().getImageUrl() : "/placeholder.svg";
            
            return OrderResponseDto.builder()
                    .id(order.getId())
                    .merchantOrderId(order.getMerchantOrderId())
                    .amount(order.getAmount())
                    .status(order.getStatus())
                    .createdAt(order.getCreatedAt())
                    .paidAt(order.getPaidAt())
                    .accountId(order.getAccount().getId())
                    .productId(productId)
                    .productName(productName)
                    .imageUrl(imageUrl)
                    .quantity(order.getQuantity())
                    .isNaverProduct(false)
                    .build();
        }
        // 네이버 상품인 경우
        else if (order.getNaverProduct() != null) {
            Long naverProductId = order.getNaverProduct().getId();
            String productName = order.getNaverProduct().getTitle();
            String imageUrl = order.getNaverProduct().getImageUrl() != null ? order.getNaverProduct().getImageUrl() : "/placeholder.svg";
            
            return OrderResponseDto.builder()
                    .id(order.getId())
                    .merchantOrderId(order.getMerchantOrderId())
                    .amount(order.getAmount())
                    .status(order.getStatus())
                    .createdAt(order.getCreatedAt())
                    .paidAt(order.getPaidAt())
                    .accountId(order.getAccount().getId())
                    .productId(naverProductId)
                    .productName(productName)
                    .imageUrl(imageUrl)
                    .quantity(order.getQuantity())
                    .isNaverProduct(true)
                    .build();
        }
        // 상품이 삭제된 경우
        else {
            return OrderResponseDto.builder()
                    .id(order.getId())
                    .merchantOrderId(order.getMerchantOrderId())
                    .amount(order.getAmount())
                    .status(order.getStatus())
                    .createdAt(order.getCreatedAt())
                    .paidAt(order.getPaidAt())
                    .accountId(order.getAccount().getId())
                    .productId(null)
                    .productName("삭제된 상품")
                    .imageUrl("/placeholder.svg")
                    .quantity(order.getQuantity())
                    .isNaverProduct(false)
                    .build();
        }
    }

    // merchantOrderId 자동 생성
    private String generateMerchantOrderId() {
        String datePart = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE); // 20250813
        long countToday = orderRepository.countByCreatedAtBetween(
                LocalDate.now().atStartOfDay(),
                LocalDate.now().plusDays(1).atStartOfDay()
        ) + 1;
        
        // 중복 방지를 위해 랜덤 숫자 추가
        String randomSuffix = String.format("%03d", (int)(Math.random() * 1000));
        return String.format("order-%s-%03d-%s", datePart, countToday, randomSuffix);
    }
    @Transactional
    public OrderResponseDto updateOrderStatus(Long orderId, OrderStatus newStatus) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found id=" + orderId));

        order.setStatus(newStatus);

        // 예: 결제 완료 시 paidAt 업데이트
        if (newStatus == OrderStatus.PAID) {
            order.setPaidAt(LocalDateTime.now());
        }

        Order updated = orderRepository.save(order);
        return mapToResponseDto(updated);
    }

    /**
     * 네이버 상품 주문 생성
     */
    @Transactional
    public OrderResponseDto createNaverProductOrder(Long accountId, Long naverProductId, int quantity) {
        try {
            System.out.println("=== 네이버 상품 주문 생성 요청 ===");
            System.out.println("AccountId: " + accountId);
            System.out.println("NaverProductId: " + naverProductId);
            System.out.println("Quantity: " + quantity);
            
            // 주문자 조회
            Account account = accountRepository.findById(accountId)
                    .orElseThrow(() -> new IllegalArgumentException("Account not found: " + accountId));
            System.out.println("찾은 계정: " + account.getEmail() + " (ID: " + account.getId() + ")");

            // 네이버 상품 조회
            NaverProduct naverProduct = naverProductRepository.findById(naverProductId)
                    .orElseThrow(() -> new IllegalArgumentException("NaverProduct not found: " + naverProductId));
            System.out.println("찾은 네이버 상품: " + naverProduct.getTitle() + " (ID: " + naverProduct.getId() + ", 가격: " + naverProduct.getPrice() + ")");

            // 네이버 상품은 재고 확인 없이 주문 가능 (실제 재고는 네이버에서 관리)
            System.out.println("네이버 상품 재고 확인 생략 (네이버에서 관리)");

            // 중복 주문 방지: 최근 10초 내에 같은 사용자가 같은 네이버 상품에 대해 주문한 경우 기존 주문 반환
            LocalDateTime tenSecondsAgo = LocalDateTime.now().minusSeconds(10);
            List<Order> recentOrders = orderRepository.findByAccountIdAndNaverProductIdAndCreatedAtAfter(
                    accountId, 
                    naverProductId, 
                    tenSecondsAgo
            );
            
            if (!recentOrders.isEmpty()) {
                Order existingOrder = recentOrders.get(0);
                System.out.println("중복 주문 방지: 기존 주문 반환 - " + existingOrder.getMerchantOrderId());
                return mapToResponseDto(existingOrder);
            }

            // 금액 계산
            long amount = (long) naverProduct.getPrice() * quantity;
            System.out.println("계산된 금액: " + amount);

            // merchantOrderId 자동 생성
            String merchantOrderId = generateMerchantOrderId();
            System.out.println("생성된 주문 ID: " + merchantOrderId);

            // 주문 생성
            Order order = Order.builder()
                    .merchantOrderId(merchantOrderId)
                    .amount(amount)
                    .status(OrderStatus.CREATED)
                    .createdAt(LocalDateTime.now())
                    .quantity(quantity)
                    .account(account)
                    .naverProduct(naverProduct)
                    .imageUrl(naverProduct.getImageUrl())
                    .build();

            System.out.println("주문 객체 생성 완료: " + order.getMerchantOrderId());

            Order saved = orderRepository.save(order);
            System.out.println("네이버 상품 주문 저장 완료: " + saved.getId());
            
            // 장바구니에서 해당 네이버 상품 삭제
            try {
                System.out.println("네이버 상품 장바구니 삭제 시작 - AccountId: " + accountId + ", NaverProductId: " + naverProductId);
                
                List<Cart> cartItems = cartRepository.findByAccount_Id(accountId);
                System.out.println("찾은 장바구니 아이템 수: " + cartItems.size());
                
                List<Cart> itemsToDelete = cartItems.stream()
                    .filter(cart -> {
                        boolean shouldDelete = cart.getNaverProduct() != null && cart.getNaverProduct().getId().equals(naverProductId);
                        if (shouldDelete) {
                            System.out.println("삭제할 네이버 상품 장바구니 아이템 발견 - CartId: " + cart.getId() + ", NaverProductId: " + cart.getNaverProduct().getId());
                        }
                        return shouldDelete;
                    })
                    .collect(Collectors.toList());
                
                System.out.println("삭제할 네이버 상품 아이템 수: " + itemsToDelete.size());
                
                if (!itemsToDelete.isEmpty()) {
                    // 개별 삭제로 변경하여 더 안정적으로 처리
                    for (Cart cartItem : itemsToDelete) {
                        cartRepository.delete(cartItem);
                        System.out.println("네이버 상품 장바구니 아이템 삭제 완료 - CartId: " + cartItem.getId());
                    }
                    System.out.println("장바구니에서 네이버 상품 삭제 완료: " + itemsToDelete.size() + "개 항목");
                } else {
                    System.out.println("삭제할 네이버 상품 장바구니 아이템이 없습니다.");
                }
            } catch (Exception e) {
                System.out.println("네이버 상품 장바구니 삭제 중 오류 발생: " + e.getMessage());
                e.printStackTrace();
                // 장바구니 삭제 실패는 주문 생성에 영향을 주지 않도록 함
            }
            
            System.out.println("================================");
            
            return mapToResponseDto(saved);
        } catch (Exception e) {
            System.out.println("네이버 상품 주문 생성 중 오류 발생: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

}
