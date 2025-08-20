package com.my.backend.store.controller;

import com.my.backend.global.dto.ResponseDto;
import com.my.backend.store.entity.Product;
import com.my.backend.store.repository.ProductRepository;
import com.my.backend.store.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;
    private final ProductRepository productRepository;

    @GetMapping
    public ResponseDto<List<Product>> getAllProducts() {
        try {
            List<Product> products = productService.getAllProducts();
            return ResponseDto.success(products);
        } catch (Exception e) {
            System.out.println("상품 목록 조회 실패: " + e.getMessage());
            e.printStackTrace();
            return ResponseDto.fail("PRODUCT_FETCH_FAILED", "상품 목록을 가져오는데 실패했습니다: " + e.getMessage());
        }
    }

    @PostMapping
    public Product createProduct(@RequestBody Product product) {
        System.out.println("=== 상품 생성 API 호출 ===");
        System.out.println("상품명: " + product.getName());
        System.out.println("가격: " + product.getPrice());
        System.out.println("재고: " + product.getStock());
        System.out.println("설명: " + product.getDescription());
        System.out.println("카테고리: " + product.getCategory());
        System.out.println("이미지URL: " + (product.getImageUrl() != null ? product.getImageUrl().substring(0, Math.min(100, product.getImageUrl().length())) + "..." : "null"));
        
        try {
            Product createdProduct = productService.createProduct(product);
            System.out.println("=== 상품 생성 성공 ===");
            return createdProduct;
        } catch (Exception e) {
            System.out.println("=== 상품 생성 실패 ===");
            System.out.println("에러 메시지: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    @GetMapping("/{id}")
    public Product getProduct(@PathVariable Long id) {
        try {
            System.out.println("=== 상품 조회 API 호출 ===");
            System.out.println("요청된 상품 ID: " + id);
            System.out.println("ID 타입: " + (id != null ? id.getClass().getName() : "null"));
            System.out.println("ID 값이 유효한지 확인: " + (id != null && id > 0));

            if (id == null) {
                System.out.println("ERROR: 상품 ID가 null입니다.");
                throw new IllegalArgumentException("상품 ID가 null입니다.");
            }

            if (id <= 0) {
                System.out.println("ERROR: 상품 ID가 유효하지 않습니다: " + id);
                throw new IllegalArgumentException("상품 ID가 유효하지 않습니다: " + id);
            }

            System.out.println("상품 서비스 호출 시작...");
            Product product = productService.getProductById(id);

            if (product == null) {
                System.out.println("ERROR: 상품을 찾을 수 없습니다: " + id);
                throw new RuntimeException("상품을 찾을 수 없습니다: " + id);
            }

            System.out.println("조회된 상품: " + product.getName());
            System.out.println("상품 ID: " + product.getId());
            System.out.println("상품 카테고리: " + product.getCategory());
            System.out.println("상품 이미지: " + product.getImageUrl());
            System.out.println("=== 상품 조회 성공 ===");

            return product;
        } catch (NumberFormatException e) {
            System.out.println("ERROR: 상품 ID 형식이 올바르지 않습니다: " + id);
            throw new IllegalArgumentException("상품 ID 형식이 올바르지 않습니다: " + id);
        } catch (Exception e) {
            System.out.println("ERROR: 상품 조회 실패: " + e.getMessage());
            System.out.println("에러 타입: " + e.getClass().getName());
            e.printStackTrace();
            throw e;
        }
    }

    @PutMapping("/{id}")
    public Product updateProduct(@PathVariable Long id, @RequestBody Product product) {
        return productService.updateProduct(id, product);
    }

    @DeleteMapping("/{id}")
    public ResponseDto<?> deleteProduct(@PathVariable Long id) {
        if (id == null || id <= 0) {
            System.out.println("ERROR: 유효하지 않은 상품 ID: " + id);
            throw new IllegalArgumentException("유효하지 않은 상품 ID입니다.");
        }
        
        try {
            System.out.println("=== 상품 삭제 API 호출 ===");
            System.out.println("삭제할 상품 ID: " + id);
            
            // ProductService의 deleteProduct 메서드 사용
            ResponseDto<?> result = productService.deleteProduct(id);
            
            System.out.println("=== 상품 삭제 성공 ===");
            return result;
        } catch (Exception e) {
            System.out.println("=== 상품 삭제 실패 ===");
            System.out.println("에러 메시지: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }
}