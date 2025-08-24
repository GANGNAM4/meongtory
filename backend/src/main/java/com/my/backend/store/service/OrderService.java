package com.my.backend.store.service;

import com.my.backend.account.entity.Account;
import com.my.backend.account.repository.AccountRepository;
import com.my.backend.store.dto.OrderRequestDto;
import com.my.backend.store.dto.OrderResponseDto;
import com.my.backend.store.dto.BulkAllOrderRequestDto;
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
import java.util.ArrayList;

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
        // 주문자 조회
        Account account = accountRepository.findById(requestDto.getAccountId())
                .orElseThrow(() -> new IllegalArgumentException("Account not found: " + requestDto.getAccountId()));

        // 상품 조회
        Product product = productRepository.findById(requestDto.getProductId())
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + requestDto.getProductId()));

        // 재고 확인 및 차감
        if (product.getStock() < requestDto.getQuantity()) {
            throw new IllegalArgumentException("재고가 부족합니다. (재고: " + product.getStock() + "개, 요청: " + requestDto.getQuantity() + "개)");
        }
        
        // 재고 차감
        product.setStock(product.getStock() - requestDto.getQuantity());
        productRepository.save(product);

        // 중복 주문 방지: 최근 10초 내에 같은 사용자가 같은 상품에 대해 주문한 경우 기존 주문 반환
        LocalDateTime tenSecondsAgo = LocalDateTime.now().minusSeconds(10);
        List<Order> recentOrders = orderRepository.findByAccountIdAndProductIdAndCreatedAtAfter(
                requestDto.getAccountId(), 
                requestDto.getProductId(), 
                tenSecondsAgo
        );
        
        if (!recentOrders.isEmpty()) {
            Order existingOrder = recentOrders.get(0);
            return mapToResponseDto(existingOrder);
        }

        // 금액 계산
        long amount = (long) product.getPrice() * requestDto.getQuantity();

        // merchantOrderId 자동 생성
        String merchantOrderId = generateMerchantOrderId();

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
        
        // 장바구니에서 해당 상품 삭제
        try {
            List<Cart> cartItems = cartRepository.findByAccount_Id(requestDto.getAccountId());
            
            List<Cart> itemsToDelete = cartItems.stream()
                .filter(cart -> {
                    boolean shouldDelete = cart.getProduct() != null && cart.getProduct().getId().equals(requestDto.getProductId());
                    return shouldDelete;
                })
                .collect(Collectors.toList());
            
            if (!itemsToDelete.isEmpty()) {
                // 개별 삭제로 변경하여 더 안정적으로 처리
                for (Cart cartItem : itemsToDelete) {
                    cartRepository.delete(cartItem);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            // 장바구니 삭제 실패는 주문 생성에 영향을 주지 않도록 함
        }
        
        return mapToResponseDto(saved);
    }

    // 단일 주문 조회
    @Transactional(readOnly = true)
    public OrderResponseDto getOrder(Long id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Order not found id=" + id));
        return mapToResponseDto(order);
    }

    // 모든 사용자의 주문 조회 (관리자용) - 결제 완료 및 취소된 주문 포함
    @Transactional(readOnly = true)
    public List<OrderResponseDto> getAllOrders() {
        return orderRepository.findAll().stream()
                .filter(order -> order.getStatus() == OrderStatus.PAID || order.getStatus() == OrderStatus.CANCELED) // 결제 완료 및 취소된 주문 포함
                .map(this::mapToResponseDto)
                .collect(Collectors.toList());
    }

    // 모든 사용자의 주문 조회 (관리자용) - 페이징 지원
    @Transactional(readOnly = true)
    public List<OrderResponseDto> getAllOrdersWithPaging(int page, int size) {
        return orderRepository.findAll().stream()
                .filter(order -> order.getStatus() == OrderStatus.PAID || order.getStatus() == OrderStatus.CANCELED) // 결제 완료 및 취소된 주문 포함
                .sorted((o1, o2) -> o2.getCreatedAt().compareTo(o1.getCreatedAt())) // 최신순 정렬
                .skip(page * size)
                .limit(size)
                .map(this::mapToResponseDto)
                .collect(Collectors.toList());
    }

    // 특정 사용자의 주문 조회 (결제 완료 및 취소된 주문 포함)
    @Transactional(readOnly = true)
    public List<OrderResponseDto> getUserOrders(Long accountId) {
        return orderRepository.findByAccountId(accountId).stream()
                .filter(order -> order.getStatus() == OrderStatus.PAID || order.getStatus() == OrderStatus.CANCELED) // 결제 완료 및 취소된 주문 포함
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

        // 일반 상품과 네이버 상품 분리
        List<Cart> regularProductCarts = cartItems.stream()
            .filter(cart -> cart.getProduct() != null)
            .collect(Collectors.toList());
            
        List<Cart> naverProductCarts = cartItems.stream()
            .filter(cart -> cart.getNaverProduct() != null)
            .collect(Collectors.toList());

        List<Order> orders = new ArrayList<>();

        // 1. 일반 상품 처리
        for (Cart cart : regularProductCarts) {
            Product product = cart.getProduct();
            
            // 재고 확인 및 차감
            if (product.getStock() < cart.getQuantity()) {
                throw new IllegalArgumentException("재고가 부족합니다. 상품: " + product.getName() + 
                    " (재고: " + product.getStock() + "개, 요청: " + cart.getQuantity() + "개)");
            }
            
            // 재고 차감
            product.setStock(product.getStock() - cart.getQuantity());
            productRepository.save(product);

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

            orders.add(orderRepository.save(order));
        }

        // 2. 네이버 상품 처리
        for (Cart cart : naverProductCarts) {
            NaverProduct naverProduct = cart.getNaverProduct();
            String merchantOrderId = generateMerchantOrderId();

            Order order = Order.builder()
                    .merchantOrderId(merchantOrderId)
                    .amount((Long) naverProduct.getPrice() * cart.getQuantity())
                    .status(OrderStatus.CREATED)
                    .createdAt(LocalDateTime.now())
                    .account(account)
                    .quantity(cart.getQuantity())
                    .naverProduct(naverProduct)
                    .build();

            orders.add(orderRepository.save(order));
        }

        // 주문 생성 후 장바구니 비우기
        cartItems.forEach(cart -> cartService.removeFromCart(cart.getId()));

        return orders.stream().map(this::mapToResponseDto).collect(Collectors.toList());
    }

    // 전체 상품 일괄 주문 생성 (일반 상품 + 네이버 상품)
    @Transactional
    public List<OrderResponseDto> createBulkAllOrders(BulkAllOrderRequestDto requestDto) {
        // account 조회
        Account account = accountRepository.findById(requestDto.getAccountId())
                .orElseThrow(() -> new IllegalArgumentException("Account not found: " + requestDto.getAccountId()));

        List<Order> orders = new ArrayList<>();

        // 각 상품별로 주문 생성
        for (BulkAllOrderRequestDto.OrderItemDto item : requestDto.getItems()) {
            
            if ("regular".equals(item.getType())) {
                // 일반 상품 처리
                if (item.getProductId() == null) {
                    throw new IllegalArgumentException("일반 상품의 경우 productId는 필수입니다: " + item.getName());
                }
                
                Product product = productRepository.findById(item.getProductId())
                        .orElseThrow(() -> new IllegalArgumentException("Product not found: " + item.getProductId()));
                
                // 재고 확인 및 차감
                if (product.getStock() < item.getQuantity()) {
                    throw new IllegalArgumentException("재고가 부족합니다. 상품: " + product.getName() + 
                            " (재고: " + product.getStock() + "개, 요청: " + item.getQuantity() + "개)");
                }
                
                // 재고 차감
                product.setStock(product.getStock() - item.getQuantity());
                productRepository.save(product);
                
                // 주문 생성
                String merchantOrderId = generateMerchantOrderId();
                long amount = (long) product.getPrice() * item.getQuantity();
                
                Order order = Order.builder()
                        .merchantOrderId(merchantOrderId)
                        .amount(amount)
                        .status(OrderStatus.CREATED)
                        .createdAt(LocalDateTime.now())
                        .account(account)
                        .quantity(item.getQuantity())
                        .product(product)
                        .build();
                
                orders.add(orderRepository.save(order));
                
            } else if ("naver".equals(item.getType())) {
                // 네이버 상품 처리
                if (item.getNaverProductId() == null) {
                    throw new IllegalArgumentException("네이버 상품의 경우 naverProductId는 필수입니다: " + item.getName());
                }
                
                NaverProduct naverProduct = naverProductRepository.findById(item.getNaverProductId())
                        .orElseThrow(() -> new IllegalArgumentException("NaverProduct not found: " + item.getNaverProductId()));
                
                // 주문 생성
                String merchantOrderId = generateMerchantOrderId();
                long amount = (long) naverProduct.getPrice() * item.getQuantity();
                
                Order order = Order.builder()
                        .merchantOrderId(merchantOrderId)
                        .amount(amount)
                        .status(OrderStatus.CREATED)
                        .createdAt(LocalDateTime.now())
                        .account(account)
                        .quantity(item.getQuantity())
                        .naverProduct(naverProduct)
                        .build();
                
                orders.add(orderRepository.save(order));
                
            } else {
                throw new IllegalArgumentException("지원하지 않는 상품 타입입니다: " + item.getType());
            }
        }

        // 주문 생성 후 장바구니에서 해당 상품들 삭제
        for (BulkAllOrderRequestDto.OrderItemDto item : requestDto.getItems()) {
            if ("regular".equals(item.getType())) {
                // 일반 상품 장바구니에서 삭제
                List<Cart> cartItems = cartService.getCartByAccountId(account.getId());
                cartItems.stream()
                    .filter(cart -> cart.getProduct() != null && cart.getProduct().getId().equals(item.getProductId()))
                    .forEach(cart -> {
                        cartService.removeFromCart(cart.getId());
                    });
            } else if ("naver".equals(item.getType())) {
                // 네이버 상품 장바구니에서 삭제
                List<Cart> cartItems = cartService.getCartByAccountId(account.getId());
                cartItems.stream()
                    .filter(cart -> cart.getNaverProduct() != null && cart.getNaverProduct().getId().equals(item.getNaverProductId()))
                    .forEach(cart -> {
                        cartService.removeFromCart(cart.getId());
                    });
            }
        }
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
            // 주문자 조회
            Account account = accountRepository.findById(accountId)
                    .orElseThrow(() -> new IllegalArgumentException("Account not found: " + accountId));

            // 네이버 상품 조회
            NaverProduct naverProduct = naverProductRepository.findById(naverProductId)
                    .orElseThrow(() -> new IllegalArgumentException("NaverProduct not found: " + naverProductId));

            // 중복 주문 방지: 최근 10초 내에 같은 사용자가 같은 네이버 상품에 대해 주문한 경우 기존 주문 반환
            LocalDateTime tenSecondsAgo = LocalDateTime.now().minusSeconds(10);
            List<Order> recentOrders = orderRepository.findByAccountIdAndNaverProductIdAndCreatedAtAfter(
                    accountId, 
                    naverProductId, 
                    tenSecondsAgo
            );
            
            if (!recentOrders.isEmpty()) {
                Order existingOrder = recentOrders.get(0);
                return mapToResponseDto(existingOrder);
            }

            // 금액 계산
            long amount = (long) naverProduct.getPrice() * quantity;

            // merchantOrderId 자동 생성
            String merchantOrderId = generateMerchantOrderId();

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

            Order saved = orderRepository.save(order);
            
            // 장바구니에서 해당 네이버 상품 삭제
            try {
                List<Cart> cartItems = cartRepository.findByAccount_Id(accountId);
                
                List<Cart> itemsToDelete = cartItems.stream()
                    .filter(cart -> {
                        boolean shouldDelete = cart.getNaverProduct() != null && cart.getNaverProduct().getId().equals(naverProductId);
                        return shouldDelete;
                    })
                    .collect(Collectors.toList());
                
                if (!itemsToDelete.isEmpty()) {
                    // 개별 삭제로 변경하여 더 안정적으로 처리
                    for (Cart cartItem : itemsToDelete) {
                        cartRepository.delete(cartItem);
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
                // 장바구니 삭제 실패는 주문 생성에 영향을 주지 않도록 함
            }
            
            return mapToResponseDto(saved);
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
    }

}
