package com.my.backend.diary.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Arrays;

@Converter(autoApply = true)
public class StringArrayConverter implements AttributeConverter<String[], String> {

    @Override
    public String convertToDatabaseColumn(String[] attribute) {
        if (attribute == null || attribute.length == 0) {
            return null;
        }
        // PostgreSQL 배열 형식으로 변환: {"value1", "value2", "value3"}
        return "{" + String.join(",", Arrays.stream(attribute)
                .map(value -> "\"" + value.replace("\"", "\\\"") + "\"")
                .toArray(String[]::new)) + "}";
    }

    @Override
    public String[] convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isEmpty() || dbData.equals("{}")) {
            return new String[0];
        }
        
        // PostgreSQL 배열 형식에서 String[]로 변환
        // {"value1", "value2", "value3"} -> ["value1", "value2", "value3"]
        String cleanData = dbData.substring(1, dbData.length() - 1); // {} 제거
        if (cleanData.isEmpty()) {
            return new String[0];
        }
        
        return Arrays.stream(cleanData.split(","))
                .map(value -> value.trim().replaceAll("^\"|\"$", "")) // 따옴표 제거
                .toArray(String[]::new);
    }
} 