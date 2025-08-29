package com.my.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;

@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        RestTemplate restTemplate = builder
                .requestFactory(() -> {
                    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
                    factory.setConnectTimeout(30000); // 30초
                    factory.setReadTimeout(30000);    // 30초
                    return factory;
                })
                .build();
        
        // UTF-8 인코딩을 위한 StringHttpMessageConverter 설정
        StringHttpMessageConverter stringConverter = new StringHttpMessageConverter(StandardCharsets.UTF_8);
        stringConverter.setWriteAcceptCharset(false);
        
        // 기존 컨버터들을 UTF-8 컨버터로 교체
        restTemplate.setMessageConverters(Arrays.asList(
            stringConverter,
            new MappingJackson2HttpMessageConverter()
        ));
        
        return restTemplate;
    }

}