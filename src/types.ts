export type PetType = 'Kedi' | 'Köpek';

export interface Pet {
  id: string;
  name: string;
  type: PetType;
  breed: string;
  age: string;
  city: string;
  district: string;
  photos: string[];
  description: string;
  vaccinationStatus: string;
  neuteredStatus: string;
  energyLevel: number; // 1-5
  toiletTraining: boolean;
  ownerId: string;
  ownerName?: string;
  ownerPhoto?: string;
  createdAt: string;
  isBoosted?: boolean;
  boostedUntil?: string; // ISO string
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  city: string;
  district: string;
  gender: 'Kadın' | 'Erkek' | 'Belirtilmedi';
  petType: PetType;
  inviteCode: string;
  patiPuan: number;
  profilePhoto?: string;
  role: 'admin' | 'user';
  favorites?: string[];
  matches?: string[];
}

export interface Message {
  id: string;
  senderId: string;
  text?: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio';
  dataUrl?: string;
}

export interface Conversation {
  id: string;
  participants: string[]; // User IDs
  participantNames?: Record<string, string>;
  participantPhotos?: Record<string, string>;
  lastMessage?: string;
  lastTimestamp?: string;
  petId?: string;
  unreadCount?: number;
}

export type AppScreen = 'login' | 'register' | 'home' | 'search' | 'add' | 'favorites' | 'profile' | 'detail' | 'chat' | 'chatDetail' | 'matches';
