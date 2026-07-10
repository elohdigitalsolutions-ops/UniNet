export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'system' | 'success' | 'error' | 'incoming' | 'outgoing' | 'warn';
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  isSelf: boolean;
  customStyle?: string;
}

export type ConnectionStatus = 'ONLINE' | 'OFFLINE';

export interface DeviceRegistryUpdate {
  count: number;
}

export interface StatusUpdateData {
  status: 'idle' | 'hosting' | 'connected' | 'tapping';
  roleText: string;
  badgeColor: string;
  message: string;
  style?: 'system' | 'success' | 'error' | 'incoming' | 'outgoing' | 'warn';
}

export interface TunnelRequest {
  senderId: string;
  url: string;
  requestId: string;
}

export interface TunnelResponse {
  senderId: string;
  url: string;
  requestId: string;
  html: string;
  status: number;
  bytes: number;
  contentType: string;
  loadTimeMs: number;
  hostIp?: string;
  title?: string;
}

export interface TunnelSpeedData {
  senderId: string;
  speedKbps: number;
  pingMs: number;
}

