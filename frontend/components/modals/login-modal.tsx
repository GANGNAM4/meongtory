"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { getBackendUrl } from "@/lib/api";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignup: () => void;
  onLoginSuccess: (loginData: {
    id: number;
    email: string;
    name: string;
    role: string;
    accessToken: string;
    refreshToken: string;
  }) => void;
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
      const response = await axios.post(
        `${getBackendUrl()}/api/accounts/login`,
        { email, password },
        { headers: { "Content-Type": "application/json" } }
      );

      // 수정: 로그인 요청 URL 로그 추가
      console.log("로그인 요청 URL:", `${getBackendUrl()}/api/accounts/login`);
      console.log("로그인 응답:", response.data);

      const { data } = response.data;
      const { id, email: userEmail, name, role, accessToken, refreshToken } = data;

      // 로컬 스토리지에 토큰 저장
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      console.log("=== 로그인 후 localStorage 상태 ===");
      console.log("accessToken:", localStorage.getItem("accessToken"));
      console.log("refreshToken:", localStorage.getItem("refreshToken"));
      localStorage.setItem("email", userEmail);
      localStorage.setItem("nickname", name);
      localStorage.setItem("role", role);

      // 수정: 토큰 저장 후 확인 로그 강화
      console.log("=== 로그인 모달에서 토큰 저장 ===");
      console.log("저장된 Access Token:", accessToken ? "존재함" : "없음");
      console.log("저장된 Refresh Token:", refreshToken ? "존재함" : "없음");
      console.log("Access Token 길이:", accessToken?.length);
      console.log("localStorage에서 확인:", localStorage.getItem("accessToken") ? "저장됨" : "저장안됨");

      // onLoginSuccess 호출
      onLoginSuccess({
        id,
        email: userEmail,
        name,
        role,
        accessToken,
        refreshToken,
      });

      toast.success("로그인 성공");
      onClose();
    } catch (err: any) {
      console.error("로그인 오류:", err.response?.data?.message || err.message);
      if (err.response && err.response.data) {
        setError(err.response.data.message || "로그인 중 오류가 발생했습니다.");
        toast.error(err.response.data.message || "로그인에 실패했습니다", { duration: 5000 });
      } else {
        setError("서버와 연결할 수 없습니다.");
        toast.error("서버와 연결할 수 없습니다.", { duration: 5000 });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 수정: OAuth 요청 URL 디버깅 함수 추가
  const handleOAuthLogin = (provider: string) => {
    const oauthUrl = `${getBackendUrl()}/oauth2/authorization/${provider}`;
    console.log(`${provider} OAuth 요청 URL:`, oauthUrl);
    window.location.href = oauthUrl;
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
              onClick={() => handleOAuthLogin("google")} // 수정: handleOAuthLogin 사용
              className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google로 로그인
            </Button>
            <Button
              type="button"
              onClick={() => handleOAuthLogin("kakao")} // 수정: handleOAuthLogin 사용
              className="w-full bg-yellow-400 text-black hover:bg-yellow-500"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"
                />
              </svg>
              카카오로 로그인
            </Button>
            <Button
              type="button"
              onClick={() => handleOAuthLogin("naver")} // 수정: handleOAuthLogin 사용
              className="w-full bg-green-500 text-white hover:bg-green-600"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z"
                />
              </svg>
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