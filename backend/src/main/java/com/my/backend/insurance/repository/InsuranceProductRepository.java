package com.my.backend.insurance.repository;

import com.my.backend.insurance.entity.InsuranceProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface InsuranceProductRepository extends JpaRepository<InsuranceProduct, Long> {
    Optional<InsuranceProduct> findByCompanyAndProductName(String company, String productName);
}

