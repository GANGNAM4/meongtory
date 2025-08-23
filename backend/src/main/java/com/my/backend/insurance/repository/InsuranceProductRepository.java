package com.my.backend.insurance.repository;

import com.my.backend.insurance.entity.InsuranceProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface InsuranceProductRepository extends JpaRepository<InsuranceProduct, Long> {
    Optional<InsuranceProduct> findByCompanyAndProductName(String company, String productName);
    Optional<InsuranceProduct> findByCompany(String company);
    List<InsuranceProduct> findAllByCompany(String company);
}

