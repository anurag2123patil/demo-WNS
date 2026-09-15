// screens/GenericActivity.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    RefreshControl,
    LayoutAnimation,
    UIManager,
    Platform,
} from "react-native";
import {
    getStatusList,
    getActivityList,
    bulkUpdateStatus,
    extractErrorMsg,
    Activity,
    SubActivity,
    StatusItem,
    BulkUpdateItem,
} from "../../api/api_generic_activity";
import { Save, X } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/hooks/useAlert";
// import { useTheme } from "@/contexts/ThemeContext";
import { useTheme } from "../../contexts/ThemeContext";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─────────────────────────────────────────────────────────────────────────────
// Key helpers
// ─────────────────────────────────────────────────────────────────────────────

const actKey = (id: number) => `activity:${id}`;
const subKey = (id: number) => `subactivity:${id}`;

// ─────────────────────────────────────────────────────────────────────────────
// Status color helper
// ─────────────────────────────────────────────────────────────────────────────

function getStatusColor(statusName: string): string {
    const n = statusName.toLowerCase().trim();
    if (n.includes("complet") || n.includes("done") || n.includes("finish"))
        return "#22c55e";
    if (
        n.includes("ongoing") || n.includes("on going") ||
        n.includes("progress") || n.includes("running") ||
        n.includes("active") || n.includes("started") || n.includes("under")
    )
        return "#f97316";
    if (
        n.includes("pending") || n.includes("not start") ||
        n.includes("open") || n.includes("new") ||
        n.includes("waiting") || n.includes("hold") || n.includes("yet")
    )
        return "#ef4444";
    return "#6b7280";
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ statusId, statuses }: { statusId: number; statuses: StatusItem[] }) {
    const s = statuses.find((x) => x.status_id === statusId);
    if (!s) return null;
    const color = getStatusColor(s.status_name);
    return (
        <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.badgeText}>{s.status_name}</Text>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Button Group
// ─────────────────────────────────────────────────────────────────────────────

function StatusButtonGroup({
    value,
    statuses,
    onChange,
    disabled,
}: {
    value: number;
    statuses: StatusItem[];
    onChange: (id: number) => void;
    disabled: boolean;
}) {
    return (
        <View style={styles.statusButtonGroup}>
            {statuses.map((s) => {
                const isSelected = s.status_id === value;
                const mainColor = getStatusColor(s.status_name);
                const tintColor = isSelected ? mainColor : `${mainColor}18`;
                return (
                    <TouchableOpacity
                        key={s.status_id}
                        onPress={() => onChange(s.status_id)}
                        disabled={disabled}
                        style={[
                            styles.statusButton,
                            {
                                backgroundColor: tintColor,
                                borderColor: isSelected ? mainColor : "transparent",
                            },
                        ]}
                    >
                        <View style={[styles.statusDot, { backgroundColor: isSelected ? "#fff" : mainColor }]} />
                        <Text style={[styles.statusButtonText, { color: isSelected ? "#fff" : mainColor }]}>
                            {s.status_name}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress Bar
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ pct, theme }: { pct: number; theme: any }) {
    const barColor = pct === 100 ? "#22c55e" : pct > 50 ? "#f97316" : "#ef4444";
    return (
        <View style={styles.progressWrap}>
            <View style={styles.progressLabelRow}>
                <Text style={[styles.progressLabel, { color: theme.statsLabelColor }]}>
                    Sub-activity completion
                </Text>
                <Text style={[styles.progressValue, { color: theme.text }]}>{pct}%</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
            </View>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Activity Row
// ─────────────────────────────────────────────────────────────────────────────

function SubActivityRow({
    sub,
    statuses,
    defaultStatusId,
    draftStatusId,
    onDraftChange,
    saving,
    theme,
}: {
    sub: SubActivity;
    statuses: StatusItem[];
    defaultStatusId: number;
    draftStatusId: number;
    onDraftChange: (subId: number, statusId: number) => void;
    saving: boolean;
    theme: any;
}) {
    const originalStatusId = sub.status_id ?? defaultStatusId;
    const isDirty = draftStatusId !== originalStatusId;
    const { hasAccess } = useAuth();

    return (
        <View
            style={[
                styles.subRow,
                {
                    backgroundColor: isDirty
                        ? (theme.mode === "dark" ? "#2a2410" : "#fffbeb")
                        : theme.transCardBg,
                    borderColor: isDirty ? "#fcd34d" : theme.borderColor,
                    shadowColor: theme.cardShadow,
                },
            ]}
        >
            <View style={styles.subRowHeader}>
                <View style={[styles.subDot, { backgroundColor: theme.statsLabelColor }]} />
                <View style={styles.subInfo}>
                    <Text style={[styles.subName, { color: theme.text }]}>{sub.subactivity_name}</Text>
                    {sub.subactivity_description ? (
                        <Text style={[styles.subDesc, { color: theme.subTextColor }]}>
                            {sub.subactivity_description}
                        </Text>
                    ) : null}
                    <Text style={[styles.subWeight, { color: theme.subTextColor }]}>
                        Weightage:{" "}
                        <Text style={[styles.subWeightBold, { color: theme.text }]}>
                            {sub.subactivity_waitage}%
                        </Text>
                    </Text>
                </View>
            </View>

            {hasAccess("GENERIC_ACTIVITY_VIEW_UPDATE_STATUS") && (
                <View style={styles.statusActionArea}>
                    {/* {isDirty && (
                        <View
                            style={[
                                styles.dirtyRow,
                                {
                                    backgroundColor: theme.mode === "dark" ? "#1f1a08" : "#fff7ed",
                                    borderColor: "#fdba74",
                                },
                            ]}
                        >
                            <StatusBadge statusId={originalStatusId} statuses={statuses} />
                            <Text style={styles.arrowText}>→</Text>
                        </View>
                    )} */}
                    <StatusButtonGroup
                        value={draftStatusId}
                        statuses={statuses}
                        onChange={(id) => onDraftChange(sub.subactivity_id, id)}
                        disabled={saving}
                    />
                </View>
            )}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity Accordion Item
// ─────────────────────────────────────────────────────────────────────────────

function ActivityAccordionItem({
    activity,
    isOpen,
    onToggle,
    statuses,
    defaultStatusId,
    completedStatusId,
    drafts,
    onDraftChange,
    saving,
    theme,
}: {
    activity: Activity;
    isOpen: boolean;
    onToggle: () => void;
    statuses: StatusItem[];
    defaultStatusId: number;
    completedStatusId: number;
    drafts: Map<string, number>;
    onDraftChange: (type: "activity" | "subactivity", id: number, statusId: number) => void;
    saving: boolean;
    theme: any;
}) {
    const originalActivityStatus = activity.status_id ?? defaultStatusId;
    const draftActivityStatus = drafts.get(actKey(activity.activity_id)) ?? originalActivityStatus;
    const isActivityDirty = draftActivityStatus !== originalActivityStatus;
    const { hasWriteAccess } = useAuth();
    const { showAlert, AlertComponent } = useAlert();

    const dirtySubCount = activity.subactivities.filter((sub) => {
        const orig = sub.status_id ?? defaultStatusId;
        const draft = drafts.get(subKey(sub.subactivity_id));
        return draft !== undefined && draft !== orig;
    }).length;
    const totalDirty = dirtySubCount + (isActivityDirty ? 1 : 0);

    const allSubsCompleted = activity.subactivities.every((sub) => {
        const eff = drafts.get(subKey(sub.subactivity_id)) ?? (sub.status_id ?? defaultStatusId);
        return eff === completedStatusId;
    });

    const total = activity.subactivities.length;
    const doneCount = activity.subactivities.filter((sub) => {
        const eff = drafts.get(subKey(sub.subactivity_id)) ?? (sub.status_id ?? defaultStatusId);
        return eff === completedStatusId;
    }).length;
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    const handleActivityStatusChange = (newStatusId: number) => {
        if (newStatusId === completedStatusId && !allSubsCompleted) {
            showAlert(
                "Cannot Complete",
                "All sub-activities must be marked Completed before the activity can be completed.",
                "error"
            );
            return;
        }
        onDraftChange("activity", activity.activity_id, newStatusId);
    };

    const handleToggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onToggle();
    };

    const headerBg = isOpen
        ? theme.mode === "dark" ? "#1a2a35" : "#f0f9ff"
        : theme.surface;

    return (
        <>
            <View
                style={[
                    styles.accordion,
                    {
                        borderColor: isOpen ? "#67e8f9" : theme.borderColor,
                        backgroundColor: theme.surface,
                        shadowColor: theme.cardShadow,
                    },
                ]}
            >
                {/* Header */}
                <TouchableOpacity
                    onPress={handleToggle}
                    style={[styles.accordionHeader, { backgroundColor: headerBg }]}
                    activeOpacity={0.8}
                >
                    <View style={styles.accordionTitleRow}>
                        <Text style={[styles.chevron, { color: isOpen ? "#06b6d4" : theme.statsLabelColor }]}>
                            ▾
                        </Text>
                        <View style={styles.accordionTitleInfo}>
                            <Text style={[styles.activityName, { color: theme.text }]}>
                                {activity.activity_name}
                            </Text>
                            <View style={styles.activityMeta}>
                                <View style={[styles.pill, { backgroundColor: theme.surface2 }]}>
                                    <Text style={[styles.pillText, { color: theme.subTextColor }]}>
                                        {activity.activity_waitage}% weight
                                    </Text>
                                </View>
                                <View style={[styles.pill, { backgroundColor: theme.surface2 }]}>
                                    <Text style={[styles.pillText, { color: theme.subTextColor }]}>
                                        {activity.subactivities.length} sub-activities
                                    </Text>
                                </View>
                                {totalDirty > 0 && (
                                    <View style={styles.pillAmber}>
                                        <Text style={styles.pillAmberText}>{totalDirty} unsaved</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    {activity.activity_description ? (
                        <Text
                            style={[styles.activityDesc, { color: theme.subTextColor }]}
                            numberOfLines={1}
                        >
                            {activity.activity_description}
                        </Text>
                    ) : null}

                    {/* Activity status buttons */}
                    {hasWriteAccess("GENERIC_ACTIVITY_VIEW_UPDATE_STATUS") && (
                        <View style={styles.activityStatusRow}>
                           
                            <StatusButtonGroup
                                value={draftActivityStatus}
                                statuses={statuses}
                                onChange={handleActivityStatusChange}
                                disabled={saving}
                            />
                            {!allSubsCompleted && draftActivityStatus !== completedStatusId && (
                                <Text style={[styles.hintText, { color: theme.statsLabelColor }]}>
                                    ⓘ Complete all sub-activities to mark done
                                </Text>
                            )}
                        </View>
                    )}
                </TouchableOpacity>

                {/* Body */}
                {isOpen && (
                    <View
                        style={[
                            styles.accordionBody,
                            {
                                backgroundColor: theme.surface2,
                                borderTopColor: theme.borderColor,
                            },
                        ]}
                    >
                        {activity.subactivities.length === 0 ? (
                            <Text style={[styles.emptyText, { color: theme.subTextColor }]}>
                                No sub-activities defined
                            </Text>
                        ) : (
                            <>
                                <ProgressBar pct={pct} theme={theme} />
                                {activity.subactivities.map((sub) => (
                                    <SubActivityRow
                                        key={sub.subactivity_id}
                                        sub={sub}
                                        statuses={statuses}
                                        defaultStatusId={defaultStatusId}
                                        draftStatusId={
                                            drafts.get(subKey(sub.subactivity_id)) ??
                                            (sub.status_id ?? defaultStatusId)
                                        }
                                        onDraftChange={(subId, statusId) =>
                                            onDraftChange("subactivity", subId, statusId)
                                        }
                                        saving={saving}
                                        theme={theme}
                                    />
                                ))}
                            </>
                        )}
                    </View>
                )}
            </View>

            <AlertComponent />
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function GenericActivity() {
    const { theme } = useTheme();

    const [activities, setActivities] = useState<Activity[]>([]);
    const [statuses, setStatuses] = useState<StatusItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openActivityId, setOpenActivityId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [drafts, setDrafts] = useState<Map<string, number>>(new Map());

    const { showAlert, AlertComponent } = useAlert();

    // ── Derived ──────────────────────────────────────────────────────────────
    const defaultStatusId = statuses[0]?.status_id ?? 1;
    const completedStatusId =
        statuses.find((s) => s.status_name.toLowerCase().includes("complet"))?.status_id ?? -1;
    const totalChanges = drafts.size;
    const completedCount = activities.filter((a) => {
        const eff = drafts.get(actKey(a.activity_id)) ?? (a.status_id ?? defaultStatusId);
        return eff === completedStatusId;
    }).length;
    const totalWeightage = activities.reduce((sum, a) => sum + (a.activity_waitage ?? 0), 0);

    // ── Fetch ────────────────────────────────────────────────────────────────
    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const [statusRes, activityRes] = await Promise.all([
                getStatusList(),
                getActivityList(),
            ]);
            setStatuses(statusRes);
            const acts = activityRes?.activities ?? [];
            setActivities(acts);
            setOpenActivityId(acts.length > 0 ? acts[0].activity_id : null);
            setDrafts(new Map());
        } catch (e: any) {
            const msg = extractErrorMsg(e, "Failed to load activities");
            setError(msg);
            showAlert("Error", msg, "error");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ── Reset state on every screen focus ────────────────────────────────────
    // Clears unsaved draft changes so that stale status changes from a previous
    // project session are never shown when navigating back to this screen.
    useFocusEffect(
        useCallback(() => {
            setDrafts(new Map());
            fetchData();
        }, [fetchData])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchData(true);
    };

    // ── Draft helpers ────────────────────────────────────────────────────────
    const getOriginalStatus = useCallback(
        (type: "activity" | "subactivity", id: number): number => {
            if (type === "activity") {
                return activities.find((a) => a.activity_id === id)?.status_id ?? defaultStatusId;
            }
            for (const act of activities) {
                const sub = act.subactivities.find((s) => s.subactivity_id === id);
                if (sub) return sub.status_id ?? defaultStatusId;
            }
            return defaultStatusId;
        },
        [activities, defaultStatusId]
    );

    const handleDraftChange = (
        type: "activity" | "subactivity",
        id: number,
        statusId: number
    ) => {
        const key = type === "activity" ? actKey(id) : subKey(id);
        const original = getOriginalStatus(type, id);

        setDrafts((prev) => {
            const next = new Map(prev);
            statusId === original ? next.delete(key) : next.set(key, statusId);

            if (type === "subactivity" && statusId !== completedStatusId) {
                const parentActivity = activities.find((a) =>
                    a.subactivities.some((s) => s.subactivity_id === id)
                );
                if (parentActivity) {
                    const parentKey = actKey(parentActivity.activity_id);
                    const parentEffectiveStatus =
                        next.get(parentKey) ?? (parentActivity.status_id ?? defaultStatusId);

                    if (parentEffectiveStatus === completedStatusId) {
                        const fallbackStatus =
                            statuses.find(
                                (s) =>
                                    s.status_id !== completedStatusId &&
                                    (s.status_name.toLowerCase().includes("ongoing") ||
                                        s.status_name.toLowerCase().includes("progress"))
                            ) ?? statuses.find((s) => s.status_id !== completedStatusId);

                        if (fallbackStatus) {
                            const parentOriginal = getOriginalStatus("activity", parentActivity.activity_id);
                            fallbackStatus.status_id === parentOriginal
                                ? next.delete(parentKey)
                                : next.set(parentKey, fallbackStatus.status_id);

                            showAlert(
                                "Activity Reverted",
                                `"${parentActivity.activity_name}" was Completed but a sub-activity is now incomplete — activity status reverted to "${fallbackStatus.status_name}".`,
                                "warning"
                            );
                        }
                    }
                }
            }

            return next;
        });
    };

    // ── Save All ─────────────────────────────────────────────────────────────
    const handleSaveAll = async () => {
        if (!drafts.size) return;

        const blockedNames: string[] = [];
        for (const [key, statusId] of drafts.entries()) {
            if (!key.startsWith("activity:")) continue;
            const actId = Number(key.split(":")[1]);
            const activity = activities.find((a) => a.activity_id === actId);
            if (!activity || statusId !== completedStatusId) continue;
            const allDone = activity.subactivities.every((sub) => {
                const eff = drafts.get(subKey(sub.subactivity_id)) ?? (sub.status_id ?? defaultStatusId);
                return eff === completedStatusId;
            });
            if (!allDone) blockedNames.push(activity.activity_name);
        }

        if (blockedNames.length > 0) {
            showAlert(
                "Validation Error",
                `All sub-activities must be Completed first for:\n${blockedNames.map((n) => `• ${n}`).join("\n")}`,
                "error"
            );
            return;
        }

        const updates: BulkUpdateItem[] = Array.from(drafts.entries()).map(([key, status_id]) => {
            const [type, idStr] = key.split(":");
            return { type: type as "activity" | "subactivity", id: Number(idStr), status_id };
        });

        setSaving(true);
        try {
            const result = await bulkUpdateStatus(updates);
            if (result.errors?.length > 0) {
                const errMsgs = result.errors.map((e) => `• #${e.id}: ${e.message}`).join("\n");
                showAlert("Partial Error", `Some updates failed:\n${errMsgs}`, "error");
                const failedKeys = new Set(result.errors.map((e) => `${e.type}:${e.id}`));
                setDrafts((prev) => {
                    const next = new Map(prev);
                    failedKeys.forEach((k) => next.delete(k));
                    return next;
                });
            } else {
                showAlert("Success", "All status saved successfully", "success");
                setDrafts(new Map());
            }
            await fetchData(true);
        } catch (e: any) {
            showAlert("Error", extractErrorMsg(e, "Failed to save changes"), "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => {
        showAlert(
            "Discard Changes",
            "Are you sure you want to discard all unsaved changes?",
            "warning",
            [
                { text: "Cancel", style: "cancel" , onPress: () => {}},
                {
                    text: "Discard",
                    style: "destructive",
                    onPress: () => setDrafts(new Map()),
                },
            ]
        );
    };

    // ── Loading ──────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <View style={[styles.centered, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primaryColor} />
                <Text style={[styles.loadingText, { color: theme.subTextColor }]}>
                    Loading activities...
                </Text>
            </View>
        );
    }

    // ── Error ────────────────────────────────────────────────────────────────
    if (error) {
        return (
            <View style={[styles.centered, { backgroundColor: theme.background }]}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
                <TouchableOpacity
                    style={[styles.retryBtn, { backgroundColor: theme.primaryColor }]}
                    onPress={() => fetchData()}
                >
                    <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ── Main Render ──────────────────────────────────────────────────────────
    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[theme.primaryColor]}
                        tintColor={theme.primaryColor}
                    />
                }
            >
                {/* ── Header ─────────────────────────────────────────────── */}
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.title, { color: theme.heading }]}>Activity Management</Text>
                        <Text style={[styles.subtitle, { color: theme.subTextColor }]}>
                            Track and update status of activities
                        </Text>
                    </View>
                </View>

                {/* ── Stats Grid ─────────────────────────────────────────── */}
                {activities.length > 0 && (
                    <View style={styles.statsGrid}>
                        {[
                            { label: "Total", value: String(activities.length), color: theme.text },
                            { label: "Completed", value: String(completedCount), color: theme.success },
                            { label: "Total Weight", value: `${totalWeightage}%`, color: "#6366f1" },
                            {
                                label: "Unsaved",
                                value: String(totalChanges),
                                color: totalChanges > 0 ? theme.warning : theme.statsLabelColor,
                            },
                        ].map((stat) => (
                            <View
                                key={stat.label}
                                style={[
                                    styles.statCard,
                                    {
                                        backgroundColor: theme.cardColor,
                                        borderColor: theme.borderColor,
                                        shadowColor: theme.cardShadow,
                                    },
                                ]}
                            >
                                <Text style={[styles.statLabel, { color: theme.statsLabelColor }]}>
                                    {stat.label}
                                </Text>
                                <Text style={[styles.statValue, { color: stat.color }]}>
                                    {stat.value}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* ── Unsaved Banner ─────────────────────────────────────── */}
                {totalChanges > 0 && (
                    <View
                        style={[
                            styles.unsavedBanner,
                            {
                                backgroundColor: theme.mode === "dark" ? "#1c1608" : "#fffbeb",
                                borderColor: "#fcd34d",
                            },
                        ]}
                    >
                        <Text style={styles.unsavedText}>
                            ⚠️ {totalChanges} unsaved change{totalChanges !== 1 ? "s" : ""}
                        </Text>
                        <View style={styles.unsavedActions}>
                            <TouchableOpacity
                                style={[
                                    styles.discardBtn,
                                    {
                                        backgroundColor: theme.cancelBtnBg,
                                        borderColor: theme.cancelBtnBorder,
                                    },
                                ]}
                                onPress={handleDiscard}
                                disabled={saving}
                            >
                                <View style={styles.btnInner}>
                                    <X size={16} color={theme.cancelBtnText} />
                                    <Text style={[styles.discardBtnText, { color: theme.cancelBtnText }]}>
                                        Discard
                                    </Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                                onPress={handleSaveAll}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <View style={styles.btnInner}>
                                        <Save size={16} color="#FFF" />
                                        <Text style={styles.saveBtnText}>Save All Changes</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ── Activity List ──────────────────────────────────────── */}
                <View
                    style={[
                        styles.activityList,
                        {
                            backgroundColor: theme.cardColor,
                            borderColor: theme.borderColor,
                            shadowColor: theme.cardShadow,
                        },
                    ]}
                >
                    <View style={[styles.activityListHeader, { borderBottomColor: theme.borderColor }]}>
                        <Text style={[styles.activityListTitle, { color: theme.heading }]}>
                            Generic Activities
                        </Text>
                        <View style={[styles.pill, { backgroundColor: theme.surface2 }]}>
                            <Text style={[styles.pillText, { color: theme.subTextColor }]}>
                                {activities.length} activities
                            </Text>
                        </View>
                    </View>

                    {activities.length === 0 ? (
                        <Text style={[styles.emptyText, { color: theme.subTextColor }]}>
                            No activities found
                        </Text>
                    ) : (
                        activities.map((activity) => (
                            <ActivityAccordionItem
                                key={activity.activity_id}
                                activity={activity}
                                isOpen={openActivityId === activity.activity_id}
                                onToggle={() =>
                                    setOpenActivityId((prev) =>
                                        prev === activity.activity_id ? null : activity.activity_id
                                    )
                                }
                                statuses={statuses}
                                defaultStatusId={defaultStatusId}
                                completedStatusId={completedStatusId}
                                drafts={drafts}
                                onDraftChange={handleDraftChange}
                                saving={saving}
                                theme={theme}
                            />
                        ))
                    )}
                </View>

                {/* ── Validation Note ────────────────────────────────────── */}
                {activities.length > 0 && (
                    <View
                        style={[
                            styles.validationNote,
                            {
                                backgroundColor: theme.mode === "dark" ? "#0f1a2e" : "#eff6ff",
                                borderColor: theme.mode === "dark" ? "#1e3a5f" : "#bfdbfe",
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.validationText,
                                { color: theme.mode === "dark" ? "#93c5fd" : "#1d4ed8" },
                            ]}
                        >
                            ℹ️{" "}
                            <Text style={{ fontWeight: "bold" }}>Validation rule:</Text> A Generic Activity can
                            only be marked{" "}
                            <Text style={{ color: theme.success, fontWeight: "bold" }}>Completed</Text> when{" "}
                            <Text style={{ fontWeight: "bold" }}>all Sub-Activities</Text> are also Completed.
                            This is enforced both in the UI and at the server level.
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Global AlertComponent */}
            <AlertComponent />
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — layout & structure only; all colors applied inline via theme
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { padding: 16, paddingBottom: 32 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },

    // Loading / Error
    loadingText: { marginTop: 12, fontSize: 14 },
    errorIcon: { fontSize: 40 },
    errorText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
    retryBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    retryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

    // Header
    header: {
        flexDirection: "row", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 16,
    },
    title: { fontSize: 22, fontWeight: "800" },
    subtitle: { fontSize: 13, marginTop: 2 },

    // Stats
    statsGrid: {
        flexDirection: "row", flexWrap: "wrap",
        justifyContent: "space-between", marginBottom: 20, gap: 12,
    },
    statCard: {
        width: "48%", borderRadius: 16, padding: 16, borderWidth: 1,
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05,
        shadowRadius: 15, elevation: 2,
    },
    statLabel: { fontSize: 12, fontWeight: "600" },
    statValue: { fontSize: 20, fontWeight: "800", marginTop: 4 },

    // Unsaved banner
    unsavedBanner: {
        borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 14, gap: 10,
    },
    unsavedText: { fontSize: 14, fontWeight: "700", color: "#92400e" },
    unsavedActions: { flexDirection: "row", gap: 8 },
    btnInner: { flexDirection: "row", alignItems: "center", gap: 4 },
    discardBtn: {
        flex: 1, paddingVertical: 9, borderRadius: 8,
        borderWidth: 1, alignItems: "center", justifyContent: "center",
    },
    discardBtnText: { fontSize: 13, fontWeight: "600" },
    saveBtn: {
        flex: 1, paddingVertical: 9, borderRadius: 8,
        backgroundColor: "#06b6d4", alignItems: "center", justifyContent: "center",
        shadowColor: "#06b6d4", shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
    },
    saveBtnDisabled: { backgroundColor: "#9ca3af" },
    saveBtnText: { fontSize: 13, color: "#fff", fontWeight: "700" },

    // Activity list container
    activityList: {
        borderRadius: 14, borderWidth: 1, overflow: "hidden",
        marginBottom: 14, shadowOpacity: 0.04, shadowRadius: 4,
        elevation: 1, shadowOffset: { width: 0, height: 1 },
    },
    activityListHeader: {
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
    },
    activityListTitle: { fontSize: 15, fontWeight: "800" },

    // Pills
    pill: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
    pillText: { fontSize: 11, fontWeight: "600" },
    pillAmber: { backgroundColor: "#fef3c7", borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
    pillAmberText: { fontSize: 11, color: "#92400e", fontWeight: "700" },

    // Accordion
    accordion: {
        marginHorizontal: 12, marginBottom: 10, borderRadius: 12,
        borderWidth: 1, overflow: "hidden",
        shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
        shadowOffset: { width: 0, height: 2 },
    },
    accordionHeader: { padding: 14 },
    accordionTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    chevron: { fontSize: 18, marginTop: 1 },
    accordionTitleInfo: { flex: 1 },
    activityName: { fontSize: 15, fontWeight: "800", marginBottom: 6 },
    activityMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 },
    activityDesc: { fontSize: 12, marginLeft: 26, marginBottom: 6 },
    activityStatusRow: { marginLeft: 26, marginTop: 4, gap: 6 },
    accordionBody: { borderTopWidth: 1, padding: 14, gap: 10 },
    emptyText: { textAlign: "center", fontSize: 13, paddingVertical: 24 },

    // Status buttons
    statusButtonGroup: { flexDirection: "row", gap: 8, width: "100%" },
    statusButton: {
        flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
        paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, gap: 6,
    },
    statusDot: { width: 7, height: 7, borderRadius: 3.5 },
    statusButtonText: {
        fontSize: 11, fontWeight: "700", textTransform: "capitalize", letterSpacing: 0.3,
    },

    // Badge
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    badgeText: { fontSize: 10, fontWeight: "bold", color: "#fff" },

    // Sub-activity row
    subRow: {
        borderRadius: 10, borderWidth: 1, padding: 12, gap: 8,
        shadowOpacity: 0.03, elevation: 1, shadowOffset: { width: 0, height: 1 },
    },
    subRowHeader: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
    subDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
    subInfo: { flex: 1 },
    subName: { fontSize: 13, fontWeight: "700" },
    subDesc: { fontSize: 12, marginTop: 2 },
    subWeight: { fontSize: 11, marginTop: 2 },
    subWeightBold: { fontWeight: "700" },
    statusActionArea: { marginTop: 8, gap: 4 },

    // Dirty row
    dirtyRow: {
        flexDirection: "row", alignItems: "center", gap: 6,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
        alignSelf: "flex-start", borderWidth: 1, marginBottom: 4,
    },
    arrowText: { color: "#f97316", fontWeight: "900", fontSize: 16 },

    // Progress bar
    progressWrap: { marginBottom: 8 },
    progressLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    progressLabel: { fontSize: 12, fontWeight: "600" },
    progressValue: { fontSize: 12, fontWeight: "800" },
    progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 4 },

    // Hint
    hintText: { fontSize: 11, marginTop: 2 },

    // Validation note
    validationNote: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8 },
    validationText: { fontSize: 12, lineHeight: 18 },
});