(function () {
    const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
    const MAX_WHITEBOARD_SEGMENTS = 2500;

    const state = {
        initialized: false,
        socket: null,
        localStream: null,
        screenStream: null,
        localParticipant: null,
        participants: new Map(),
        peerConnections: {},
        sharedFiles: [],
        whiteboardSegments: [],
        whiteboardSegmentIds: new Set(),
        drawing: false,
        lastDrawPoint: null,
        resizeHandler: null,
    };

    const rtcConfig = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    const elements = {};

    function cacheElements() {
        elements.localVideo = document.getElementById("localVideo");
        elements.localVideoWrapper = document.getElementById("localVideoWrapper");
        elements.videoGrid = document.getElementById("videoGrid");
        elements.chatInput = document.getElementById("chatInput");
        elements.chatMessages = document.getElementById("chatMessages");
        elements.participantsList = document.getElementById("participantsList");
        elements.transcriptMessages = document.getElementById("transcriptMessages");
        elements.reactionsOverlay = document.getElementById("reactionsOverlay");
        elements.micBtn = document.getElementById("micBtn");
        elements.cameraBtn = document.getElementById("cameraBtn");
        elements.screenShareBtn = document.getElementById("screenShareBtn");
        elements.micStatus = document.getElementById("micStatus");
        elements.cameraStatus = document.getElementById("cameraStatus");
        elements.screenShareIndicator = document.getElementById("screenShareIndicator");
        elements.aiStatus = document.getElementById("aiStatus");
        elements.filesList = document.getElementById("filesList");
        elements.fileInput = document.getElementById("fileInput");
        elements.whiteboardCanvas = document.getElementById("whiteboardCanvas");
        elements.whiteboardColor = document.getElementById("whiteboardColor");
        elements.whiteboardSize = document.getElementById("whiteboardSize");
    }

    function emitRoomEvent(name, detail) {
        document.dispatchEvent(
            new CustomEvent("room:" + name, {
                detail: detail || {},
            })
        );
    }

    function getStateSnapshot() {
        return {
            room: getRoomData(),
            localParticipant: state.localParticipant ? { ...state.localParticipant } : null,
            participants: Array.from(state.participants.values()).map(function (participant) {
                return { ...participant };
            }),
            sharedFiles: state.sharedFiles.map(function (file) {
                return { ...file };
            }),
            whiteboardSegmentsCount: state.whiteboardSegments.length,
            isScreenSharing: Boolean(state.localParticipant && state.localParticipant.screen_sharing),
        };
    }

    function getRoomData() {
        const source = window.roomData || {};
        const fallbackUserId = "guest-" + Math.random().toString(36).slice(2, 10);

        window.roomData = {
            ...source,
            code: String(source.code || source.id || "").trim() || "demo",
            id: String(source.id || source.code || "").trim() || "DEMO",
            name: String(source.name || "").trim() || "Team Meeting",
            joinUrl: String(source.joinUrl || "").trim(),
            userId: String(source.userId || "").trim() || fallbackUserId,
            userName: String(source.userName || "").trim() || "Guest",
            avatarUrl: String(source.avatarUrl || source.avatar_url || "").trim(),
            isHost: Boolean(source.isHost),
            hostId: String(source.hostId || "").trim(),
        };

        return window.roomData;
    }

    function notify(message, type) {
        if (typeof window.showToast === "function") {
            window.showToast(message, type);
        }
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function formatTime(timestamp) {
        if (!timestamp) {
            return "Just now";
        }

        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) {
            return "Just now";
        }

        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function formatFileSize(bytes) {
        const size = Number(bytes || 0);
        if (size < 1024) {
            return size + " B";
        }
        if (size < 1024 * 1024) {
            return (size / 1024).toFixed(1) + " KB";
        }
        return (size / (1024 * 1024)).toFixed(1) + " MB";
    }

    function createId(prefix) {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return prefix + "-" + window.crypto.randomUUID();
        }
        return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    }

    function updateAiStatus(text, listening) {
        if (!elements.aiStatus) {
            return;
        }

        elements.aiStatus.textContent = text;
        elements.aiStatus.classList.toggle("listening", Boolean(listening));
    }

    function setButtonState(button, isOff, onIconClass, offIconClass) {
        if (!button) {
            return;
        }

        const icon = button.querySelector("i");
        if (isOff) {
            button.style.background = "var(--error-red)";
            button.style.color = "white";
        } else {
            button.style.background = "";
            button.style.color = "";
        }

        if (icon) {
            icon.className = "fas " + (isOff ? offIconClass : onIconClass);
        }
    }

    function updateStatusIndicator(element, enabled, onIconClass, offIconClass) {
        if (!element) {
            return;
        }

        element.classList.toggle("muted", !enabled);
        const icon = element.querySelector("i");
        if (icon) {
            icon.className = "fas " + (enabled ? onIconClass : offIconClass);
        }
    }

    function updateLocalControls() {
        if (!state.localParticipant) {
            return;
        }

        setButtonState(elements.micBtn, !state.localParticipant.mic_enabled, "fa-microphone", "fa-microphone-slash");
        setButtonState(elements.cameraBtn, !state.localParticipant.camera_enabled, "fa-video", "fa-video-slash");
        updateStatusIndicator(elements.micStatus, state.localParticipant.mic_enabled, "fa-microphone", "fa-microphone-slash");
        updateStatusIndicator(elements.cameraStatus, state.localParticipant.camera_enabled, "fa-video", "fa-video-slash");

        if (elements.screenShareBtn) {
            elements.screenShareBtn.classList.toggle("active", state.localParticipant.screen_sharing);
        }

        if (elements.screenShareIndicator) {
            elements.screenShareIndicator.style.display = state.localParticipant.screen_sharing ? "flex" : "none";
        }
    }

    function participantBadges(participant) {
        const badges = [];

        if (participant.is_host) {
            badges.push('<span class="participant-badge host">Host</span>');
        }

        if (participant.hand_raised) {
            badges.push('<span class="participant-badge">Hand Raised</span>');
        }

        if (participant.screen_sharing) {
            badges.push('<span class="participant-badge">Sharing</span>');
        }

        return badges.join("");
    }

    function participantListMarkup(participant, roleText) {
        const initials = escapeHtml(((participant.name || "G").trim().charAt(0) || "G").toUpperCase());
        const avatarUrl = escapeHtml(participant.avatar_url || participant.avatarUrl || "");
        const avatarMarkup = avatarUrl
            ? `<img src="${avatarUrl}" alt="${escapeHtml(participant.name || "Participant")}">`
            : initials;

        return `
            <li class="participant-item">
                <div class="participant-avatar">${avatarMarkup}</div>
                <div class="participant-details">
                    <div class="participant-name">
                        ${escapeHtml(participant.name)}
                        ${participantBadges(participant)}
                    </div>
                    <div class="participant-role">${escapeHtml(roleText)}</div>
                </div>
            </li>
        `;
    }

    function renderParticipants() {
        if (!elements.participantsList || !state.localParticipant) {
            return;
        }

        const remoteParticipants = Array.from(state.participants.values()).sort(function (left, right) {
            return left.name.localeCompare(right.name);
        });

        const markup = [
            participantListMarkup(state.localParticipant, "You"),
            `
                <li class="participant-item">
                    <div class="participant-avatar" style="background: var(--primary-deep);">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="participant-details">
                        <div class="participant-name">
                            NeuroMeet AI
                            <span class="participant-badge ai">AI</span>
                        </div>
                        <div class="participant-role">Assistant</div>
                    </div>
                </li>
            `,
        ];

        remoteParticipants.forEach(function (participant) {
            markup.push(participantListMarkup(participant, "Participant"));
        });

        elements.participantsList.innerHTML = markup.join("");
    }

    function createRemoteCard(participant) {
        if (!elements.videoGrid || !participant || !participant.id) {
            return null;
        }

        let wrapper = document.getElementById("participant-" + participant.id);
        if (wrapper) {
            return wrapper;
        }

        wrapper = document.createElement("div");
        wrapper.className = "video-wrapper";
        wrapper.id = "participant-" + participant.id;
        wrapper.innerHTML = `
            <video id="remote-video-${participant.id}" autoplay playsinline></video>
            <div class="participant-info" style="opacity: 1;">
                <span class="participant-name">
                    <i class="fas fa-user"></i>
                    <span id="participant-name-${participant.id}">${escapeHtml(participant.name)}</span>
                </span>
                <div class="participant-status">
                    <span class="status-icon" id="remote-mic-${participant.id}" title="Microphone">
                        <i class="fas fa-microphone"></i>
                    </span>
                    <span class="status-icon" id="remote-camera-${participant.id}" title="Camera">
                        <i class="fas fa-video"></i>
                    </span>
                </div>
            </div>
        `;

        elements.videoGrid.appendChild(wrapper);
        updateRemoteCard(participant.id);
        return wrapper;
    }

    function updateRemoteCard(participantId) {
        const participant = state.participants.get(participantId);
        if (!participant) {
            return;
        }

        const name = document.getElementById("participant-name-" + participantId);
        if (name) {
            name.textContent = participant.name;
        }

        updateStatusIndicator(
            document.getElementById("remote-mic-" + participantId),
            participant.mic_enabled,
            "fa-microphone",
            "fa-microphone-slash"
        );
        updateStatusIndicator(
            document.getElementById("remote-camera-" + participantId),
            participant.camera_enabled,
            "fa-video",
            "fa-video-slash"
        );
    }

    function appendChatMessage(payload) {
        if (!elements.chatMessages) {
            return;
        }

        const message = document.createElement("div");
        const isOwn = payload.participant_id === state.localParticipant.id;
        const senderName = payload.participant && payload.participant.name ? payload.participant.name : "Guest";
        message.className = "message" + (isOwn ? " sent" : "");
        message.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${escapeHtml(senderName)}</span>
                    <span class="message-time">${escapeHtml(formatTime(payload.timestamp))}</span>
                </div>
                <div class="message-text">${escapeHtml(payload.message || "")}</div>
            </div>
        `;

        elements.chatMessages.appendChild(message);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        emitRoomEvent("chat", payload);
    }

    function appendTranscript(payload) {
        if (!elements.transcriptMessages || !(payload.text || "").trim()) {
            return;
        }

        const speaker = payload.participant && payload.participant.name ? payload.participant.name : "Meeting";
        const item = document.createElement("div");
        item.className = "transcript-item";
        item.innerHTML = `
            <div class="transcript-speaker">${escapeHtml(speaker)}</div>
            <div class="transcript-text">${escapeHtml(payload.text)}</div>
            <div class="transcript-time">${escapeHtml(formatTime(payload.timestamp))}</div>
        `;

        elements.transcriptMessages.appendChild(item);
        elements.transcriptMessages.scrollTop = elements.transcriptMessages.scrollHeight;
        emitRoomEvent("transcript", payload);
    }

    function showReaction(payloadOrEmoji) {
        if (!elements.reactionsOverlay) {
            return;
        }

        const payload =
            typeof payloadOrEmoji === "string"
                ? { emoji: payloadOrEmoji }
                : payloadOrEmoji || {};
        const emoji = payload.emoji;
        if (!emoji) {
            return;
        }

        const reaction = document.createElement("div");
        reaction.className = "reaction-emoji";
        reaction.textContent = emoji;
        elements.reactionsOverlay.appendChild(reaction);
        window.setTimeout(function () {
            reaction.remove();
        }, 2000);
        emitRoomEvent("reaction", payload);
    }

    function upsertParticipant(participant) {
        if (!participant || !participant.id) {
            return;
        }

        if (state.localParticipant && participant.id === state.localParticipant.id) {
            state.localParticipant = { ...state.localParticipant, ...participant };
            updateLocalControls();
            renderParticipants();
            emitRoomEvent("participant", state.localParticipant);
            return;
        }

        const existing = state.participants.get(participant.id) || {};
        state.participants.set(participant.id, { ...existing, ...participant });
        renderParticipants();
        updateRemoteCard(participant.id);
        emitRoomEvent("participant", state.participants.get(participant.id));
    }

    function removeParticipant(participantId) {
        state.participants.delete(participantId);
        closePeerConnection(participantId);

        const wrapper = document.getElementById("participant-" + participantId);
        if (wrapper) {
            wrapper.remove();
        }

        renderParticipants();
        emitRoomEvent("participant-left", { participant_id: participantId });
    }

    function setSharedFiles(files) {
        state.sharedFiles = [];
        files.forEach(function (file) {
            addSharedFile(file);
        });
        renderSharedFiles();
    }

    function addSharedFile(file) {
        if (!file || !file.id) {
            return;
        }

        const nextFiles = state.sharedFiles.filter(function (existing) {
            return existing.id !== file.id;
        });
        nextFiles.unshift(file);
        state.sharedFiles = nextFiles.slice(0, 20);
        emitRoomEvent("file", file);
    }

    function renderSharedFiles() {
        if (!elements.filesList) {
            return;
        }

        if (!state.sharedFiles.length) {
            elements.filesList.innerHTML = '<div class="empty-state">Shared files will appear here.</div>';
            return;
        }

        elements.filesList.innerHTML = state.sharedFiles
            .map(function (file) {
                const participantName = file.participant && file.participant.name ? file.participant.name : "Participant";
                return `
                    <div class="file-card">
                        <div class="file-meta">
                            <div class="file-name">${escapeHtml(file.name)}</div>
                            <div class="file-details">
                                ${escapeHtml(formatFileSize(file.size))} . Shared by ${escapeHtml(participantName)} . ${escapeHtml(formatTime(file.shared_at))}
                            </div>
                        </div>
                        <button class="file-download-btn" type="button" onclick="downloadSharedFile('${escapeHtml(file.id)}')">
                            <i class="fas fa-download"></i>
                            Download
                        </button>
                    </div>
                `;
            })
            .join("");
    }

    function downloadSharedFile(fileId) {
        const file = state.sharedFiles.find(function (entry) {
            return entry.id === fileId;
        });
        if (!file) {
            return;
        }

        const link = document.createElement("a");
        link.href = file.content;
        link.download = file.name;
        link.rel = "noopener";
        link.click();
    }
    function getCurrentVideoTrack() {
        if (state.screenStream) {
            return state.screenStream.getVideoTracks()[0] || null;
        }

        if (!state.localStream) {
            return null;
        }

        return state.localStream.getVideoTracks()[0] || null;
    }

    function getCurrentVideoStream() {
        return state.screenStream || state.localStream;
    }

    function closePeerConnection(participantId) {
        const peerConnection = state.peerConnections[participantId];
        if (!peerConnection) {
            return;
        }

        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.close();
        delete state.peerConnections[participantId];
        window.peerConnections = state.peerConnections;
    }

    function sendSocketMessage(payload) {
        if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
            return false;
        }

        state.socket.send(JSON.stringify(payload));
        return true;
    }

    function broadcastStatus() {
        if (!state.localParticipant) {
            return;
        }

        sendSocketMessage({
            type: "status",
            mic_enabled: state.localParticipant.mic_enabled,
            camera_enabled: state.localParticipant.camera_enabled,
            screen_sharing: state.localParticipant.screen_sharing,
        });
    }

    async function replaceOutgoingVideoTrack(nextTrack) {
        const peerConnections = Object.values(state.peerConnections);

        await Promise.all(
            peerConnections.map(async function (peerConnection) {
                const sender = peerConnection.getSenders().find(function (currentSender) {
                    return currentSender.track && currentSender.track.kind === "video";
                });

                if (sender) {
                    await sender.replaceTrack(nextTrack || null);
                    return;
                }

                if (nextTrack) {
                    peerConnection.addTrack(nextTrack, getCurrentVideoStream());
                }
            })
        );
    }

    function createPeerConnection(participantId) {
        if (state.peerConnections[participantId]) {
            return state.peerConnections[participantId];
        }

        const peerConnection = new RTCPeerConnection(rtcConfig);
        state.peerConnections[participantId] = peerConnection;
        window.peerConnections = state.peerConnections;

        if (state.localStream) {
            state.localStream.getAudioTracks().forEach(function (track) {
                peerConnection.addTrack(track, state.localStream);
            });
        }

        const videoTrack = getCurrentVideoTrack();
        if (videoTrack) {
            peerConnection.addTrack(videoTrack, getCurrentVideoStream());
        }

        peerConnection.onicecandidate = function (event) {
            if (!event.candidate) {
                return;
            }

            sendSocketMessage({
                type: "ice-candidate",
                target: participantId,
                candidate: event.candidate,
            });
        };

        peerConnection.ontrack = function (event) {
            const participant = state.participants.get(participantId) || {
                id: participantId,
                name: "Participant",
                mic_enabled: true,
                camera_enabled: true,
            };
            const wrapper = createRemoteCard(participant);
            const video = wrapper ? wrapper.querySelector("video") : null;
            if (video && event.streams && event.streams[0]) {
                video.srcObject = event.streams[0];
                emitRoomEvent("remote-stream", {
                    participant_id: participantId,
                    participant: participant,
                    stream: event.streams[0],
                });
            }
        };

        return peerConnection;
    }

    async function createOffer(participantId) {
        const peerConnection = createPeerConnection(participantId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        sendSocketMessage({
            type: "offer",
            target: participantId,
            offer: offer,
        });
    }

    async function handleOffer(payload) {
        upsertParticipant(payload.participant);
        const peerConnection = createPeerConnection(payload.participant_id);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        sendSocketMessage({
            type: "answer",
            target: payload.participant_id,
            answer: answer,
        });
    }

    async function handleAnswer(payload) {
        const peerConnection = state.peerConnections[payload.participant_id];
        if (!peerConnection) {
            return;
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
    }

    async function handleIceCandidate(payload) {
        const peerConnection = state.peerConnections[payload.participant_id];
        if (!peerConnection || !payload.candidate) {
            return;
        }

        await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
    }

    async function startScreenShare() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            notify("Screen sharing is not supported in this browser.", "error");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const track = stream.getVideoTracks()[0];
            if (!track) {
                return;
            }

            state.screenStream = stream;
            state.localParticipant.screen_sharing = true;
            track.onended = function () {
                stopScreenShare();
            };

            await replaceOutgoingVideoTrack(track);

            if (elements.localVideo) {
                elements.localVideo.srcObject = stream;
            }

            updateLocalControls();
            renderParticipants();
            broadcastStatus();
            emitRoomEvent("screen-share", {
                active: true,
                participant: state.localParticipant,
            });
            notify("Screen sharing started", "success");
        } catch (error) {
            notify("Unable to share your screen.", "error");
        }
    }

    async function stopScreenShare() {
        if (!state.screenStream) {
            return;
        }

        const activeScreenStream = state.screenStream;
        state.screenStream = null;

        activeScreenStream.getTracks().forEach(function (track) {
            track.stop();
        });
        state.localParticipant.screen_sharing = false;

        await replaceOutgoingVideoTrack(getCurrentVideoTrack());

        if (elements.localVideo) {
            elements.localVideo.srcObject = state.localStream;
        }

        updateLocalControls();
        renderParticipants();
        broadcastStatus();
        emitRoomEvent("screen-share", {
            active: false,
            participant: state.localParticipant,
        });
        notify("Screen sharing stopped", "info");
    }

    async function initializeLocalMedia() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            notify("Camera and microphone are not supported in this browser.", "error");
            return;
        }

        try {
            state.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            window.localStream = state.localStream;

            if (elements.localVideo) {
                elements.localVideo.srcObject = state.localStream;
            }

            const audioTrack = state.localStream.getAudioTracks()[0];
            const videoTrack = state.localStream.getVideoTracks()[0];
            state.localParticipant.mic_enabled = Boolean(audioTrack && audioTrack.enabled);
            state.localParticipant.camera_enabled = Boolean(videoTrack && videoTrack.enabled);
            updateLocalControls();
            emitRoomEvent("local-stream", {
                participant: state.localParticipant,
                stream: state.localStream,
            });
        } catch (error) {
            state.localParticipant.mic_enabled = false;
            state.localParticipant.camera_enabled = false;
            updateLocalControls();
            notify("Allow camera and microphone access to use meeting controls.", "error");
        }
    }
    function resizeWhiteboardCanvas() {
        if (!elements.whiteboardCanvas) {
            return;
        }

        const canvas = elements.whiteboardCanvas;
        const surface = canvas.parentElement;
        if (!surface) {
            return;
        }

        const rect = surface.getBoundingClientRect();
        const width = Math.max(280, Math.floor(rect.width));
        const height = Math.max(280, Math.floor(rect.height));
        const scale = window.devicePixelRatio || 1;

        canvas.width = Math.floor(width * scale);
        canvas.height = Math.floor(height * scale);
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";

        const context = canvas.getContext("2d");
        if (!context) {
            return;
        }

        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.lineCap = "round";
        context.lineJoin = "round";
        redrawWhiteboard();
    }

    function getWhiteboardContext() {
        if (!elements.whiteboardCanvas) {
            return null;
        }
        return elements.whiteboardCanvas.getContext("2d");
    }

    function drawWhiteboardSegment(segment) {
        const context = getWhiteboardContext();
        const canvas = elements.whiteboardCanvas;
        if (!context || !canvas) {
            return;
        }

        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        context.strokeStyle = segment.color;
        context.lineWidth = Number(segment.size || 3);
        context.beginPath();
        context.moveTo(segment.from.x * width, segment.from.y * height);
        context.lineTo(segment.to.x * width, segment.to.y * height);
        context.stroke();
    }

    function redrawWhiteboard() {
        const context = getWhiteboardContext();
        const canvas = elements.whiteboardCanvas;
        if (!context || !canvas) {
            return;
        }

        context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        state.whiteboardSegments.forEach(function (segment) {
            drawWhiteboardSegment(segment);
        });
    }

    function setWhiteboardSegments(segments) {
        state.whiteboardSegments = [];
        state.whiteboardSegmentIds.clear();

        (segments || []).forEach(function (segment) {
            if (!segment || !segment.id || state.whiteboardSegmentIds.has(segment.id)) {
                return;
            }
            state.whiteboardSegments.push(segment);
            state.whiteboardSegmentIds.add(segment.id);
        });

        redrawWhiteboard();
    }

    function addWhiteboardSegment(segment) {
        if (!segment || !segment.id || state.whiteboardSegmentIds.has(segment.id)) {
            return;
        }

        state.whiteboardSegments.push(segment);
        state.whiteboardSegmentIds.add(segment.id);

        if (state.whiteboardSegments.length > MAX_WHITEBOARD_SEGMENTS) {
            const overflow = state.whiteboardSegments.splice(0, state.whiteboardSegments.length - MAX_WHITEBOARD_SEGMENTS);
            overflow.forEach(function (item) {
                state.whiteboardSegmentIds.delete(item.id);
            });
            redrawWhiteboard();
            emitRoomEvent("whiteboard", {
                type: "draw",
                segment: segment,
                count: state.whiteboardSegments.length,
            });
            return;
        }

        drawWhiteboardSegment(segment);
        emitRoomEvent("whiteboard", {
            type: "draw",
            segment: segment,
            count: state.whiteboardSegments.length,
        });
    }

    function clearWhiteboardState(redraw) {
        state.whiteboardSegments = [];
        state.whiteboardSegmentIds.clear();
        if (redraw) {
            redrawWhiteboard();
        }
        emitRoomEvent("whiteboard", {
            type: "clear",
            count: 0,
        });
    }

    function getNormalizedPointerPoint(event) {
        const canvas = elements.whiteboardCanvas;
        if (!canvas) {
            return null;
        }

        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) {
            return null;
        }

        return {
            x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
            y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
        };
    }

    function startDrawing(event) {
        const point = getNormalizedPointerPoint(event);
        if (!point) {
            return;
        }

        state.drawing = true;
        state.lastDrawPoint = point;
    }

    function moveDrawing(event) {
        if (!state.drawing || !state.lastDrawPoint) {
            return;
        }

        const nextPoint = getNormalizedPointerPoint(event);
        if (!nextPoint) {
            return;
        }

        if (Math.abs(nextPoint.x - state.lastDrawPoint.x) < 0.001 && Math.abs(nextPoint.y - state.lastDrawPoint.y) < 0.001) {
            return;
        }

        const segment = {
            id: createId("seg"),
            from: state.lastDrawPoint,
            to: nextPoint,
            color: elements.whiteboardColor ? elements.whiteboardColor.value : "#1b4d3e",
            size: elements.whiteboardSize ? Number(elements.whiteboardSize.value || 4) : 4,
        };
        state.lastDrawPoint = nextPoint;

        addWhiteboardSegment(segment);
        sendSocketMessage({
            type: "whiteboard_draw",
            segment: segment,
        });
    }

    function stopDrawing() {
        state.drawing = false;
        state.lastDrawPoint = null;
    }

    function initializeWhiteboard() {
        if (!elements.whiteboardCanvas) {
            return;
        }

        resizeWhiteboardCanvas();
        elements.whiteboardCanvas.addEventListener("pointerdown", startDrawing);
        elements.whiteboardCanvas.addEventListener("pointermove", moveDrawing);
        elements.whiteboardCanvas.addEventListener("pointerup", stopDrawing);
        elements.whiteboardCanvas.addEventListener("pointerleave", stopDrawing);
        elements.whiteboardCanvas.addEventListener("pointercancel", stopDrawing);

        state.resizeHandler = function () {
            resizeWhiteboardCanvas();
        };
        window.addEventListener("resize", state.resizeHandler);
    }

    function openFilePicker() {
        if (!elements.fileInput) {
            return;
        }

        elements.fileInput.value = "";
        elements.fileInput.click();
    }

    function readFileAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function () {
                resolve(reader.result);
            };
            reader.onerror = function () {
                reject(new Error("Unable to read file"));
            };
            reader.readAsDataURL(file);
        });
    }

    async function shareSelectedFiles(event) {
        const selectedFiles = Array.from((event && event.target && event.target.files) || []);
        if (!selectedFiles.length) {
            return;
        }

        for (const file of selectedFiles) {
            if (file.size > MAX_FILE_SIZE_BYTES) {
                notify(file.name + " is larger than 2 MB.", "error");
                continue;
            }

            try {
                const content = await readFileAsDataUrl(file);
                const sharedFile = {
                    id: createId("file"),
                    name: file.name,
                    size: file.size,
                    mime: file.type || "application/octet-stream",
                    content: content,
                    participant_id: state.localParticipant.id,
                    participant: state.localParticipant,
                    shared_at: new Date().toISOString(),
                };

                const sent = sendSocketMessage({
                    type: "file_share",
                    file: sharedFile,
                });

                if (!sent) {
                    notify("File sharing is not connected yet.", "error");
                    continue;
                }

                addSharedFile(sharedFile);
                renderSharedFiles();
                notify(file.name + " shared successfully.", "success");
            } catch (error) {
                notify("Unable to share " + file.name + ".", "error");
            }
        }

        if (elements.fileInput) {
            elements.fileInput.value = "";
        }
    }

    function clearWhiteboardCanvas() {
        clearWhiteboardState(true);
        sendSocketMessage({ type: "whiteboard_clear" });
        notify("Whiteboard cleared.", "info");
    }

    function downloadWhiteboardCanvas() {
        if (!elements.whiteboardCanvas) {
            return;
        }

        const link = document.createElement("a");
        link.href = elements.whiteboardCanvas.toDataURL("image/png");
        link.download = "whiteboard-" + Date.now() + ".png";
        link.click();
    }

    function connectSocket() {
        const roomData = getRoomData();
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const roomCode = roomData.code || roomData.id;
        state.socket = new WebSocket(protocol + "://" + window.location.host + "/ws/meeting/" + roomCode + "/");
        window.chatSocket = state.socket;

        state.socket.onopen = function () {
            updateAiStatus("Connected", true);
            sendSocketMessage({
                type: "join",
                participant: state.localParticipant,
            });
        };

        state.socket.onmessage = async function (event) {
            const payload = JSON.parse(event.data);

            switch (payload.type) {
                case "participants_snapshot":
                    payload.participants.forEach(function (participant) {
                        upsertParticipant(participant);
                    });
                    break;
                case "participant_joined":
                    upsertParticipant(payload.participant);
                    notify((payload.participant && payload.participant.name ? payload.participant.name : "A participant") + " joined the meeting", "info");
                    await createOffer(payload.participant_id);
                    break;
                case "participant_left":
                    removeParticipant(payload.participant_id);
                    notify((payload.participant && payload.participant.name ? payload.participant.name : "A participant") + " left the meeting", "info");
                    break;
                case "offer":
                    await handleOffer(payload);
                    break;
                case "answer":
                    await handleAnswer(payload);
                    break;
                case "ice-candidate":
                    await handleIceCandidate(payload);
                    break;
                case "status":
                    upsertParticipant(payload.participant);
                    break;
                case "hand_raise":
                    upsertParticipant({
                        ...payload.participant,
                        hand_raised: payload.raised,
                    });
                    break;
                case "chat":
                    appendChatMessage(payload);
                    break;
                case "reaction":
                    showReaction(payload);
                    break;
                case "transcript":
                    appendTranscript(payload);
                    break;
                case "files_snapshot":
                    setSharedFiles(payload.files || []);
                    break;
                case "file_shared":
                    addSharedFile(payload.file);
                    renderSharedFiles();
                    break;
                case "whiteboard_snapshot":
                    setWhiteboardSegments(payload.segments || []);
                    break;
                case "whiteboard_draw":
                    addWhiteboardSegment(payload.segment);
                    break;
                case "whiteboard_clear":
                    clearWhiteboardState(true);
                    break;
                case "error":
                    notify(payload.message || "Something went wrong.", "error");
                    break;
                default:
                    break;
            }
        };

        state.socket.onclose = function () {
            updateAiStatus("Disconnected", false);
        };

        state.socket.onerror = function () {
            updateAiStatus("Connection error", false);
            notify("Realtime meeting connection failed.", "error");
        };
    }

    async function init() {
        if (state.initialized) {
            return;
        }

        state.initialized = true;
        cacheElements();
        initializeWhiteboard();

        const roomData = getRoomData();
        state.localParticipant = {
            id: roomData.userId,
            name: roomData.userName,
            avatar_url: roomData.avatarUrl,
            is_host: roomData.isHost || roomData.hostId === roomData.userId,
            mic_enabled: true,
            camera_enabled: true,
            hand_raised: false,
            screen_sharing: false,
        };

        renderParticipants();
        renderSharedFiles();
        updateAiStatus("Connecting...", false);

        await initializeLocalMedia();
        connectSocket();
        emitRoomEvent("initialized", getStateSnapshot());
    }

    async function toggleMic() {
        if (!state.localStream) {
            notify("Microphone is not available.", "error");
            return;
        }

        const track = state.localStream.getAudioTracks()[0];
        if (!track) {
            notify("Microphone is not available.", "error");
            return;
        }

        track.enabled = !track.enabled;
        state.localParticipant.mic_enabled = track.enabled;
        updateLocalControls();
        renderParticipants();
        broadcastStatus();
        notify(track.enabled ? "Microphone unmuted" : "Microphone muted", "info");
    }

    async function toggleCamera() {
        if (!state.localStream) {
            notify("Camera is not available.", "error");
            return;
        }

        const track = state.localStream.getVideoTracks()[0];
        if (!track) {
            notify("Camera is not available.", "error");
            return;
        }

        track.enabled = !track.enabled;
        state.localParticipant.camera_enabled = track.enabled;
        updateLocalControls();
        renderParticipants();
        broadcastStatus();
        notify(track.enabled ? "Camera turned on" : "Camera turned off", "info");
    }

    async function toggleScreenShare() {
        if (state.screenStream) {
            await stopScreenShare();
            return;
        }

        await startScreenShare();
    }

    function sendMessage() {
        if (!elements.chatInput) {
            return;
        }

        const message = elements.chatInput.value.trim();
        if (!message) {
            return;
        }

        const sent = sendSocketMessage({
            type: "chat",
            message: message,
        });

        if (!sent) {
            notify("Chat is not connected yet.", "error");
            return;
        }

        elements.chatInput.value = "";
    }

    function pushTranscript(text) {
        const cleanText = String(text || "").trim();
        if (!cleanText) {
            return;
        }

        sendSocketMessage({
            type: "transcript",
            text: cleanText,
        });
    }

    function cleanup() {
        if (state.socket) {
            state.socket.close();
            state.socket = null;
        }

        Object.keys(state.peerConnections).forEach(function (participantId) {
            closePeerConnection(participantId);
        });

        if (state.localStream) {
            state.localStream.getTracks().forEach(function (track) {
                track.stop();
            });
            state.localStream = null;
        }

        if (state.screenStream) {
            state.screenStream.getTracks().forEach(function (track) {
                track.stop();
            });
            state.screenStream = null;
        }

        if (state.resizeHandler) {
            window.removeEventListener("resize", state.resizeHandler);
            state.resizeHandler = null;
        }
    }

    window.roomMeeting = {
        init: init,
        pushTranscript: pushTranscript,
        cleanup: cleanup,
        resizeWhiteboard: resizeWhiteboardCanvas,
        getStateSnapshot: getStateSnapshot,
    };
    window.toggleMic = toggleMic;
    window.toggleCamera = toggleCamera;
    window.toggleScreenShare = toggleScreenShare;
    window.sendMessage = sendMessage;
    window.openFilePicker = openFilePicker;
    window.shareSelectedFiles = shareSelectedFiles;
    window.downloadSharedFile = downloadSharedFile;
    window.clearWhiteboardCanvas = clearWhiteboardCanvas;
    window.downloadWhiteboardCanvas = downloadWhiteboardCanvas;
})();
