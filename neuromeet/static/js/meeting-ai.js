(function () {
    const STOP_WORDS = new Set([
        "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has", "have", "i", "if",
        "in", "into", "is", "it", "its", "let", "me", "my", "of", "on", "or", "our", "so", "that", "the",
        "their", "them", "there", "they", "this", "to", "up", "we", "with", "you", "your", "will", "can",
        "could", "should", "would", "was", "were", "been", "about", "after", "before", "than", "then"
    ]);

    const POSITIVE_WORDS = ["good", "great", "nice", "excellent", "love", "ready", "clear", "done", "fixed", "resolved", "happy", "strong"];
    const NEGATIVE_WORDS = ["bad", "issue", "risk", "problem", "blocked", "delay", "stuck", "fail", "error", "concern", "urgent", "late"];
    const ACTION_WORDS = ["will", "need to", "needs to", "should", "must", "follow up", "action item", "assign", "owner", "deadline", "by ", "tomorrow", "today", "next week"];
    const HIGHLIGHT_WORDS = ["decision", "decide", "approved", "launch", "release", "milestone", "deadline", "blocker", "priority", "update", "next step", "owner", "risk"];
    const EMOTION_BUCKETS = [
        { label: "Focused", words: ["focus", "plan", "progress", "review", "update", "clarify"] },
        { label: "Positive", words: ["great", "nice", "love", "excellent", "thanks", "good"] },
        { label: "Concerned", words: ["issue", "risk", "problem", "blocked", "stuck", "delay"] },
        { label: "Urgent", words: ["urgent", "today", "asap", "immediately", "critical", "deadline"] },
        { label: "Collaborative", words: ["together", "team", "support", "help", "share", "sync"] },
    ];

    const TOPIC_LIBRARY = [
        { label: "Engineering", keywords: ["api", "backend", "frontend", "deploy", "code", "build", "bug", "fix", "server", "database", "webrtc"] },
        { label: "Product", keywords: ["feature", "roadmap", "user", "customer", "launch", "release", "adoption", "feedback"] },
        { label: "Design", keywords: ["design", "ui", "ux", "layout", "screen", "prototype", "flow", "brand"] },
        { label: "Quality", keywords: ["test", "qa", "defect", "regression", "coverage", "verify", "validation"] },
        { label: "Operations", keywords: ["timeline", "deadline", "budget", "process", "support", "handoff", "meeting", "ops"] },
        { label: "Sales", keywords: ["sales", "lead", "demo", "client", "pipeline", "marketing", "campaign", "proposal"] },
    ];

    const TRANSLATIONS = {
        ur: {
            phrases: [
                ["action item", "action item"],
                ["next steps", "aglay qadam"],
                ["follow up", "follow up"],
                ["meeting summary", "meeting ka khulasa"],
                ["meeting", "meeting"],
                ["summary", "khulasa"],
                ["decision", "faisla"],
                ["deadline", "deadline"],
                ["owner", "zimmedar shakhs"],
                ["highlight", "ahm nuqta"],
                ["risk", "khatra"],
                ["issue", "masla"],
                ["blocked", "rukawat mein"],
                ["approved", "manzoor"],
                ["launch", "launch"],
                ["please", "barah-e-karam"],
                ["today", "aaj"],
                ["tomorrow", "kal"],
                ["next week", "agle hafte"],
            ],
        },
        hi: {
            phrases: [
                ["action item", "karya bindu"],
                ["next steps", "agle kadam"],
                ["follow up", "follow up"],
                ["meeting summary", "meeting ka saar"],
                ["meeting", "meeting"],
                ["summary", "saar"],
                ["decision", "nirnay"],
                ["deadline", "samay seema"],
                ["owner", "zimmedar vyakti"],
                ["highlight", "mukhya bindu"],
                ["risk", "jokhim"],
                ["issue", "samasya"],
                ["blocked", "ruk gaya"],
                ["approved", "manzoor"],
                ["launch", "launch"],
                ["today", "aaj"],
                ["tomorrow", "kal"],
                ["next week", "agle hafte"],
            ],
        },
        ar: {
            phrases: [
                ["action item", "item amal"],
                ["next steps", "alkhatawat alttalia"],
                ["follow up", "mutabaea"],
                ["meeting summary", "mulakhas alijtimae"],
                ["meeting", "ijtimae"],
                ["summary", "mulakhas"],
                ["decision", "qarar"],
                ["deadline", "almuhla"],
                ["owner", "almasoul"],
                ["highlight", "nuqta muhimma"],
                ["risk", "mukhatarah"],
                ["issue", "mushkila"],
                ["blocked", "muataqal"],
                ["approved", "muwafaq"],
                ["today", "alyawm"],
                ["tomorrow", "ghadan"],
                ["next week", "alusbu alqadim"],
            ],
        },
        es: {
            phrases: [
                ["action item", "accion pendiente"],
                ["next steps", "siguientes pasos"],
                ["follow up", "seguimiento"],
                ["meeting summary", "resumen de la reunion"],
                ["meeting", "reunion"],
                ["summary", "resumen"],
                ["decision", "decision"],
                ["deadline", "fecha limite"],
                ["owner", "responsable"],
                ["highlight", "punto clave"],
                ["risk", "riesgo"],
                ["issue", "problema"],
                ["blocked", "bloqueado"],
                ["approved", "aprobado"],
                ["today", "hoy"],
                ["tomorrow", "manana"],
                ["next week", "la proxima semana"],
            ],
        },
        fr: {
            phrases: [
                ["action item", "action a faire"],
                ["next steps", "prochaines etapes"],
                ["follow up", "suivi"],
                ["meeting summary", "resume de reunion"],
                ["meeting", "reunion"],
                ["summary", "resume"],
                ["decision", "decision"],
                ["deadline", "echeance"],
                ["owner", "responsable"],
                ["highlight", "point cle"],
                ["risk", "risque"],
                ["issue", "probleme"],
                ["blocked", "bloque"],
                ["approved", "approuve"],
                ["today", "aujourd'hui"],
                ["tomorrow", "demain"],
                ["next week", "la semaine prochaine"],
            ],
        },
    };

    const state = {
        initialized: false,
        meetingStartedAt: Date.now(),
        participants: new Map(),
        stats: new Map(),
        attendance: new Map(),
        transcript: [],
        chat: [],
        highlights: [],
        actionItems: [],
        topics: [],
        recommendations: [],
        smartReplies: [],
        summary: "AI summary will appear as the meeting progresses.",
        sentiment: { label: "Neutral", score: 0, emotion: "Focused" },
        translation: { source: "en-US", target: "en", preview: "" },
        collaboration: { filesShared: 0, whiteboardEdits: 0, screenShares: 0 },
        assistantMessages: [],
        captions: { active: false, recognition: null, lastSubmitted: "", restarting: false },
        recording: { active: false, recorder: null, stream: null, chunks: [], markers: [], startedAt: 0, seenKeys: new Set() },
        noiseSuppressionEnabled: true,
        refreshTimer: null,
        attendanceTimer: null,
        vad: { context: null, intervalId: null, monitors: new Map() },
        lastEngagementAverage: 0,
    };

    const elements = {};

    function cacheElements() {
        elements.smartReplies = document.getElementById("smartReplies");
        elements.aiSummaryText = document.getElementById("aiSummaryText");
        elements.aiHighlightsList = document.getElementById("aiHighlightsList");
        elements.aiActionsList = document.getElementById("aiActionsList");
        elements.aiTopicsList = document.getElementById("aiTopicsList");
        elements.aiRecommendationsList = document.getElementById("aiRecommendationsList");
        elements.aiEngagementList = document.getElementById("aiEngagementList");
        elements.aiAttendanceList = document.getElementById("aiAttendanceList");
        elements.aiAttendanceChip = document.getElementById("aiAttendanceChip");
        elements.aiNotesSummary = document.getElementById("aiNotesSummary");
        elements.aiNotesHighlights = document.getElementById("aiNotesHighlights");
        elements.aiNotesActions = document.getElementById("aiNotesActions");
        elements.aiNotesTopics = document.getElementById("aiNotesTopics");
        elements.aiNotesStatusChip = document.getElementById("aiNotesStatusChip");
        elements.aiAssistantMessages = document.getElementById("aiAssistantMessages");
        elements.aiAssistantInput = document.getElementById("aiAssistantInput");
        elements.translationPreview = document.getElementById("translationPreview");
        elements.transcriptLanguageSelect = document.getElementById("transcriptLanguageSelect");
        elements.translationLanguageSelect = document.getElementById("translationLanguageSelect");
        elements.noiseSuppressionBtn = document.getElementById("noiseSuppressionBtn");
        elements.aiSentimentChip = document.getElementById("aiSentimentChip");
        elements.aiEmotionChip = document.getElementById("aiEmotionChip");
        elements.aiActionCountChip = document.getElementById("aiActionCountChip");
        elements.aiLanguageChip = document.getElementById("aiLanguageChip");
        elements.aiEngagementChip = document.getElementById("aiEngagementChip");
        elements.recordingStatusChip = document.getElementById("recordingStatusChip");
        elements.recordingIndexList = document.getElementById("recordingIndexList");
        elements.metricTurns = document.getElementById("metricTurns");
        elements.metricActions = document.getElementById("metricActions");
        elements.metricHighlights = document.getElementById("metricHighlights");
        elements.metricEngagement = document.getElementById("metricEngagement");
        elements.recordBtn = document.getElementById("recordBtn");
        elements.captionsBtn = document.getElementById("captionsBtn");
        elements.aiStatus = document.getElementById("aiStatus");
    }

    function notify(message, type) {
        if (typeof window.showToast === "function") {
            window.showToast(message, type || "info");
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

    function toTimestamp(value) {
        const parsed = new Date(value || Date.now()).getTime();
        return Number.isNaN(parsed) ? Date.now() : parsed;
    }

    function formatTime(value) {
        return new Date(toTimestamp(value)).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function createEntryId(prefix) {
        return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
    }

    function tokenize(text) {
        return String(text || "")
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, " ")
            .split(/\s+/)
            .filter(function (token) {
                return token && !STOP_WORDS.has(token);
            });
    }

    function topKeywords(text, limit) {
        const counts = {};
        tokenize(text).forEach(function (token) {
            counts[token] = (counts[token] || 0) + 1;
        });
        return Object.keys(counts)
            .sort(function (left, right) {
                return counts[right] - counts[left];
            })
            .slice(0, limit || 3);
    }

    function buildEmptyState(message) {
        return '<div class="empty-state compact">' + escapeHtml(message) + "</div>";
    }

    function setAiStatus(text, listening) {
        if (!elements.aiStatus) {
            return;
        }
        elements.aiStatus.textContent = text;
        elements.aiStatus.classList.toggle("listening", Boolean(listening));
    }

    function getLocalUserId() {
        return window.roomData && window.roomData.userId ? String(window.roomData.userId) : "local-user";
    }

    function getParticipantStat(participantId, name) {
        const id = String(participantId || "unknown");
        if (!state.stats.has(id)) {
            state.stats.set(id, {
                id: id,
                name: name || "Participant",
                transcriptTurns: 0,
                chatMessages: 0,
                reactions: 0,
                handRaises: 0,
                speakingTicks: 0,
                filesShared: 0,
                screenShares: 0,
                cameraEnabled: true,
                micEnabled: true,
                lastActiveAt: 0,
            });
        }
        const stats = state.stats.get(id);
        if (name) {
            stats.name = name;
        }
        return stats;
    }

    function getAttendanceRecord(participantId, name) {
        const id = String(participantId || "unknown");
        if (!state.attendance.has(id)) {
            state.attendance.set(id, {
                id: id,
                name: name || "Participant",
                firstSeenAt: Date.now(),
                currentJoinAt: Date.now(),
                lastSeenAt: Date.now(),
                leftAt: null,
                totalPresentMs: 0,
                sessions: 1,
                present: true,
            });
        }
        const record = state.attendance.get(id);
        if (name) {
            record.name = name;
        }
        return record;
    }

    function touchAttendance(participant) {
        if (!participant || !participant.id) {
            return;
        }

        const now = Date.now();
        const record = getAttendanceRecord(participant.id, participant.name);
        if (!record.present) {
            record.present = true;
            record.currentJoinAt = now;
            record.leftAt = null;
            record.sessions += 1;
        }
        record.lastSeenAt = now;
        if (!record.firstSeenAt) {
            record.firstSeenAt = now;
        }
    }

    function markAttendanceLeft(participantId) {
        const record = state.attendance.get(String(participantId));
        if (!record || !record.present) {
            return;
        }

        const now = Date.now();
        record.totalPresentMs += Math.max(0, now - (record.currentJoinAt || now));
        record.present = false;
        record.leftAt = now;
        record.lastSeenAt = now;
    }

    function getAttendanceDurationMs(record) {
        if (!record) {
            return 0;
        }
        return record.totalPresentMs + (record.present && record.currentJoinAt ? Math.max(0, Date.now() - record.currentJoinAt) : 0);
    }

    function formatDuration(durationMs) {
        const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
        }
        return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
    }

    function upsertParticipant(participant) {
        if (!participant || !participant.id) {
            return;
        }

        const id = String(participant.id);
        const existing = state.participants.get(id) || {};
        const merged = { ...existing, ...participant };
        state.participants.set(id, merged);

        const stats = getParticipantStat(id, merged.name);
        stats.cameraEnabled = merged.camera_enabled !== false;
        stats.micEnabled = merged.mic_enabled !== false;
        if (!existing.hand_raised && merged.hand_raised) {
            stats.handRaises += 1;
        }
        if (!existing.screen_sharing && merged.screen_sharing) {
            stats.screenShares += 1;
            state.collaboration.screenShares += 1;
        }
        touchAttendance(merged);
    }

    function removeParticipant(participantId) {
        const participant = state.participants.get(String(participantId));
        if (participant) {
            state.participants.set(String(participantId), { ...participant, present: false });
        }
        markAttendanceLeft(participantId);
    }

    function bootstrapState() {
        if (!window.roomMeeting || typeof window.roomMeeting.getStateSnapshot !== "function") {
            return;
        }

        const snapshot = window.roomMeeting.getStateSnapshot();
        if (snapshot.localParticipant) {
            upsertParticipant(snapshot.localParticipant);
        }
        (snapshot.participants || []).forEach(upsertParticipant);
        state.collaboration.filesShared = (snapshot.sharedFiles || []).length;
    }

    function bindUi() {
        if (elements.transcriptLanguageSelect) {
            elements.transcriptLanguageSelect.addEventListener("change", function () {
                state.translation.source = elements.transcriptLanguageSelect.value || "en-US";
                if (state.captions.active) {
                    stopCaptions(true);
                    startCaptions();
                }
            });
        }

        if (elements.translationLanguageSelect) {
            elements.translationLanguageSelect.addEventListener("change", function () {
                state.translation.target = elements.translationLanguageSelect.value || "en";
                renderLanguageChip();
                renderTranslationPreview(state.translation.preview);
                scheduleRefresh();
            });
        }
    }

    function subscribeToMeetingEvents() {
        document.addEventListener("room:initialized", function (event) {
            const detail = event.detail || {};
            if (detail.localParticipant) {
                upsertParticipant(detail.localParticipant);
            }
            (detail.participants || []).forEach(upsertParticipant);
            scheduleRefresh();
        });

        document.addEventListener("room:participant", function (event) {
            upsertParticipant(event.detail || {});
            scheduleRefresh();
        });

        document.addEventListener("room:participant-left", function (event) {
            removeParticipant(event.detail && event.detail.participant_id);
            scheduleRefresh();
        });

        document.addEventListener("room:chat", function (event) {
            const detail = event.detail || {};
            const entry = {
                id: createEntryId("chat"),
                type: "chat",
                participant_id: detail.participant_id || (detail.participant && detail.participant.id) || "",
                speaker: (detail.participant && detail.participant.name) || "Participant",
                text: String(detail.message || "").trim(),
                timestamp: detail.timestamp || new Date().toISOString(),
            };
            if (!entry.text) {
                return;
            }
            state.chat.push(entry);
            state.chat = state.chat.slice(-120);

            const stats = getParticipantStat(entry.participant_id || entry.speaker, entry.speaker);
            stats.chatMessages += 1;
            stats.lastActiveAt = toTimestamp(entry.timestamp);
            scheduleRefresh();
        });

        document.addEventListener("room:transcript", function (event) {
            const detail = event.detail || {};
            const entry = {
                id: createEntryId("transcript"),
                type: "transcript",
                participant_id: detail.participant_id || (detail.participant && detail.participant.id) || "",
                speaker: (detail.participant && detail.participant.name) || "Meeting",
                text: String(detail.text || "").trim(),
                timestamp: detail.timestamp || new Date().toISOString(),
            };
            if (!entry.text) {
                return;
            }
            state.transcript.push(entry);
            state.transcript = state.transcript.slice(-180);

            const stats = getParticipantStat(entry.participant_id || entry.speaker, entry.speaker);
            stats.transcriptTurns += 1;
            stats.lastActiveAt = toTimestamp(entry.timestamp);

            const translated = translateText(entry.text, state.translation.target);
            if (translated && translated !== entry.text) {
                state.translation.preview = translated;
                renderTranslationPreview(translated);
            }

            scheduleRefresh();
        });

        document.addEventListener("room:reaction", function (event) {
            const detail = event.detail || {};
            const participant = detail.participant || {};
            const participantId = detail.participant_id || participant.id || participant.name || "participant";
            const stats = getParticipantStat(participantId, participant.name || "Participant");
            stats.reactions += 1;
            stats.lastActiveAt = Date.now();
            scheduleRefresh();
        });

        document.addEventListener("room:file", function (event) {
            const detail = event.detail || {};
            state.collaboration.filesShared += 1;
            const participant = detail.participant || {};
            const participantId = detail.participant_id || participant.id || participant.name || "participant";
            const stats = getParticipantStat(participantId, participant.name || "Participant");
            stats.filesShared += 1;
            stats.lastActiveAt = Date.now();
            scheduleRefresh();
        });

        document.addEventListener("room:whiteboard", function (event) {
            const detail = event.detail || {};
            if (detail.type === "draw") {
                state.collaboration.whiteboardEdits += 1;
            }
            scheduleRefresh();
        });

        document.addEventListener("room:screen-share", function (event) {
            const detail = event.detail || {};
            if (detail.active) {
                state.collaboration.screenShares += 1;
                const participant = detail.participant || {};
                const stats = getParticipantStat(participant.id || participant.name || "participant", participant.name || "Participant");
                stats.screenShares += 1;
                stats.lastActiveAt = Date.now();
            }
            scheduleRefresh();
        });

        document.addEventListener("room:local-stream", function (event) {
            const detail = event.detail || {};
            if (detail.stream) {
                attachVadMonitor(getLocalUserId(), detail.stream, "localVideoWrapper");
            }
        });

        document.addEventListener("room:remote-stream", function (event) {
            const detail = event.detail || {};
            if (detail.stream && detail.participant_id) {
                attachVadMonitor(detail.participant_id, detail.stream, "participant-" + detail.participant_id);
            }
        });
    }

    function scheduleRefresh() {
        window.clearTimeout(state.refreshTimer);
        state.refreshTimer = window.setTimeout(refreshInsights, 80);
    }

    function getConversationEntries() {
        return state.transcript
            .concat(state.chat)
            .sort(function (left, right) {
                return toTimestamp(left.timestamp) - toTimestamp(right.timestamp);
            });
    }

    function scoreKeywords(text, keywordList) {
        const lower = String(text || "").toLowerCase();
        return keywordList.reduce(function (total, keyword) {
            return total + (lower.includes(keyword) ? 1 : 0);
        }, 0);
    }

    function analyzeSentiment(entries) {
        let score = 0;
        const emotionScores = {};

        entries.slice(-40).forEach(function (entry) {
            const text = entry.text || "";
            score += scoreKeywords(text, POSITIVE_WORDS);
            score -= scoreKeywords(text, NEGATIVE_WORDS);

            EMOTION_BUCKETS.forEach(function (bucket) {
                emotionScores[bucket.label] = (emotionScores[bucket.label] || 0) + scoreKeywords(text, bucket.words);
            });
        });

        const label = score > 3 ? "Positive" : score < -2 ? "At Risk" : "Neutral";
        const emotion = Object.keys(emotionScores).sort(function (left, right) {
            return (emotionScores[right] || 0) - (emotionScores[left] || 0);
        })[0] || "Focused";

        return { label: label, score: score, emotion: emotion };
    }

    function extractHighlights(entries) {
        return entries
            .slice(-50)
            .map(function (entry) {
                const text = entry.text || "";
                const score =
                    scoreKeywords(text, HIGHLIGHT_WORDS) +
                    (text.includes("?") ? 1 : 0) +
                    (text.length > 60 ? 1 : 0) +
                    Math.max(0, Math.abs(scoreKeywords(text, POSITIVE_WORDS) - scoreKeywords(text, NEGATIVE_WORDS)));

                return {
                    id: entry.id,
                    score: score,
                    title: text,
                    speaker: entry.speaker,
                    timestamp: entry.timestamp,
                    type: entry.type,
                };
            })
            .filter(function (item) {
                return item.title && item.score > 1;
            })
            .sort(function (left, right) {
                return right.score - left.score;
            })
            .filter(function (item, index, items) {
                return items.findIndex(function (candidate) {
                    return candidate.title.toLowerCase() === item.title.toLowerCase();
                }) === index;
            })
            .slice(0, 6);
    }

    function splitSentences(text) {
        return String(text || "")
            .split(/[.!?]/)
            .map(function (sentence) {
                return sentence.trim();
            })
            .filter(Boolean);
    }

    function extractDueDate(text) {
        const match = String(text || "").match(/\b(today|tomorrow|next week|this week|by [a-z0-9 -]+)\b/i);
        return match ? match[0] : "No due date";
    }

    function extractActionItems(entries) {
        const items = [];

        entries.slice(-60).forEach(function (entry) {
            splitSentences(entry.text).forEach(function (sentence) {
                const lower = sentence.toLowerCase();
                const isAction = ACTION_WORDS.some(function (word) {
                    return lower.includes(word);
                });
                if (!isAction || sentence.length < 12) {
                    return;
                }

                const ownerMatch = sentence.match(/([A-Z][a-z]+)\s+(will|should|needs to|must)/);
                const owner = ownerMatch ? ownerMatch[1] : entry.speaker;
                const due = extractDueDate(sentence);

                items.push({
                    id: createEntryId("action"),
                    title: sentence,
                    owner: owner || "Unassigned",
                    due: due,
                    speaker: entry.speaker,
                    timestamp: entry.timestamp,
                    priority: /urgent|today|asap|critical/i.test(sentence) ? "High" : due !== "No due date" ? "Medium" : "Open",
                });
            });
        });

        return items
            .filter(function (item, index, collection) {
                return collection.findIndex(function (candidate) {
                    return candidate.title.toLowerCase() === item.title.toLowerCase();
                }) === index;
            })
            .slice(0, 8);
    }

    function pickTopicLabel(text) {
        let bestLabel = "General";
        let bestScore = 0;

        TOPIC_LIBRARY.forEach(function (topic) {
            const score = scoreKeywords(text, topic.keywords);
            if (score > bestScore) {
                bestLabel = topic.label;
                bestScore = score;
            }
        });

        return bestLabel;
    }

    function extractTopics(entries) {
        const transcriptEntries = entries.filter(function (entry) {
            return entry.type === "transcript";
        });

        if (!transcriptEntries.length) {
            return [];
        }

        const segments = [];
        for (let index = 0; index < transcriptEntries.length; index += 4) {
            const chunk = transcriptEntries.slice(index, index + 4);
            const text = chunk.map(function (entry) {
                return entry.text;
            }).join(" ");
            segments.push({
                id: createEntryId("topic"),
                label: pickTopicLabel(text),
                text: text.slice(0, 220),
                keywords: topKeywords(text, 3),
                timestamp: chunk[chunk.length - 1].timestamp,
            });
        }

        return segments.slice(-5).reverse();
    }

    function computeEngagement() {
        const participants = Array.from(state.stats.values()).filter(function (stats) {
            return stats.name;
        });

        const result = participants
            .map(function (stats) {
                const score = Math.min(
                    100,
                    Math.round(
                        stats.transcriptTurns * 14 +
                            stats.chatMessages * 10 +
                            stats.reactions * 4 +
                            stats.handRaises * 8 +
                            stats.speakingTicks * 2 +
                            stats.filesShared * 6 +
                            stats.screenShares * 12 +
                            (stats.cameraEnabled ? 6 : 0) +
                            (stats.micEnabled ? 4 : 0)
                    )
                );

                return {
                    id: stats.id,
                    name: stats.name,
                    score: score,
                    transcriptTurns: stats.transcriptTurns,
                    chatMessages: stats.chatMessages,
                    reactions: stats.reactions,
                    speakingSeconds: Math.round(stats.speakingTicks * 0.25),
                };
            })
            .sort(function (left, right) {
                return right.score - left.score;
            });

        const average = result.length
            ? Math.round(result.reduce(function (total, item) {
                  return total + item.score;
              }, 0) / result.length)
            : 0;

        state.lastEngagementAverage = average;
        return result;
    }

    function buildSummary(entries, highlights, actionItems, topics, engagement) {
        if (!entries.length) {
            return "AI summary will appear as the meeting progresses.";
        }

        const primaryTopic = topics[0] ? topics[0].label : "general coordination";
        const topContributors = engagement.slice(0, 2).map(function (item) {
            return item.name;
        });
        const opener = "The discussion is currently centered on " + primaryTopic.toLowerCase() + ".";
        const contributors = topContributors.length
            ? topContributors.join(" and ") + " are driving most of the conversation."
            : "The meeting is still warming up.";
        const highlight = highlights[0] ? "Key moment: " + highlights[0].title : "No major highlight has been captured yet.";
        const actions = actionItems.length
            ? actionItems.length + " action item(s) are open, including " + actionItems[0].title + "."
            : "No clear action items have been confirmed yet.";
        return [opener, contributors, highlight, actions].join(" ");
    }

    function generateRecommendations(sentiment, engagement, actionItems, topics) {
        const suggestions = [];
        const quietParticipants = engagement.filter(function (item) {
            return item.score < 35;
        });

        if (actionItems.some(function (item) { return item.due === "No due date"; })) {
            suggestions.push("Assign due dates to open action items before the meeting ends.");
        }
        if (quietParticipants.length) {
            suggestions.push("Invite quieter participants to confirm blockers, risks, or dependencies.");
        }
        if (sentiment.label === "At Risk" || sentiment.emotion === "Concerned") {
            suggestions.push("Address blocker language explicitly and close with a risk owner.");
        }
        if (topics.length > 2) {
            suggestions.push("Send topic-based follow-up notes so decisions stay grouped by theme.");
        }
        if (!state.captions.active) {
            suggestions.push("Enable live captions to improve transcription, highlights, and action tracking.");
        }
        if (!state.recording.active && state.highlights.length >= 2) {
            suggestions.push("Start indexed recording now to preserve highlights with timestamps.");
        }
        if (!suggestions.length) {
            suggestions.push("The meeting is balanced so far. Keep confirming owners and next steps aloud.");
        }

        return suggestions.slice(0, 5);
    }

    function generateSmartReplies(entries, actionItems, topics) {
        const latestExternal = entries
            .slice()
            .reverse()
            .find(function (entry) {
                return entry.participant_id && entry.participant_id !== getLocalUserId();
            }) || entries[entries.length - 1];

        const topic = topics[0] ? topics[0].label : "this";
        const replies = [];

        if (!latestExternal) {
            replies.push("Let's capture the next steps.");
            replies.push("Can we confirm the owner for this?");
            replies.push("I'll summarize the key decisions.");
            return replies;
        }

        const text = String(latestExternal.text || "").toLowerCase();
        if (text.includes("?")) {
            replies.push("I'll take this and share an update after the meeting.");
            replies.push("Can we confirm the deadline before we close?");
            replies.push("Let's add the decision to the notes.");
        } else if (ACTION_WORDS.some(function (word) { return text.includes(word); })) {
            replies.push("Assigned to me. I'll update the group today.");
            replies.push("Let's capture the owner and due date now.");
            replies.push("Can we confirm if this is the top priority?");
        } else if (NEGATIVE_WORDS.some(function (word) { return text.includes(word); })) {
            replies.push("What's the main blocker here?");
            replies.push("Let's list the risk and the owner.");
            replies.push("Can we review the fallback plan before we close?");
        } else {
            replies.push("Let's align on the next step for " + topic.toLowerCase() + ".");
            replies.push("Can we turn that into a clear action item?");
            replies.push("I'll add that to the summary.");
        }

        if (actionItems.length) {
            replies.push("We already have " + actionItems.length + " open action item(s); let's confirm ownership.");
        }

        return replies.slice(0, 4);
    }

    function syncRecordingMarkers(highlights, actionItems) {
        if (!state.recording.active) {
            return;
        }

        highlights.forEach(function (highlight) {
            const key = "highlight:" + highlight.title.toLowerCase();
            if (!state.recording.seenKeys.has(key)) {
                state.recording.seenKeys.add(key);
                addRecordingMarker("Highlight", highlight.title);
            }
        });

        actionItems.forEach(function (item) {
            const key = "action:" + item.title.toLowerCase();
            if (!state.recording.seenKeys.has(key)) {
                state.recording.seenKeys.add(key);
                addRecordingMarker("Action", item.title);
            }
        });
    }

    function refreshInsights() {
        const entries = getConversationEntries();
        const sentiment = analyzeSentiment(entries);
        const highlights = extractHighlights(entries);
        const actionItems = extractActionItems(entries);
        const topics = extractTopics(entries);
        const engagement = computeEngagement();

        state.sentiment = sentiment;
        state.highlights = highlights;
        state.actionItems = actionItems;
        state.topics = topics;
        state.summary = buildSummary(entries, highlights, actionItems, topics, engagement);
        state.recommendations = generateRecommendations(sentiment, engagement, actionItems, topics);
        state.smartReplies = generateSmartReplies(entries, actionItems, topics);

        syncRecordingMarkers(highlights, actionItems);
        renderDashboard(engagement);
    }

    function renderDashboard(engagement) {
        if (elements.aiSummaryText) {
            elements.aiSummaryText.textContent = state.summary;
        }

        if (elements.metricTurns) {
            elements.metricTurns.textContent = String(state.transcript.length + state.chat.length);
        }
        if (elements.metricActions) {
            elements.metricActions.textContent = String(state.actionItems.length);
        }
        if (elements.metricHighlights) {
            elements.metricHighlights.textContent = String(state.highlights.length);
        }
        if (elements.metricEngagement) {
            elements.metricEngagement.textContent = String(state.lastEngagementAverage) + "%";
        }

        if (elements.aiSentimentChip) {
            elements.aiSentimentChip.textContent = state.sentiment.label;
        }
        if (elements.aiEmotionChip) {
            elements.aiEmotionChip.textContent = state.sentiment.emotion;
        }
        if (elements.aiActionCountChip) {
            elements.aiActionCountChip.textContent = String(state.actionItems.length) + " open";
        }
        if (elements.aiEngagementChip) {
            elements.aiEngagementChip.textContent = state.lastEngagementAverage >= 65 ? "High" : state.lastEngagementAverage >= 40 ? "Balanced" : "Low";
        }

        renderLanguageChip();
        renderHighlights();
        renderActions();
        renderTopics();
        renderRecommendations();
        renderEngagement(engagement);
        renderAttendance(engagement);
        renderAiNotesTab();
        renderSmartReplies();
        renderAssistantMessages();
        renderRecordingIndex();
    }

    function renderLanguageChip() {
        if (!elements.aiLanguageChip) {
            return;
        }
        elements.aiLanguageChip.textContent = (state.translation.target || "en").toUpperCase();
    }

    function renderHighlights() {
        if (!elements.aiHighlightsList) {
            return;
        }
        if (!state.highlights.length) {
            elements.aiHighlightsList.innerHTML = buildEmptyState("Key moments will appear here.");
            return;
        }

        elements.aiHighlightsList.innerHTML = state.highlights
            .map(function (item) {
                return (
                    '<div class="insight-item">' +
                    '<div class="insight-title">' + escapeHtml(item.title) + "</div>" +
                    '<div>' + escapeHtml(item.speaker) + "</div>" +
                    '<div class="insight-meta">' + escapeHtml(formatTime(item.timestamp)) + " . " + escapeHtml(item.type) + "</div>" +
                    "</div>"
                );
            })
            .join("");
    }

    function renderActions() {
        if (!elements.aiActionsList) {
            return;
        }
        if (!state.actionItems.length) {
            elements.aiActionsList.innerHTML = buildEmptyState("Action items will be extracted from the conversation.");
            return;
        }

        elements.aiActionsList.innerHTML = state.actionItems
            .map(function (item) {
                return (
                    '<div class="action-item">' +
                    '<div class="action-item-title">' + escapeHtml(item.title) + "</div>" +
                    '<div class="action-item-meta">Owner: ' + escapeHtml(item.owner) + " . Due: " + escapeHtml(item.due) + " . Priority: " + escapeHtml(item.priority) + "</div>" +
                    "</div>"
                );
            })
            .join("");
    }

    function renderTopics() {
        if (!elements.aiTopicsList) {
            return;
        }
        if (!state.topics.length) {
            elements.aiTopicsList.innerHTML = buildEmptyState("Topics will be classified as the meeting evolves.");
            return;
        }

        elements.aiTopicsList.innerHTML = state.topics
            .map(function (item) {
                return (
                    '<div class="topic-segment">' +
                    '<div class="topic-title">' + escapeHtml(item.label) + "</div>" +
                    '<div>' + escapeHtml(item.text) + "</div>" +
                    '<div class="topic-tags">' +
                    item.keywords
                        .map(function (keyword) {
                            return '<span class="topic-pill">' + escapeHtml(keyword) + "</span>";
                        })
                        .join("") +
                    "</div>" +
                    '<div class="recording-index-meta">' + escapeHtml(formatTime(item.timestamp)) + "</div>" +
                    "</div>"
                );
            })
            .join("");
    }

    function renderRecommendations() {
        if (!elements.aiRecommendationsList) {
            return;
        }
        elements.aiRecommendationsList.innerHTML = state.recommendations
            .map(function (item) {
                return '<div class="insight-item"><div>' + escapeHtml(item) + "</div></div>";
            })
            .join("");
    }

    function renderEngagement(engagement) {
        if (!elements.aiEngagementList) {
            return;
        }
        if (!engagement.length) {
            elements.aiEngagementList.innerHTML = buildEmptyState("Participant engagement will appear here.");
            return;
        }

        elements.aiEngagementList.innerHTML = engagement
            .map(function (item) {
                return (
                    '<div class="engagement-row">' +
                    '<div class="engagement-header"><span>' + escapeHtml(item.name) + "</span><span>" + escapeHtml(String(item.score)) + "%</span></div>" +
                    '<div class="engagement-bar"><div class="engagement-bar-fill" style="width:' + Math.max(4, item.score) + '%;"></div></div>' +
                    '<div class="engagement-meta">' +
                    "Turns: " + escapeHtml(String(item.transcriptTurns)) +
                    " . Chat: " + escapeHtml(String(item.chatMessages)) +
                    " . Reactions: " + escapeHtml(String(item.reactions)) +
                    " . Speaking: " + escapeHtml(String(item.speakingSeconds)) + "s" +
                    "</div></div>"
                );
            })
            .join("");
    }

    function buildAttendanceNote(record, engagementItem) {
        const joinedLate = record.firstSeenAt - state.meetingStartedAt > 2 * 60 * 1000;
        const presenceScore = engagementItem ? engagementItem.score : 0;

        if (!record.present) {
            return "Participant has left the room. Total attended time has been captured.";
        }
        if (joinedLate) {
            return "Joined after the meeting started. AI marked this attendee as late.";
        }
        if (presenceScore >= 70) {
            return "Highly engaged attendee based on speaking activity, chat, and live signals.";
        }
        if (presenceScore >= 40) {
            return "Steady attendee with moderate live participation.";
        }
        return "Present in the room with low visible activity so far.";
    }

    function renderAttendance(engagement) {
        if (!elements.aiAttendanceList) {
            return;
        }

        const engagementMap = new Map(
            (engagement || []).map(function (item) {
                return [String(item.id), item];
            })
        );
        const attendanceRows = Array.from(state.attendance.values()).sort(function (left, right) {
            if (left.present !== right.present) {
                return left.present ? -1 : 1;
            }
            return (left.firstSeenAt || 0) - (right.firstSeenAt || 0);
        });

        const presentCount = attendanceRows.filter(function (item) {
            return item.present;
        }).length;
        if (elements.aiAttendanceChip) {
            elements.aiAttendanceChip.textContent = presentCount + " present";
        }

        if (!attendanceRows.length) {
            elements.aiAttendanceList.innerHTML = buildEmptyState("Attendance tracking will appear as participants join.");
            return;
        }

        elements.aiAttendanceList.innerHTML = attendanceRows
            .map(function (record) {
                const engagementItem = engagementMap.get(String(record.id));
                const joinedLate = record.firstSeenAt - state.meetingStartedAt > 2 * 60 * 1000;
                const statusClass = record.present ? (joinedLate ? "late" : "present") : "left";
                const statusLabel = record.present ? (joinedLate ? "Late" : "Present") : "Left";

                return (
                    '<div class="attendance-row">' +
                    '<div class="attendance-header">' +
                    '<span class="attendance-name">' + escapeHtml(record.name) + "</span>" +
                    '<span class="attendance-badge ' + escapeHtml(statusClass) + '">' + escapeHtml(statusLabel) + "</span>" +
                    "</div>" +
                    '<div class="attendance-meta">' +
                    '<span>Joined: ' + escapeHtml(formatTime(record.firstSeenAt)) + "</span>" +
                    '<span>Duration: ' + escapeHtml(formatDuration(getAttendanceDurationMs(record))) + "</span>" +
                    '<span>Last seen: ' + escapeHtml(formatTime(record.lastSeenAt)) + "</span>" +
                    '<span>Sessions: ' + escapeHtml(String(record.sessions)) + "</span>" +
                    "</div>" +
                    '<div class="attendance-note">' + escapeHtml(buildAttendanceNote(record, engagementItem)) + "</div>" +
                    "</div>"
                );
            })
            .join("");
    }

    function renderAiNotesTab() {
        if (elements.aiNotesSummary) {
            elements.aiNotesSummary.textContent = state.summary;
        }

        if (elements.aiNotesStatusChip) {
            const hasNotes = state.highlights.length || state.actionItems.length || state.topics.length;
            elements.aiNotesStatusChip.textContent = hasNotes ? "Updated" : "Waiting";
        }

        if (elements.aiNotesHighlights) {
            if (!state.highlights.length) {
                elements.aiNotesHighlights.innerHTML = '<div class="ai-note-item">Highlights will appear here.</div>';
            } else {
                elements.aiNotesHighlights.innerHTML = state.highlights
                    .slice(0, 4)
                    .map(function (item) {
                        return '<div class="ai-note-item">' + escapeHtml(item.title) + "</div>";
                    })
                    .join("");
            }
        }

        if (elements.aiNotesActions) {
            if (!state.actionItems.length) {
                elements.aiNotesActions.innerHTML = '<div class="ai-note-item">Action items will appear here.</div>';
            } else {
                elements.aiNotesActions.innerHTML = state.actionItems
                    .slice(0, 4)
                    .map(function (item) {
                        return '<div class="ai-note-item">' + escapeHtml(item.title) + " | " + escapeHtml(item.owner) + "</div>";
                    })
                    .join("");
            }
        }

        if (elements.aiNotesTopics) {
            if (!state.topics.length) {
                elements.aiNotesTopics.innerHTML = '<div class="ai-note-item">Topics will appear here.</div>';
            } else {
                elements.aiNotesTopics.innerHTML = state.topics
                    .slice(0, 4)
                    .map(function (item) {
                        const keywords = item.keywords && item.keywords.length ? " | " + item.keywords.join(", ") : "";
                        return '<div class="ai-note-item">' + escapeHtml(item.label + keywords) + "</div>";
                    })
                    .join("");
            }
        }
    }

    function renderSmartReplies() {
        if (!elements.smartReplies) {
            return;
        }

        elements.smartReplies.innerHTML = "";
        state.smartReplies.forEach(function (reply) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "smart-reply-btn";
            button.textContent = reply;
            button.addEventListener("click", function () {
                sendSmartReply(reply);
            });
            elements.smartReplies.appendChild(button);
        });
    }

    function addAssistantMessage(role, text) {
        state.assistantMessages.push({
            id: createEntryId("assistant"),
            role: role,
            text: text,
        });
        state.assistantMessages = state.assistantMessages.slice(-24);
        renderAssistantMessages();
    }

    function renderAssistantMessages() {
        if (!elements.aiAssistantMessages) {
            return;
        }
        if (!state.assistantMessages.length) {
            elements.aiAssistantMessages.innerHTML = buildEmptyState("Ask NeuroMeet AI about the meeting.");
            return;
        }

        elements.aiAssistantMessages.innerHTML = state.assistantMessages
            .map(function (message) {
                return (
                    '<div class="assistant-message ' +
                    escapeHtml(message.role) +
                    '">' +
                    message.text
                        .split("\n")
                        .map(function (line) {
                            return escapeHtml(line);
                        })
                        .join("<br>") +
                    "</div>"
                );
            })
            .join("");
        elements.aiAssistantMessages.scrollTop = elements.aiAssistantMessages.scrollHeight;
    }

    function answerAssistant(question) {
        const prompt = String(question || "").toLowerCase();
        const engagement = computeEngagement();

        if (prompt.includes("summary")) {
            return state.summary;
        }
        if (prompt.includes("action")) {
            return state.actionItems.length
                ? "Open action items:\n" +
                      state.actionItems
                          .slice(0, 5)
                          .map(function (item, index) {
                              return index + 1 + ". " + item.title + " | Owner: " + item.owner + " | Due: " + item.due;
                          })
                          .join("\n")
                : "No action items have been extracted yet.";
        }
        if (prompt.includes("highlight") || prompt.includes("decision")) {
            return state.highlights.length
                ? "Top highlights:\n" +
                      state.highlights
                          .slice(0, 4)
                          .map(function (item, index) {
                              return index + 1 + ". " + item.title;
                          })
                          .join("\n")
                : "No strong highlights have been detected yet.";
        }
        if (prompt.includes("sentiment") || prompt.includes("emotion")) {
            return "Meeting sentiment is " + state.sentiment.label.toLowerCase() + " with a " + state.sentiment.emotion.toLowerCase() + " tone.";
        }
        if (prompt.includes("topic")) {
            return state.topics.length
                ? "Current topics: " +
                      state.topics
                          .slice(0, 4)
                          .map(function (item) {
                              return item.label;
                          })
                          .join(", ") +
                      "."
                : "Topic segmentation needs a few more transcript entries.";
        }
        if (prompt.includes("engagement") || prompt.includes("quiet") || prompt.includes("spoke")) {
            return engagement.length
                ? "Most engaged participants: " +
                      engagement
                          .slice(0, 3)
                          .map(function (item) {
                              return item.name + " (" + item.score + "%)";
                          })
                          .join(", ") +
                      "."
                : "Engagement data is still building.";
        }
        if (prompt.includes("attendance") || prompt.includes("present") || prompt.includes("late")) {
            const attendanceRows = Array.from(state.attendance.values());
            if (!attendanceRows.length) {
                return "Attendance data is still building.";
            }

            const presentCount = attendanceRows.filter(function (item) { return item.present; }).length;
            const lateNames = attendanceRows
                .filter(function (item) { return item.firstSeenAt - state.meetingStartedAt > 2 * 60 * 1000; })
                .map(function (item) { return item.name; });
            return presentCount + " participant(s) are currently present. " +
                (lateNames.length ? "Late joiners: " + lateNames.join(", ") + "." : "No late joiners detected yet.");
        }
        if (prompt.includes("recommend") || prompt.includes("next step")) {
            return state.recommendations.join(" ");
        }
        if (prompt.includes("record") || prompt.includes("index")) {
            return state.recording.markers.length
                ? "Indexed recording markers:\n" +
                      state.recording.markers
                          .slice(-5)
                          .map(function (item) {
                              return item.label + " at " + item.offsetLabel + ": " + item.text;
                          })
                          .join("\n")
                : "Recording markers will appear after recording starts and highlights are detected.";
        }
        if (prompt.includes("translate") || prompt.includes("language")) {
            return "Live translation target is set to " + (state.translation.target || "en").toUpperCase() + ". Latest preview: " + (state.translation.preview || "No translated line yet.");
        }

        return "I can answer questions about the meeting summary, action items, highlights, topics, engagement, sentiment, recording index, and live translation.";
    }

    function askAssistant() {
        if (!elements.aiAssistantInput) {
            return;
        }

        const question = elements.aiAssistantInput.value.trim();
        if (!question) {
            return;
        }

        addAssistantMessage("user", question);
        const answer = answerAssistant(question);
        addAssistantMessage("assistant", answer);
        elements.aiAssistantInput.value = "";
    }

    function translateText(text, target) {
        const sourceText = String(text || "").trim();
        if (!sourceText || !target || target === "en" || !TRANSLATIONS[target]) {
            return sourceText;
        }

        let translated = sourceText;
        TRANSLATIONS[target].phrases.forEach(function (pair) {
            const pattern = new RegExp(pair[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
            translated = translated.replace(pattern, pair[1]);
        });
        return translated;
    }

    function renderTranslationPreview(text) {
        if (!elements.translationPreview) {
            return;
        }

        if (!text) {
            elements.translationPreview.textContent = "Live translation preview will appear here when captions are enabled.";
            return;
        }

        elements.translationPreview.textContent = text;
    }

    function showLiveCaption(text) {
        const translated = translateText(text, state.translation.target);
        state.translation.preview = translated;
        renderTranslationPreview(translated);

        if (typeof window.showCaptions === "function") {
            window.showCaptions(translated === text ? text : text + " | " + translated);
        }
    }

    function stopCaptions(silent) {
        state.captions.active = false;
        state.captions.restarting = false;
        if (state.captions.recognition) {
            try {
                state.captions.recognition.onend = null;
                state.captions.recognition.stop();
            } catch (error) {
                // ignore browser stop errors
            }
            state.captions.recognition = null;
        }
        if (elements.captionsBtn) {
            elements.captionsBtn.classList.remove("active");
        }
        setAiStatus("Connected", true);
        if (!silent) {
            notify("Live captions stopped.", "info");
        }
    }

    function startCaptions() {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) {
            notify("Speech recognition is not supported in this browser.", "error");
            return;
        }

        const recognition = new Recognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = elements.transcriptLanguageSelect ? elements.transcriptLanguageSelect.value : state.translation.source;
        state.translation.source = recognition.lang;
        state.captions.active = true;
        state.captions.recognition = recognition;

        recognition.onresult = function (event) {
            for (let index = event.resultIndex; index < event.results.length; index += 1) {
                const result = event.results[index];
                const transcript = (result[0] && result[0].transcript ? result[0].transcript : "").trim();
                if (!transcript) {
                    continue;
                }

                showLiveCaption(transcript);

                if (result.isFinal && transcript !== state.captions.lastSubmitted) {
                    state.captions.lastSubmitted = transcript;
                    if (window.roomMeeting && typeof window.roomMeeting.pushTranscript === "function") {
                        window.roomMeeting.pushTranscript(transcript);
                    }
                }
            }
        };

        recognition.onerror = function () {
            notify("Live transcription encountered an error.", "error");
        };

        recognition.onend = function () {
            if (state.captions.active) {
                try {
                    recognition.start();
                } catch (error) {
                    state.captions.restarting = false;
                }
            }
        };

        try {
            recognition.start();
            if (elements.captionsBtn) {
                elements.captionsBtn.classList.add("active");
            }
            setAiStatus("Listening", true);
            notify("Live captions started.", "success");
        } catch (error) {
            notify("Unable to start live captions.", "error");
        }
    }

    function toggleCaptions() {
        if (state.captions.active) {
            stopCaptions();
            return;
        }
        startCaptions();
    }

    async function applyNoiseSuppression(enabled, silent) {
        state.noiseSuppressionEnabled = enabled;

        if (elements.noiseSuppressionBtn) {
            elements.noiseSuppressionBtn.classList.toggle("active", enabled);
            elements.noiseSuppressionBtn.innerHTML =
                '<i class="fas fa-wand-magic-sparkles"></i> ' + (enabled ? "Voice Enhanced" : "Voice Enhance");
        }

        if (!window.localStream) {
            return;
        }

        const audioTrack = window.localStream.getAudioTracks && window.localStream.getAudioTracks()[0];
        if (!audioTrack || typeof audioTrack.applyConstraints !== "function") {
            return;
        }

        try {
            await audioTrack.applyConstraints({
                echoCancellation: enabled,
                noiseSuppression: enabled,
                autoGainControl: enabled,
            });
            if (!silent) {
                notify(enabled ? "Voice enhancement enabled." : "Voice enhancement disabled.", "info");
            }
        } catch (error) {
            notify("Voice enhancement could not be updated for this device.", "error");
        }
    }

    function toggleNoiseSuppression() {
        applyNoiseSuppression(!state.noiseSuppressionEnabled, false);
    }

    function ensureAudioContext() {
        if (!state.vad.context) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                return null;
            }
            state.vad.context = new AudioContextClass();
        }

        if (state.vad.context.state === "suspended") {
            state.vad.context.resume().catch(function () {
                return null;
            });
        }

        return state.vad.context;
    }

    function attachVadMonitor(participantId, stream, wrapperId) {
        const context = ensureAudioContext();
        if (!context || !stream || !stream.getAudioTracks || !stream.getAudioTracks().length) {
            return;
        }

        if (state.vad.monitors.has(String(participantId))) {
            return;
        }

        try {
            const audioStream = new MediaStream(stream.getAudioTracks());
            const source = context.createMediaStreamSource(audioStream);
            const analyser = context.createAnalyser();
            analyser.fftSize = 512;
            source.connect(analyser);
            state.vad.monitors.set(String(participantId), {
                analyser: analyser,
                data: new Uint8Array(analyser.fftSize),
                wrapperId: wrapperId,
                participantId: String(participantId),
                speaking: false,
            });

            if (!state.vad.intervalId) {
                state.vad.intervalId = window.setInterval(sampleVadLevels, 250);
            }
        } catch (error) {
            // ignore media graph failures
        }
    }

    function sampleVadLevels() {
        state.vad.monitors.forEach(function (monitor) {
            monitor.analyser.getByteTimeDomainData(monitor.data);
            let sum = 0;
            for (let index = 0; index < monitor.data.length; index += 1) {
                const normalized = (monitor.data[index] - 128) / 128;
                sum += normalized * normalized;
            }

            const rms = Math.sqrt(sum / monitor.data.length);
            const speaking = rms > 0.045;
            const wrapper = document.getElementById(monitor.wrapperId);
            if (wrapper) {
                wrapper.classList.toggle("speaking", speaking);
            }

            if (speaking) {
                const participant = state.participants.get(monitor.participantId);
                const stats = getParticipantStat(monitor.participantId, participant && participant.name ? participant.name : "Participant");
                stats.speakingTicks += 1;
                stats.lastActiveAt = Date.now();
            }
        });

        scheduleRefresh();
    }

    function addRecordingMarker(label, text) {
        if (!state.recording.active) {
            return;
        }

        const offsetMs = Date.now() - state.recording.startedAt;
        const totalSeconds = Math.max(0, Math.floor(offsetMs / 1000));
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
        const seconds = String(totalSeconds % 60).padStart(2, "0");

        state.recording.markers.push({
            id: createEntryId("marker"),
            label: label,
            text: text,
            offsetSeconds: totalSeconds,
            offsetLabel: minutes + ":" + seconds,
        });
        renderRecordingIndex();
    }

    function renderRecordingIndex() {
        if (!elements.recordingIndexList) {
            return;
        }

        if (!state.recording.markers.length) {
            elements.recordingIndexList.innerHTML = buildEmptyState("Start recording to build an indexed highlight timeline.");
            return;
        }

        elements.recordingIndexList.innerHTML = state.recording.markers
            .map(function (item) {
                return (
                    '<div class="recording-index-item">' +
                    '<div class="topic-title">' + escapeHtml(item.label) + ": " + escapeHtml(item.text) + "</div>" +
                    '<div class="recording-index-meta">' + escapeHtml(item.offsetLabel) + "</div>" +
                    "</div>"
                );
            })
            .join("");
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        window.setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 500);
    }

    function exportAttendanceReport() {
        const engagement = computeEngagement();
        const engagementMap = new Map(
            engagement.map(function (item) {
                return [String(item.id), item];
            })
        );
        const rows = Array.from(state.attendance.values());

        if (!rows.length) {
            notify("Attendance report is not ready yet.", "info");
            return;
        }

        const header = ["Name", "Status", "Joined At", "Last Seen", "Duration", "Sessions", "Late", "Engagement Score"];
        const csvRows = rows.map(function (record) {
            const joinedLate = record.firstSeenAt - state.meetingStartedAt > 2 * 60 * 1000;
            const engagementItem = engagementMap.get(String(record.id));
            return [
                '"' + String(record.name || "Participant").replace(/"/g, '""') + '"',
                '"' + (record.present ? (joinedLate ? "Late" : "Present") : "Left") + '"',
                '"' + new Date(record.firstSeenAt).toISOString() + '"',
                '"' + new Date(record.lastSeenAt).toISOString() + '"',
                '"' + formatDuration(getAttendanceDurationMs(record)) + '"',
                '"' + String(record.sessions) + '"',
                '"' + (joinedLate ? "Yes" : "No") + '"',
                '"' + String(engagementItem ? engagementItem.score : 0) + '"',
            ].join(",");
        });

        const csv = [header.join(","), csvRows.join("\n")].join("\n");
        downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "attendance-report-" + Date.now() + ".csv");
        notify("Attendance report exported.", "success");
    }

    function exportAiNotes() {
        const sections = [
            "AI Notes",
            "",
            "Summary",
            state.summary || "No summary yet.",
            "",
            "Highlights",
            state.highlights.length
                ? state.highlights
                      .slice(0, 6)
                      .map(function (item, index) {
                          return index + 1 + ". " + item.title;
                      })
                      .join("\n")
                : "No highlights yet.",
            "",
            "Action Items",
            state.actionItems.length
                ? state.actionItems
                      .slice(0, 6)
                      .map(function (item, index) {
                          return index + 1 + ". " + item.title + " | Owner: " + item.owner + " | Due: " + item.due;
                      })
                      .join("\n")
                : "No action items yet.",
            "",
            "Topics",
            state.topics.length
                ? state.topics
                      .slice(0, 6)
                      .map(function (item, index) {
                          return index + 1 + ". " + item.label + (item.keywords && item.keywords.length ? " | " + item.keywords.join(", ") : "");
                      })
                      .join("\n")
                : "No topics yet.",
            "",
            "Generated At",
            new Date().toISOString(),
        ];

        downloadBlob(new Blob([sections.join("\n")], { type: "text/plain;charset=utf-8;" }), "ai-notes-" + Date.now() + ".txt");
        notify("AI notes exported.", "success");
    }

    function stopRecording() {
        if (!state.recording.active || !state.recording.recorder) {
            return;
        }

        state.recording.active = false;
        if (elements.recordBtn) {
            elements.recordBtn.classList.remove("active");
            elements.recordBtn.style.color = "";
        }
        if (elements.recordingStatusChip) {
            elements.recordingStatusChip.textContent = "Saving";
        }

        state.recording.recorder.stop();
    }

    async function startRecording() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || typeof MediaRecorder === "undefined") {
            notify("Recording is not supported in this browser.", "error");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            const recorder = new MediaRecorder(stream);
            state.recording.active = true;
            state.recording.recorder = recorder;
            state.recording.stream = stream;
            state.recording.chunks = [];
            state.recording.markers = [];
            state.recording.seenKeys = new Set();
            state.recording.startedAt = Date.now();

            recorder.ondataavailable = function (event) {
                if (event.data && event.data.size) {
                    state.recording.chunks.push(event.data);
                }
            };

            recorder.onstop = function () {
                const blob = new Blob(state.recording.chunks, { type: "video/webm" });
                downloadBlob(blob, "meeting-" + Date.now() + ".webm");

                const manifest = JSON.stringify(
                    {
                        room: window.roomData && window.roomData.name,
                        generated_at: new Date().toISOString(),
                        markers: state.recording.markers,
                    },
                    null,
                    2
                );
                downloadBlob(new Blob([manifest], { type: "application/json" }), "meeting-index-" + Date.now() + ".json");

                if (state.recording.stream) {
                    state.recording.stream.getTracks().forEach(function (track) {
                        track.stop();
                    });
                }

                state.recording.recorder = null;
                state.recording.stream = null;
                state.recording.chunks = [];
                if (elements.recordingStatusChip) {
                    elements.recordingStatusChip.textContent = "Saved";
                }
                notify("Recording and index saved.", "success");
                renderRecordingIndex();
            };

            recorder.start();
            if (elements.recordBtn) {
                elements.recordBtn.classList.add("active");
                elements.recordBtn.style.color = "var(--error-red)";
            }
            if (elements.recordingStatusChip) {
                elements.recordingStatusChip.textContent = "Recording";
            }
            addRecordingMarker("System", "Indexed recording started");
            notify("Indexed recording started.", "success");
        } catch (error) {
            notify("Unable to start indexed recording.", "error");
        }
    }

    function toggleRecording() {
        if (state.recording.active) {
            stopRecording();
            return;
        }
        startRecording();
    }

    function sendSmartReply(reply) {
        const input = document.getElementById("chatInput");
        if (!input) {
            return;
        }
        input.value = reply;
        if (typeof window.sendMessage === "function") {
            window.sendMessage();
        }
    }

    function cleanup() {
        stopCaptions(true);
        if (state.recording.active) {
            stopRecording();
        }
        if (state.attendanceTimer) {
            window.clearInterval(state.attendanceTimer);
            state.attendanceTimer = null;
        }
        if (state.vad.intervalId) {
            window.clearInterval(state.vad.intervalId);
            state.vad.intervalId = null;
        }
        state.vad.monitors.clear();
    }

    function init() {
        if (state.initialized) {
            return;
        }

        state.initialized = true;
        cacheElements();
        bootstrapState();
        bindUi();
        subscribeToMeetingEvents();

        if (elements.translationLanguageSelect) {
            state.translation.target = elements.translationLanguageSelect.value || "en";
        }
        if (elements.transcriptLanguageSelect) {
            state.translation.source = elements.transcriptLanguageSelect.value || "en-US";
        }

        addAssistantMessage("assistant", "NeuroMeet AI is ready. Ask for a summary, action items, sentiment, topics, engagement, or recording index.");
        applyNoiseSuppression(true, true);
        renderTranslationPreview("");
        refreshInsights();
        setAiStatus("Connected", true);

        state.attendanceTimer = window.setInterval(function () {
            scheduleRefresh();
        }, 15000);
    }

    window.roomAI = {
        init: init,
        toggleCaptions: toggleCaptions,
        toggleRecording: toggleRecording,
        toggleNoiseSuppression: toggleNoiseSuppression,
        askAssistant: askAssistant,
        sendSmartReply: sendSmartReply,
        exportAttendanceReport: exportAttendanceReport,
        exportAiNotes: exportAiNotes,
        cleanup: cleanup,
    };

})();
