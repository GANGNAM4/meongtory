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
        try {
            Product createdProduct = productService.createProduct(product);
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
            if (id == null) {
                System.out.println("ERROR: 상품 ID가 null입니다.");
                throw new IllegalArgumentException("상품 ID가 null입니다.");
            }

            if (id <= 0) {
                System.out.println("ERROR: 상품 ID가 유효하지 않습니다: " + id);
                throw new IllegalArgumentException("상품 ID가 유효하지 않습니다: " + id);
            }

            Product product = productService.getProductById(id);

            if (product == null) {
                System.out.println("ERROR: 상품을 찾을 수 없습니다: " + id);
                throw new RuntimeException("상품을 찾을 수 없습니다: " + id);
            }

            return product;
        } catch (NumberFormatException e) {
            System.out.println("ERROR: 상품 ID 형식이 올바르지 않습니다: " + id);
            throw new IllegalArgumentException("상품 ID 형식이 올바르지 않습니다: " + id);
        } catch (Exception e) {
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
            // ProductService의 deleteProduct 메서드 사용
            ResponseDto<?> result = productService.deleteProduct(id);
            return result;
        } catch (Exception e) {
            System.out.println("=== 상품 삭제 실패 ===");
            System.out.println("에러 메시지: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }
}