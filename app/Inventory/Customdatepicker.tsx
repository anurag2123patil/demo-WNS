import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
} from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

interface CustomDatePickerProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (date: Date) => void;
    selectedDate: Date;
    theme: {
        text: string;
        cardColor: string;
        [key: string]: any;
    };
    isDark: boolean;
    /** Earliest selectable date (inclusive). Dates before this are disabled. */
    minDate?: Date;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
    visible,
    onClose,
    onSelect,
    selectedDate,
    theme,
    isDark,
    minDate,
}) => {
    const [viewDate, setViewDate] = useState(new Date(selectedDate));
    const [mode, setMode] = useState<"calendar" | "monthYear">("calendar");

    const subTextColor = isDark ? "#A1A1AA" : "#8E8E93";

    useEffect(() => {
        if (visible) {
            setViewDate(new Date(selectedDate));
            setMode("calendar");
        }
    }, [visible]);

    if (!visible) return null;

    const getDaysInMonth = (year: number, month: number) =>
        new Date(year, month + 1, 0).getDate();

    const getFirstDayOfMonth = (year: number, month: number) =>
        new Date(year, month, 1).getDay();

    const changeMonth = (increment: number) => {
        const d = new Date(viewDate);
        d.setMonth(d.getMonth() + increment);
        setViewDate(d);
    };

    const changeYear = (increment: number) => {
        const d = new Date(viewDate);
        d.setFullYear(d.getFullYear() + increment);
        setViewDate(d);
    };

    const selectMonth = (monthIndex: number) => {
        const d = new Date(viewDate);
        d.setMonth(monthIndex);
        setViewDate(d);
        setMode("calendar");
    };

    // ── Boundary helpers ─────────────────────────────────────────────────────
    // "today" ceiling — no future dates allowed
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Normalise minDate to start-of-day for clean comparisons
    const minDay = minDate ? new Date(minDate) : null;
    if (minDay) minDay.setHours(0, 0, 0, 0);

    /** Returns true when a given calendar Date should be disabled */
    const isDisabled = (d: Date): boolean => {
        // Future dates always disabled
        if (d > today) return true;
        // Before the earliest inward date (if provided)
        if (minDay && d < minDay) return true;
        return false;
    };

    // Prev-month arrow: disable when the entire previous month is before minDay
    const isPrevMonthDisabled = (): boolean => {
        if (!minDay) return false;
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        // Last day of previous month
        const lastOfPrev = new Date(year, month, 0);
        lastOfPrev.setHours(23, 59, 59, 999);
        return lastOfPrev < minDay;
    };

    // Next-month arrow: disable when next month starts after today
    const isNextMonthDisabled = (): boolean => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        return new Date(year, month + 1, 1) > new Date(today.getFullYear(), today.getMonth(), 1);
    };

    const renderCalendarView = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);

        const selDay = selectedDate.getDate();
        const selMonth = selectedDate.getMonth();
        const selYear = selectedDate.getFullYear();

        const cells: React.ReactNode[] = [];

        // Empty leading cells
        for (let i = 0; i < firstDay; i++) {
            cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateToCheck = new Date(year, month, day);
            dateToCheck.setHours(0, 0, 0, 0);
            const disabled = isDisabled(dateToCheck);

            const isSelected =
                !disabled &&
                day === selDay &&
                month === selMonth &&
                year === selYear;

            const isToday =
                day === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear();

            const _year = year;
            const _month = month;
            const _day = day;

            cells.push(
                <TouchableOpacity
                    key={day}
                    activeOpacity={disabled ? 1 : 0.7}
                    style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                        !isSelected && isToday && !disabled && styles.dayCellToday,
                        disabled && styles.dayCellDisabled,
                    ]}
                    onPress={() => {
                        if (disabled) return;
                        const picked = new Date(_year, _month, _day, 12, 0, 0, 0);
                        onSelect(picked);
                        onClose();
                    }}
                >
                    <Text
                        style={[
                            styles.dayText,
                            { color: theme.text },
                            isSelected && styles.dayTextSelected,
                            !isSelected && isToday && !disabled && styles.dayTextToday,
                            disabled && { color: isDark ? "#444" : "#C7C7CC" },
                        ]}
                    >
                        {day}
                    </Text>
                </TouchableOpacity>
            );
        }

        return (
            <>
                <View style={styles.calendarHeader}>
                    <TouchableOpacity
                        onPress={() => { if (!isPrevMonthDisabled()) changeMonth(-1); }}
                        style={[styles.arrowButton, isPrevMonthDisabled() && styles.arrowDisabled]}
                    >
                        <ChevronLeft size={24} color={theme.text} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setMode("monthYear")}>
                        <Text style={[styles.monthTitle, { color: theme.text }]}>
                            {viewDate.toLocaleString("default", {
                                month: "long",
                                year: "numeric",
                            })}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => { if (!isNextMonthDisabled()) changeMonth(1); }}
                        style={[styles.arrowButton, isNextMonthDisabled() && styles.arrowDisabled]}
                    >
                        <ChevronRight size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>

                {/* Min-date hint */}
                {minDay && (
                    <Text style={[styles.minDateHint, { color: subTextColor }]}>
                        📦 Stock available from{" "}
                        {minDay.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                        })}
                    </Text>
                )}

                <View style={styles.weekRow}>
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                        <Text key={d} style={[styles.weekText, { color: subTextColor }]}>
                            {d}
                        </Text>
                    ))}
                </View>

                <View style={styles.daysGrid}>{cells}</View>
            </>
        );
    };

    const renderMonthYearSelector = () => {
        const months = [
            "January", "February", "March", "April",
            "May", "June", "July", "August",
            "September", "October", "November", "December",
        ];

        return (
            <>
                <View style={styles.calendarHeader}>
                    <TouchableOpacity onPress={() => changeYear(-1)} style={styles.arrowButton}>
                        <ChevronLeft size={24} color={theme.text} />
                    </TouchableOpacity>

                    <Text style={[styles.monthTitle, { color: theme.text, fontSize: 22 }]}>
                        {viewDate.getFullYear()}
                    </Text>

                    <TouchableOpacity onPress={() => changeYear(1)} style={styles.arrowButton}>
                        <ChevronRight size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>

                <View style={styles.monthGrid}>
                    {months.map((m, index) => {
                        const isActive = viewDate.getMonth() === index;
                        return (
                            <TouchableOpacity
                                key={m}
                                style={[
                                    styles.monthButton,
                                    { borderColor: isDark ? "#3A3A3C" : "#E5E5EA" },
                                    isActive && styles.monthButtonActive,
                                ]}
                                onPress={() => selectMonth(index)}
                            >
                                <Text style={[styles.monthButtonText, { color: isActive ? "#fff" : theme.text }]}>
                                    {m.substring(0, 3)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <TouchableOpacity style={styles.backToCalendarBtn} onPress={() => setMode("calendar")}>
                    <Text style={styles.backToCalendarText}>Back to Calendar</Text>
                </TouchableOpacity>
            </>
        );
    };

    return (
        <View style={styles.overlay} pointerEvents="box-none">
            {/* Backdrop */}
            <TouchableOpacity
                style={StyleSheet.absoluteFillObject}
                activeOpacity={1}
                onPress={onClose}
            />

            {/* Calendar panel */}
            <View style={[styles.panel, { backgroundColor: theme.cardColor }]}>
                {mode === "calendar" ? renderCalendarView() : renderMonthYearSelector()}

                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                    <Text style={[styles.cancelText, { color: subTextColor }]}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default CustomDatePicker;

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
    },
    panel: {
        width: "85%",
        borderRadius: 18,
        padding: 15,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 10,
        zIndex: 10000,
    },
    calendarHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    monthTitle: {
        fontSize: 18,
        fontWeight: "700",
    },
    arrowButton: {
        padding: 5,
    },
    arrowDisabled: {
        opacity: 0.25,
    },
    minDateHint: {
        fontSize: 11,
        textAlign: "center",
        marginBottom: 8,
        fontStyle: "italic",
    },
    weekRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginBottom: 10,
    },
    weekText: {
        width: 30,
        textAlign: "center",
        fontSize: 12,
        fontWeight: "600",
    },
    daysGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
    },
    dayCell: {
        width: "14.28%",
        aspectRatio: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    dayCellSelected: {
        backgroundColor: "#007AFF",
        borderRadius: 8,
    },
    dayCellToday: {
        borderColor: "#007AFF",
        borderWidth: 1,
        borderRadius: 8,
    },
    dayCellDisabled: {
        opacity: 0.35,
    },
    dayText: {
        fontSize: 14,
    },
    dayTextSelected: {
        color: "#fff",
        fontWeight: "700",
    },
    dayTextToday: {
        color: "#007AFF",
        fontWeight: "bold",
    },
    cancelBtn: {
        marginTop: 10,
        alignItems: "center",
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: "#eee",
    },
    cancelText: {
        fontSize: 16,
    },
    monthGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
    },
    monthButton: {
        width: "30%",
        paddingVertical: 10,
        alignItems: "center",
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
    },
    monthButtonActive: {
        backgroundColor: "#007AFF",
        borderColor: "#007AFF",
    },
    monthButtonText: {
        fontSize: 14,
        fontWeight: "500",
    },
    backToCalendarBtn: {
        marginTop: 15,
        alignItems: "center",
    },
    backToCalendarText: {
        color: "#007AFF",
        fontSize: 14,
        fontWeight: "500",
    },
});