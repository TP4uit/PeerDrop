#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$ROOT_DIR/mobile"
SERVER_DIR="$ROOT_DIR/server"

mkdir -p "$MOBILE_DIR/services" "$MOBILE_DIR/utils" "$MOBILE_DIR/store" "$MOBILE_DIR/components/ui"
mkdir -p "$SERVER_DIR/src/sockets" "$SERVER_DIR/src/utils"

cat > "$MOBILE_DIR/services/socket.service.ts" <<'EOF'
export const connectSocket = () => null;
EOF

cat > "$MOBILE_DIR/services/webrtc.service.ts" <<'EOF'
export const createPeerConnection = () => null;
EOF

cat > "$MOBILE_DIR/utils/fileChunking.ts" <<'EOF'
export const chunkFile = async () => [];
EOF

cat > "$MOBILE_DIR/utils/formatters.ts" <<'EOF'
export const formatBytes = (bytes = 0) => `${bytes} B`;
EOF

cat > "$MOBILE_DIR/store/appState.ts" <<'EOF'
export type AppState = {
  roomId: string | null;
  isConnected: boolean;
};

export const initialAppState: AppState = {
  roomId: null,
  isConnected: false,
};
EOF

cat > "$MOBILE_DIR/components/ui/ProgressBar.tsx" <<'EOF'
import React from 'react';

export default function ProgressBar() {
  return null;
}
EOF

cat > "$MOBILE_DIR/components/ui/DeviceCard.tsx" <<'EOF'
import React from 'react';

export default function DeviceCard() {
  return null;
}
EOF

cat > "$SERVER_DIR/src/sockets/roomHandler.js" <<'EOF'
module.exports = function registerRoomHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('join-room', (roomId) => {
      socket.join(roomId);
      socket.to(roomId).emit('user-joined', socket.id);
    });
  });
};
EOF

cat > "$SERVER_DIR/src/sockets/webrtcHandler.js" <<'EOF'
module.exports = function registerWebRTCHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('webrtc-signal', (data) => {
      io.to(data.toId).emit('webrtc-signal', {
        fromId: socket.id,
        signal: data.signal,
      });
    });
  });
};
EOF

cat > "$SERVER_DIR/src/utils/roomGenerator.js" <<'EOF'
function generateRoomId(length = 6) {
  return Math.random().toString(36).slice(2, 2 + length).toUpperCase();
}

module.exports = { generateRoomId };
EOF

echo "Scaffold complete."
