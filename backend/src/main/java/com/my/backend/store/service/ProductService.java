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
        return products;
    }

    public Product createProduct(Product product) {
        if (product.getRegistrationDate() == null) {
            product.setRegistrationDate(LocalDate.now());
        }

        if (product.getRegisteredBy() == null || product.getRegisteredBy().trim().isEmpty()) {
            product.setRegisteredBy("admin");
        }

        if (product.getImageUrl() != null && product.getImageUrl().startsWith("data:")) {
            try {
                String s3ImageUrl = s3Service.uploadProductBase64Image(product.getImageUrl());
                product.setImageUrl(s3ImageUrl);
            } catch (Exception e) {
                e.printStackTrace();
                product.setImageUrl("/placeholder.svg?height=300&width=300");
            }
        }

        Product savedProduct = productRepository.save(product);
        return savedProduct;
    }

    public Product getProductById(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("상품을 찾을 수 없습니다."));

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
        // 상품 존재 여부 확인
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("상품을 찾을 수 없습니다: " + id));
        
        try {
            // 1. 관련된 장바구니 항목들 먼저 삭제
            cartRepository.deleteByProduct_Id(id);
            
            // 2. 관련된 주문들의 product 참조를 null로 설정 (주문은 유지)
            List<Order> relatedOrders = orderRepository.findByProduct_Id(id);
            
            for (Order order : relatedOrders) {
                order.setProduct(null);
                orderRepository.save(order);
            }
            
            // 3. 관련된 주문 항목들 삭제 (OrderItem)
            orderItemRepository.deleteByProduct_Id(id);
            
            // 4. 상품 삭제
            productRepository.delete(product);
            
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