package com.my.backend;


import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.transaction.annotation.EnableTransactionManagement;



@SpringBootApplication
@EnableJpaAuditing
@EnableTransactionManagement
@EnableCaching
public class BackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
        System.out.println("( •̀ ω •́ )y( •̀ ω •́ )y( •̀ ω •́ )y( •̀ ω •́ )y( •̀ ω •́ )y");
    }
}