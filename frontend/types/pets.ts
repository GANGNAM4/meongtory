// 입양용 반려동물 (보호소에서 보호 중인 동물)
export interface Pet {
  petId: number  // id -> petId로 변경
  name: string
  breed: string
  age: number  // string -> number로 변경
  gender: 'MALE' | 'FEMALE' | 'UNKNOWN'  // string -> enum으로 변경
  vaccinated: boolean  // isVaccinated -> vaccinated로 변경
  description: string
  imageUrl: string  // images[] -> imageUrl로 변경
  adopted: boolean  // adoptionStatus -> adopted로 변경
  weight?: number
  location?: string
  microchipId?: string
  medicalHistory?: string
  vaccinations?: string
  notes?: string
  specialNeeds?: string
  personality?: string  // string[] -> string(JSON)으로 변경
  rescueStory?: string
  aiBackgroundStory?: string
  status?: string
  type?: string
  neutered: boolean  // isNeutered -> neutered로 변경
}

// 사용자가 소유한 반려동물
export interface MyPet {
  myPetId: number  // id -> myPetId로 변경
  name: string
  breed: string
  age: number
  gender: 'MALE' | 'FEMALE' | 'UNKNOWN'
  type: string
  weight?: number
  imageUrl?: string
  vaccinated: boolean  // 추가
  neutered: boolean  // 추가
  // 의료기록 관련 필드들 추가
  medicalHistory?: string
  vaccinations?: string
  notes?: string
  microchipId?: string
  specialNeeds?: string
  owner: {  // userId -> owner 관계로 변경
    id: number
    name: string
    email: string
  }
  createdAt: string
  updatedAt: string
}

export interface AnimalRecord {
  id: string
  name: string
  breed: string
  age: number
  gender: "수컷" | "암컷"
  weight: number
  registrationDate: Date
  medicalHistory: string[]
  vaccinations: string[]
  microchipId?: string
  notes: string
  contractGenerated: boolean
  aiBackgroundStory?: string
  images?: string[]
} 