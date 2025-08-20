package com.my.backend.store.repository;

import com.my.backend.store.entity.Product;
import com.my.backend.store.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    
    List<Product> findByCategory(Category category);
    
    List<Product> findByNameContaining(String keyword);
}