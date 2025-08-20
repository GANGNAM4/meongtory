package com.my.backend.store.service;

import com.my.backend.global.dto.ResponseDto;
import com.my.backend.store.entity.Product;
import com.my.backend.store.entity.Category;
import com.my.backend.store.entity.Order;
import com.my.backend.store.repository.OrderItemRepository;
import com.my.backend.store.repository.OrderRepository;
import com.my.backend.store.repository.ProductRepository;
import com.my.backend.store.repository.CartRepository;
import com.my.backend.store.dto.ProductDto;
import com.my.backend.s3.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final CartRepository cartRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderRepository orderRepository;
    private final S3Service s3Service;

    public List<Product> getAllProducts() {
        List<Product> products = productRepository.findAll();
        System.out.println("조회된 상품 수: " + products.size());
        products.forEach(product -> {
            System.out.println("상품 ID: " + product.getId() + ", 이름: " + product.getName());
        });
        if (products.isEmpty()) {
            System.out.println("상품 데이터가 없어서 테스트 데이터를 생성합니다.");
            createTestProducts();
            products = productRepository.findAll();
        }
        return products;
    }

    private void createTestProducts() {
        try {
            Product product1 = Product.builder()
                    .name("프리미엄 강아지 사료 (성견용)")
                    .description("성견을 위한 프리미엄 사료입니다.")
                    .price(45000L)
                    .stock(50L)
                    .imageUrl("/placeholder.svg?height=300&width=300")
                    .category(Category.사료)
                    .registrationDate(LocalDate.now())
                    .registeredBy("admin")
                    .build();
            productRepository.save(product1);

            Product product2 = Product.builder()
                    .name("고양이 장난감 세트")
                    .description("다양한 고양이 장난감으로 구성된 세트입니다.")
                    .price(25000L)
                    .stock(100L)
                    .imageUrl("/placeholder.svg?height=300&width=300")
                    .category(Category.장난감)
                    .registrationDate(LocalDate.now())
                    .registeredBy("admin")
                    .build();
            productRepository.save(product2);

            System.out.println("테스트 상품 데이터 생성 완료");
        } catch (Exception e) {
            System.out.println("테스트 상품 데이터 생성 실패: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public Product createProduct(Product product) {
        System.out.println("=== 상품 생성 시작 ===");
        System.out.println("상품명: " + product.getName());
        System.out.println("이미지 URL: " + (product.getImageUrl() != null ? product.getImageUrl().substring(0, Math.min(50, product.getImageUrl().length())) + "..." : "null"));

        if (product.getRegistrationDate() == null) {
            product.setRegistrationDate(LocalDate.now());
            System.out.println("등록일 자동 설정: " + product.getRegistrationDate());
        }

        if (product.getRegisteredBy() == null || product.getRegisteredBy().trim().isEmpty()) {
            product.setRegisteredBy("admin");
            System.out.println("등록자 자동 설정: " + product.getRegisteredBy());
        }

        if (product.getImageUrl() != null && product.getImageUrl().startsWith("data:")) {
            System.out.println("Base64 이미지 감지됨 - S3 업로드 시작");
            try {
                String s3ImageUrl = s3Service.uploadProductBase64Image(product.getImageUrl());
                product.setImageUrl(s3ImageUrl);
                System.out.println("S3 업로드 완료: " + s3ImageUrl);
            } catch (Exception e) {
                System.out.println("S3 업로드 실패: " + e.getMessage());
                e.printStackTrace();
                product.setImageUrl("/placeholder.svg?height=300&width=300");
            }
        } else {
            System.out.println("Base64 이미지가 아님 - S3 업로드 건너뜀");
        }

        Product savedProduct = productRepository.save(product);
        System.out.println("상품 저장 완료: " + savedProduct.getId());
        return savedProduct;
    }

    public Product getProductById(Long id) {
        System.out.println("=== 상품 조회 시작 ===");
        System.out.println("조회할 상품 ID: " + id);

        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("상품을 찾을 수 없습니다."));

        System.out.println("조회된 상품: " + product.getName());
        System.out.println("상품 이미지 URL: " + product.getImageUrl());

        return product;
    }

    public Product updateProduct(Long id, Product updatedProduct) {
        Product product = getProductById(id);
        product.setName(updatedProduct.getName());
        product.setDescription(updatedProduct.getDescription());
        product.setPrice(updatedProduct.getPrice());
        product.setStock(updatedProduct.getStock());

        String oldImageUrl = product.getImageUrl();

        if (updatedProduct.getImageUrl() != null && updatedProduct.getImageUrl().startsWith("data:")) {
            try {
                String s3ImageUrl = s3Service.uploadBase64Image(updatedProduct.getImageUrl());
                product.setImageUrl(s3ImageUrl);

                if (oldImageUrl != null && oldImageUrl.startsWith("https://")) {
                    try {
                        String fileName = oldImageUrl.substring(oldImageUrl.lastIndexOf("/") + 1);
                        s3Service.deleteFile(fileName);
                        System.out.println("기존 S3 이미지 삭제 완료: " + fileName);
                    } catch (Exception e) {
                        System.out.println("기존 S3 이미지 삭제 실패: " + e.getMessage());
                    }
                }
            } catch (Exception e) {
                System.out.println("S3 업로드 실패: " + e.getMessage());
            }
        } else if (updatedProduct.getImageUrl() != null) {
            product.setImageUrl(updatedProduct.getImageUrl());
        }

        return productRepository.save(product);
    }

    @Transactional(rollbackFor = Exception.class)
    public ResponseDto<?> deleteProduct(Long id) {
        System.out.println("=== 상품 삭제 서비스 시작 ===");
        System.out.println("삭제할 상품 ID: " + id);
        
        // 상품 존재 여부 확인
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("상품을 찾을 수 없습니다: " + id));
        
        System.out.println("삭제할 상품: " + product.getName());
        
        try {
            // 1. 관련된 장바구니 항목들 먼저 삭제
            int deletedCartItems = cartRepository.deleteByProduct_Id(id);
            System.out.println("삭제된 장바구니 항목 수: " + deletedCartItems);
            
            // 2. 관련된 주문들의 product 참조를 null로 설정 (주문은 유지)
            List<Order> relatedOrders = orderRepository.findByProduct_Id(id);
            System.out.println("관련된 주문 수: " + relatedOrders.size());
            
            for (Order order : relatedOrders) {
                order.setProduct(null);
                orderRepository.save(order);
                System.out.println("주문 ID " + order.getId() + "의 product 참조를 null로 설정");
            }
            
            // 3. 관련된 주문 항목들 삭제 (OrderItem)
            int deletedOrderItems = orderItemRepository.deleteByProduct_Id(id);
            System.out.println("삭제된 주문 항목 수: " + deletedOrderItems);
            
            // 4. 상품 삭제
            productRepository.delete(product);
            System.out.println("상품 삭제 완료");
            
            System.out.println("=== 상품 삭제 서비스 성공 ===");
            return ResponseDto.success("삭제 완료");
            
        } catch (Exception e) {
            System.out.println("=== 상품 삭제 서비스 실패 ===");
            System.out.println("에러 메시지: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("상품 삭제 중 오류가 발생했습니다: " + e.getMessage());
        }
    }

    public S3Service getS3Service() {
        return s3Service;
    }

    public ProductDto toDto(Product product) {
        if (product == null) return null;

        return ProductDto.builder()
                .id(product.getId()) // productId -> id
                .name(product.getName())
                .description(product.getDescription())
                .price(product.getPrice())
                .stock(product.getStock())
                .imageUrl(product.getImageUrl())
                .category(product.getCategory())
                .registrationDate(product.getRegistrationDate())
                .registeredBy(product.getRegisteredBy())
                .build();
    }
    
    // StoreAI 관련 메서드들
    public Product getProduct(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("상품을 찾을 수 없습니다: " + id));
    }
    

    
    public List<Product> findByCategory(Category category) {
        return productRepository.findByCategory(category);
    }
    
    public List<Product> findByNameContaining(String keyword) {
        return productRepository.findByNameContaining(keyword);
    }
}