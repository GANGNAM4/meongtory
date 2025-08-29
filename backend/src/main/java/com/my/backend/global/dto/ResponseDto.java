package com.my.backend.global.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class ResponseDto<T> {
    private boolean success;
    private T data;
    private Error error;

    public static <T> ResponseDto<T> success(T data){
        return new ResponseDto<>(true, data, null);
    }
    public static <T> ResponseDto<T> fail(String code, String msg){
        return new ResponseDto<>(false, null, new Error(code, msg));
    }

    @Getter
    @AllArgsConstructor
    public static class Error {
        private String code;
        private String message;
    }
}
