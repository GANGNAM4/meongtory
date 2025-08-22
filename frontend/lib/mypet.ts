import axios from 'axios';
import { getBackendUrl } from "@/lib/api";

// DTO 인터페이스
export interface MyPetRequestDto {
  name: string;
  breed?: string;
  age?: number;
  gender?: 'MALE' | 'FEMALE' | 'UNKNOWN';
  type?: string;
  weight?: number;
  imageUrl?: string;
}

export interface MyPetResponseDto {
  myPetId: number;
  name: string;
  breed?: string;
  age?: number;
  gender?: 'MALE' | 'FEMALE' | 'UNKNOWN';
  type?: string;
  weight?: number;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MyPetListResponseDto {
  myPets: MyPetResponseDto[];
  totalCount: number;
}

// API 함수들
export const myPetApi = {
  // 펫 등록
  registerMyPet: async (data: MyPetRequestDto): Promise<MyPetResponseDto> => {
    const response = await axios.post(`${getBackendUrl()}/api/mypet`, data, {
      withCredentials: true
    });
    return response.data.data;
  },

  // 펫 수정
  updateMyPet: async (myPetId: number, data: MyPetRequestDto): Promise<MyPetResponseDto> => {
    const response = await axios.put(`${getBackendUrl()}/api/mypet/${myPetId}`, data, {
      withCredentials: true
    });
    return response.data.data;
  },

  // 펫 삭제
  deleteMyPet: async (myPetId: number): Promise<void> => {
    await axios.delete(`${getBackendUrl()}/api/mypet/${myPetId}`, {
      withCredentials: true
    });
  },

  // 사용자의 모든 펫 조회
  getMyPets: async (): Promise<MyPetListResponseDto> => {
    const response = await axios.get(`${getBackendUrl()}/api/mypet`, {
      withCredentials: true
    });
    return response.data.data;
  },

  // 특정 펫 조회
  getMyPet: async (myPetId: number): Promise<MyPetResponseDto> => {
    const response = await axios.get(`${getBackendUrl()}/api/mypet/${myPetId}`, {
      withCredentials: true
    });
    return response.data.data;
  },

  // 이미지 업로드
  uploadPetImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post(`${getBackendUrl()}/api/mypet/upload-image`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data.data;
  }
}; 