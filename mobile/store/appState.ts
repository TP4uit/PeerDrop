export type AppState = {
  roomId: string | null;
  isConnected: boolean;
};

export const initialAppState: AppState = {
  roomId: null,
  isConnected: false,
};
