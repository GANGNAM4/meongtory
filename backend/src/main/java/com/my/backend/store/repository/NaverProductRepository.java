package com.my.backend.store.repository;

import com.my.backend.store.entity.NaverProduct;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NaverProductRepository extends JpaRepository<NaverProduct, Long> {
    
    Optional<NaverProduct> findByProductId(String productId);
    
    Optional<NaverProduct> findByTitleAndMallName(String title, String mallName);
    
    @Query("SELECT np FROM NaverProduct np WHERE np.title LIKE %:keyword% OR np.description LIKE %:keyword% OR np.brand LIKE %:keyword%")
    Page<NaverProduct> findByKeyword(@Param("keyword") String keyword, Pageable pageable);
    
    @Query("SELECT np FROM NaverProduct np WHERE np.category1 LIKE %:category% OR np.category2 LIKE %:category% OR np.category3 LIKE %:category% OR np.category4 LIKE %:category%")
    Page<NaverProduct> findByCategory(@Param("category") String category, Pageable pageable);
    
    @Query("SELECT np FROM NaverProduct np WHERE np.price BETWEEN :minPrice AND :maxPrice")
    Page<NaverProduct> findByPriceRange(@Param("minPrice") Long minPrice, @Param("maxPrice") Long maxPrice, Pageable pageable);
    
    @Query("SELECT np FROM NaverProduct np WHERE np.rating >= :minRating ORDER BY np.rating DESC")
    Page<NaverProduct> findByMinRating(@Param("minRating") Double minRating, Pageable pageable);
    
    @Query("SELECT np FROM NaverProduct np WHERE np.mallName = :mallName")
    Page<NaverProduct> findByMallName(@Param("mallName") String mallName, Pageable pageable);
    
    @Query("SELECT np FROM NaverProduct np WHERE np.brand = :brand")
    Page<NaverProduct> findByBrand(@Param("brand") String brand, Pageable pageable);
    
    @Query("SELECT np FROM NaverProduct np ORDER BY np.searchCount DESC, np.reviewCount DESC")
    Page<NaverProduct> findPopularProducts(Pageable pageable);
    
    @Query("SELECT np FROM NaverProduct np ORDER BY np.rating DESC, np.reviewCount DESC")
    Page<NaverProduct> findTopRatedProducts(Pageable pageable);
    
    @Query("SELECT np FROM NaverProduct np WHERE np.relatedProduct.id = :productId")
    List<NaverProduct> findByRelatedProductId(@Param("productId") Long productId);
    
    Page<NaverProduct> findAllByIdIn(List<Long> ids, Pageable pageable);
}
