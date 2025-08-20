"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { getApiBaseUrl, getBackendUrl } from "@/lib/api";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignup: () => void;
  onLoginSuccess?: () => void;
}

export default function LoginModal({
  isOpen,
  onClose,
  onSwitchToSignup,
  onLoginSuccess,
}: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(
    !!localStorage.getItem("accessToken")
  );
  const [userEmail, setUserEmail] = useState("");

  // 페이지 로드 시 localStorage에서 토큰 확인 및 사용자 정보 조회
  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      axios
        .get(`${getApiBaseUrl()}/accounts/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        .then((response) => {
          const { email, name, role } = response.data.data;
          setUserEmail(email);
          setIsLoggedIn(true);

          // 로컬스토리지에 저장
          localStorage.setItem("nickname", name || "");
          localStorage.setItem("email", email || "");
          localStorage.setItem("role", role || "USER");

          toast.success("로그인 유지됨");

          if (onLoginSuccess) {
            onLoginSuccess();
          }
        })
        .catch(() => {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          setIsLoggedIn(false);
          setUserEmail("");
          toast.error("토큰이 유효하지 않습니다");
        });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("올바른 이메일 형식을 입력해주세요.");
      return;
    }

    setIsLoading(true);

    try {
      // 로그인 요청
      const response = await axios.post(

        `${process.env.NEXT_PUBLIC_BAKCEND_URL}/api/accounts/login`,

 
        { email, password },
        { headers: { "Content-Type": "application/json" } }
      );

      const { data } = response.data;
      const { accessToken, refreshToken } = data;

      // 🔑 토큰 저장
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      
      // 토큰 저장 확인
      console.log("=== 로그인 모달에서 토큰 저장 ===")
      console.log("저장된 Access Token:", accessToken ? "존재함" : "없음")
      console.log("저장된 Refresh Token:", refreshToken ? "존재함" : "없음")
      console.log("Access Token 길이:", accessToken?.length)
      console.log("localStorage에서 확인:", localStorage.getItem("accessToken") ? "저장됨" : "저장안됨")
      
      setUserEmail(email);
      setIsLoggedIn(true);
      toast.success("로그인 성공");

      if (onLoginSuccess) {
        onLoginSuccess();
      }

      onClose();
    } catch (err: any) {
      if (err.response && err.response.data) {
        setError(
          err.response.data.message || "로그인 중 오류가 발생했습니다."
        );
      } else {
        setError("서버와 연결할 수 없습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserEmail("");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("nickname");
    localStorage.removeItem("email");
    localStorage.removeItem("role");
    toast.success("로그아웃 되었습니다");
  };

  const handleTestLogin = () => {
    setEmail("user@test.com");
    setPassword("Test1234!");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
          <CardTitle className="text-2xl font-bold text-center">로그인</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="이메일을 입력하세요"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="비밀번호를 입력하세요 (최소 8자, 영문/숫자/특수문자 포함)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">또는</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              onClick={() => (window.location.href = `${getBackendUrl()}/oauth2/authorization/google`)}
              className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            >
              Google로 로그인
            </Button>
            <Button
              type="button"
              onClick={() => (window.location.href = `${getBackendUrl()}/oauth2/authorization/kakao`)}
              className="w-full bg-yellow-400 text-black hover:bg-yellow-500"
            >
              카카오로 로그인
            </Button>
            <Button
              type="button"
              onClick={() => (window.location.href = `${getBackendUrl()}/oauth2/authorization/naver`)}
              className="w-full bg-green-500 text-white hover:bg-green-600"
            >
              네이버로 로그인
            </Button>
          </div>

          <div className="text-center">
            <div className="text-sm text-gray-600">
              계정이 없으신가요?{" "}
              <button
                onClick={onSwitchToSignup}
                className="text-blue-600 hover:underline"
              >
                회원가입
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
