const ROOM_DISCONNECT_GRACE_MS = 30000;

module.exports = (io, socket, rooms) => {
    const findRoomIdForSocket = (socketId = socket.id) => {
        for (const [roomId, room] of rooms.entries()) {
            if (room.members.has(socketId)) {
                return roomId;
            }
        }

        return null;
    };

    const ensureRoom = (roomId) => {
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                status: 'idle',
                members: new Map(),
                cleanupTimers: new Map()
            });
        }

        return rooms.get(roomId);
    };

    const clearRoomCleanup = (room) => {
        if (room.cleanupTimer) {
            clearTimeout(room.cleanupTimer);
            room.cleanupTimer = null;
        }

        if (!room.cleanupTimers) {
            room.cleanupTimers = new Map();
            return;
        }

        for (const timer of room.cleanupTimers.values()) {
            clearTimeout(timer);
        }

        room.cleanupTimers.clear();
    };

    const clearMemberCleanup = (room, socketId) => {
        if (!room.cleanupTimers) {
            room.cleanupTimers = new Map();
            return;
        }

        const timer = room.cleanupTimers.get(socketId);

        if (timer) {
            clearTimeout(timer);
            room.cleanupTimers.delete(socketId);
        }

        if (room.cleanupTimer) {
            clearTimeout(room.cleanupTimer);
            room.cleanupTimer = null;
        }
    };

    const deleteRoomIfEmpty = (roomId, reason) => {
        const room = rooms.get(roomId);

        if (!room || room.members.size > 0) {
            return false;
        }

        clearRoomCleanup(room);
        rooms.delete(roomId);
        console.log(`[room] deleted empty room=${roomId} reason=${reason}`);
        return true;
    };

    const removeSocketFromCurrentRoom = (reason) => {
        const targetRoomId = findRoomIdForSocket();

        if (!targetRoomId) {
            return null;
        }

        const room = rooms.get(targetRoomId);
        if (!room) {
            return null;
        }

        clearMemberCleanup(room, socket.id);
        room.members.delete(socket.id);
        socket.leave(targetRoomId);

        if (!deleteRoomIfEmpty(targetRoomId, reason)) {
            room.status = 'idle';
            socket.to(targetRoomId).emit('user-disconnected', {
                socketId: socket.id,
                reason
            });
            console.log(`[room] socket=${socket.id} left room=${targetRoomId} reason=${reason}; members=${room.members.size}`);
        }

        return targetRoomId;
    };

    const scheduleDisconnectedSocketCleanup = (reason) => {
        const targetRoomId = findRoomIdForSocket();

        if (!targetRoomId) {
            return null;
        }

        const room = rooms.get(targetRoomId);
        const member = room?.members.get(socket.id);

        if (!room || !member) {
            return null;
        }

        member.connected = false;
        member.disconnectedAt = Date.now();
        room.status = 'idle';

        socket.to(targetRoomId).emit('user-disconnected', {
            socketId: socket.id,
            reason
        });

        clearMemberCleanup(room, socket.id);
        const cleanupTimer = setTimeout(() => {
            const latestRoom = rooms.get(targetRoomId);
            const latestMember = latestRoom?.members.get(socket.id);

            if (!latestRoom || !latestMember || latestMember.connected) {
                return;
            }

            latestRoom.cleanupTimers?.delete(socket.id);
            latestRoom.members.delete(socket.id);
            deleteRoomIfEmpty(targetRoomId, 'disconnect-grace-expired');

            if (rooms.has(targetRoomId)) {
                console.log(`[room] removed stale socket=${socket.id} from room=${targetRoomId} after grace; members=${latestRoom.members.size}`);
            }
        }, ROOM_DISCONNECT_GRACE_MS);
        room.cleanupTimers.set(socket.id, cleanupTimer);

        console.log(`[room] socket=${socket.id} disconnected from room=${targetRoomId} reason=${reason}; cleanup in ${ROOM_DISCONNECT_GRACE_MS}ms`);
        return targetRoomId;
    };

    socket.on('join-room', (payload) => {
        if (!payload || !payload.roomId || !payload.userInfo) {
            socket.emit('room-error', { message: 'Invalid room or user data.' });
            return;
        }

        const { roomId, userInfo } = payload;
        const {
            deviceId = socket.handshake.query?.deviceId || socket.id,
            nickname,
            avatar
        } = userInfo;
        const existingRoomId = findRoomIdForSocket();

        if (existingRoomId && existingRoomId !== roomId) {
            removeSocketFromCurrentRoom('switch-room');
        }

        const room = ensureRoom(roomId);

        for (const [memberSocketId, member] of room.members.entries()) {
            if (memberSocketId === socket.id || member.deviceId === deviceId) {
                clearMemberCleanup(room, memberSocketId);
                room.members.delete(memberSocketId);
            }
        }

        clearMemberCleanup(room, socket.id);

        const connectedMembers = Array.from(room.members.values()).filter(
            (member) => member.connected !== false
        );

        if (connectedMembers.length >= 2) {
            socket.emit('room-error', { message: 'This room is full.' });
            return;
        }

        room.members.set(socket.id, {
            socketId: socket.id,
            roomId,
            deviceId,
            nickname,
            avatar,
            connected: true,
            disconnectedAt: null
        });

        socket.join(roomId);
        console.log(`[room] join-room socket=${socket.id} device=${deviceId} room=${roomId} connected=${connectedMembers.length + 1} total=${room.members.size} status=${room.status}`);

        const membersList = Array.from(room.members.values()).filter(
            (member) => member.connected !== false
        );

        socket.emit('room-joined', {
            status: 'success',
            roomId,
            members: membersList
        });

        socket.to(roomId).emit('user-joined', {
            socketId: socket.id,
            deviceId,
            nickname,
            avatar
        });
    });

    socket.on('radar-scan', () => {
        const availableHosts = [];

        for (const [roomId, room] of rooms.entries()) {
            const connectedMembers = Array.from(room.members.values()).filter(
                (member) => member.connected !== false
            );

            if (connectedMembers.length === 1 && room.status === 'idle') {
                const hostInfo = connectedMembers[0];

                availableHosts.push({
                    socketId: hostInfo.socketId,
                    roomId,
                    deviceId: hostInfo.deviceId,
                    nickname: hostInfo.nickname,
                    avatar: hostInfo.avatar
                });
            }
        }

        console.log(`[radar] scan socket=${socket.id} rooms=${rooms.size} available=${availableHosts.length}`);
        socket.emit('radar-result', availableHosts);
    });

    socket.on('leave-room', () => {
        const roomId = removeSocketFromCurrentRoom('leave-room');

        if (roomId) {
            socket.emit('room-left', { roomId });
        }
    });

    socket.on('status-update', (payload) => {
        if (!payload || !payload.status) {
            return;
        }

        const { status } = payload;

        for (const [roomId, room] of rooms.entries()) {
            if (room.members.has(socket.id)) {
                room.status = status;
                socket.to(roomId).emit('user-status-changed', {
                    id: socket.id,
                    status
                });
                console.log(`[room] status-update room=${roomId} status=${status} socket=${socket.id}`);
                break;
            }
        }
    });

    socket.on('disconnect', (reason) => {
        scheduleDisconnectedSocketCleanup(reason);
        console.log(`[socket] disconnected socket=${socket.id} reason=${reason}`);
    });
};
