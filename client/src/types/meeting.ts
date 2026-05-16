export type MeetingMaterialPublic =
  | { kind: "link"; url: string; label?: string }
  | { kind: "file"; fileName: string; mimeType?: string; dataUrl: string };

export type MeetingInviteePublic = { id: string; fullName: string };

export interface MeetingBookingPublic {
  id: string;
  roomId: string;
  roomName: string;
  locationName: string;
  floor: string;
  organizerId: string;
  organizerName: string;
  workDate: string;
  hourStart?: number;
  hourEnd?: number;
  title: string;
  inviteeIds: string[];
  invitees: MeetingInviteePublic[];
  materials: MeetingMaterialPublic[];
}

export interface MeetingRoomPublic {
  id: string;
  locationId: string;
  locationName: string;
  name: string;
  floor: string;
  capacity: number;
  isActive: boolean;
}
