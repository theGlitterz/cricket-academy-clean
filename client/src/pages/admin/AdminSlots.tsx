/**
 * AdminSlots — Slot management page for the coach.
 * Create individual slots, bulk-create a day's schedule, block/unblock, and delete slots.
 */
import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus,
  Lock,
  Unlock,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AdminLayout from "./AdminLayout";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = (h ?? 0) >= 12 ? "PM" : "AM";
  const hour = (h ?? 0) % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Get current date string in IST (YYYY-MM-DD) */
function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Add days to a YYYY-MM-DD string, returns YYYY-MM-DD in IST */
function addDaysToDateStr(dateStr: string, days: number): string {
  // Parse as noon IST to avoid any DST/midnight edge cases
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = new Date(Date.UTC((y ?? 0), (m ?? 1) - 1, (d ?? 1), 6, 30, 0)); // 06:30 UTC = 12:00 IST
  base.setUTCDate(base.getUTCDate() + days);
  return base.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** Legacy helper kept for bulk date range calc */
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function toDateStr(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}


function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Add minutes to a HH:MM string, returns HH:MM */
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Generate time slots for a day based on service duration */
function generateTimeSlots(durationMinutes: number): { startTime: string; endTime: string }[] {
  // Morning: 06:00 to 10:00, Evening: 15:00 to 21:00
  const windows = [
    { from: "06:00", to: "10:00" },
    { from: "15:00", to: "21:00" },
  ];
  const result: { startTime: string; endTime: string }[] = [];
  for (const w of windows) {
    let cur = w.from;
    while (true) {
      const end = addMinutesToTime(cur, durationMinutes);
      // Stop if end exceeds window end
      const [eh, em] = end.split(":").map(Number);
      const [wh, wm] = w.to.split(":").map(Number);
      if ((eh ?? 0) * 60 + (em ?? 0) > (wh ?? 0) * 60 + (wm ?? 0)) break;
      result.push({ startTime: cur, endTime: end });
      cur = end;
    }
  }
  return result;
}

const AVAIL_CARD_CSS: Record<string, string> = {
  available: "border-green-200 bg-green-50/30",
  booked: "border-blue-200 bg-blue-50/30",
  blocked: "border-red-200 bg-red-50/30",
};

const AVAIL_BADGE_CSS: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  booked: "bg-blue-100 text-blue-800",
  blocked: "bg-red-100 text-red-600",
};

const AVAIL_LABEL: Record<string, string> = {
  available: "Available",
  booked: "Booked",
  blocked: "Blocked",
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminSlots() {
  const today = useMemo(() => todayIST(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  // ── Bulk selection state ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });


  // Single slot form
  const [newServiceId, setNewServiceId] = useState("");
  const [newDate, setNewDate] = useState(today);
  const [newStart, setNewStart] = useState("06:00");
  const [newCapacity, setNewCapacity] = useState("1");

  // Bulk form
  const [bulkServiceId, setBulkServiceId] = useState("");
  const [bulkFromDate, setBulkFromDate] = useState(today);
  const [bulkToDate, setBulkToDate] = useState(addDaysToDateStr(today, 6));


  const utils = trpc.useUtils();

  const { data: services } = trpc.services.listAll.useQuery();
  const { data: slots, isLoading } = trpc.slots.getByDate.useQuery({ date: selectedDate });

  // Derive selected service objects for duration lookup
  const selectedService = services?.find((s) => String(s.id) === newServiceId);
  const bulkService = services?.find((s) => String(s.id) === bulkServiceId);

  // Auto-calculated end time for single slot
  const computedEndTime = selectedService
    ? addMinutesToTime(newStart, selectedService.durationMinutes)
    : addMinutesToTime(newStart, 60);

  // Preview of bulk slots count
  const bulkTimeSlots = bulkService
    ? generateTimeSlots(bulkService.durationMinutes)
    : generateTimeSlots(60);

  const bulkDayCount = useMemo(() => {
    const from = new Date(bulkFromDate + "T00:00:00");
    const to = new Date(bulkToDate + "T00:00:00");
    const diff = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    return Math.max(1, diff);
  }, [bulkFromDate, bulkToDate]);

  const createSlotMutation = trpc.slots.create.useMutation({
    onSuccess: () => {
      toast.success("Slot created!");
      setCreateOpen(false);
      utils.slots.getByDate.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const setBlockedMutation = trpc.slots.setBlocked.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.blocked ? "Slot blocked." : "Slot unblocked.");
      utils.slots.getByDate.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteSlotMutation = trpc.slots.delete.useMutation({
    onSuccess: () => {
      toast.success("Slot deleted.");
      utils.slots.getByDate.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const bulkDeleteMutation = trpc.slots.bulkDelete.useMutation({
    onSuccess: (result) => {
      const msg =
        result.skipped > 0
          ? `${result.deleted} slot${result.deleted !== 1 ? "s" : ""} deleted, ${result.skipped} booked slot${result.skipped !== 1 ? "s" : ""} skipped`
          : `${result.deleted} slot${result.deleted !== 1 ? "s" : ""} deleted`;
      toast.success(msg);
      setSelectedIds(new Set());
      utils.slots.getByDate.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteAllOpenMutation = trpc.slots.deleteAllOpenForDate.useMutation({
    onSuccess: (result) => {
      const msg =
        result.skipped > 0
          ? `${result.deleted} slot${result.deleted !== 1 ? "s" : ""} deleted, ${result.skipped} booked slot${result.skipped !== 1 ? "s" : ""} skipped`
          : `${result.deleted} slot${result.deleted !== 1 ? "s" : ""} deleted`;
      toast.success(msg);
      setSelectedIds(new Set());
      utils.slots.getByDate.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });


  const createBulkMutation = trpc.slots.createBulk.useMutation({
    onSuccess: (result) => {
      toast.success(`Created ${result.created} slots!`);
      setBulkOpen(false);
      utils.slots.getByDate.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Filter slots by service
  const filteredSlots = slots?.filter((s) =>
    serviceFilter === "all" ? true : String(s.serviceId) === serviceFilter
  );

  const handleBulkCreate = () => {
    if (!bulkServiceId) {
      toast.error("Please select a service.");
      return;
    }
    if (bulkFromDate > bulkToDate) {
      toast.error("From date must be before or equal to To date.");
      return;
    }
    createBulkMutation.mutate({
      serviceId: parseInt(bulkServiceId, 10),
      fromDate: bulkFromDate,
      toDate: bulkToDate,
      timeSlots: bulkTimeSlots,
      maxCapacity: 1,
    });
  };

  return (
    <AdminLayout title="Slots">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
            Slot Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create, block, and manage time slots
          </p>
        </div>
           <div className="flex gap-2">
          {filteredSlots && filteredSlots.filter((s) => s.availabilityStatus !== "booked").length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => {
                const openCount = filteredSlots.filter((s) => s.availabilityStatus !== "booked").length;
                const bookedCount = filteredSlots.filter((s) => s.availabilityStatus === "booked").length;
                setConfirmModal({
                  open: true,
                  title: "Delete all open slots?",
                  description: `This will delete ${openCount} open slot${openCount !== 1 ? "s" : ""} for ${formatDisplayDate(selectedDate)}.${bookedCount > 0 ? ` ${bookedCount} booked slot${bookedCount !== 1 ? "s" : ""} will be skipped.` : ""} This cannot be undone.`,
                  onConfirm: () => deleteAllOpenMutation.mutate({ date: selectedDate }),
                });
              }}
              disabled={deleteAllOpenMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Clear Date
            </Button>
          )}
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setBulkOpen(true)}>
            <Layers className="w-4 h-4 mr-1.5" />
            Bulk
          </Button>
          <Button size="sm" className="rounded-xl" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add
          </Button>
        </div>
      </div>

      {/* ── Date Navigator ── */}
      <div className="flex items-center gap-2 mb-3">
        {selectedDate !== today && (
          <button
            onClick={() => setSelectedDate(today)}
            className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            Today
          </button>
        )}
        <button
          onClick={() =>
            setSelectedDate(toDateStr(addDays(new Date(selectedDate + "T00:00:00"), -1)))
          }
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
               <label className="flex-1 text-center py-1 rounded-xl hover:bg-muted transition-colors cursor-pointer relative">
          <p className="text-sm font-semibold text-foreground">{formatDisplayDate(selectedDate)}</p>
          {selectedDate === today && (
            <span className="text-[10px] text-primary font-medium">Today</span>
          )}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value); }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            aria-label="Select date"
          />
        </label>

        <button
          onClick={() =>
            setSelectedDate(toDateStr(addDays(new Date(selectedDate + "T00:00:00"), 1)))
          }
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Service Filter ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 -mx-4 px-4">
        <button
          onClick={() => setServiceFilter("all")}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            serviceFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          All Services
        </button>
        {services?.map((s) => (
          <button
            key={s.id}
            onClick={() => setServiceFilter(String(s.id))}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              serviceFilter === String(s.id)
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* ── Slot Count Summary ── */}
      {filteredSlots && filteredSlots.length > 0 && (
        <div className="flex gap-2 mb-3">
          {["available", "booked", "blocked"].map((status) => {
            const count = filteredSlots.filter((s) => s.availabilityStatus === status).length;
            if (!count) return null;
            return (
              <span key={status} className={`text-xs px-2.5 py-1 rounded-full font-medium ${AVAIL_BADGE_CSS[status]}`}>
                {count} {AVAIL_LABEL[status]}
              </span>
            );
          })}
        </div>
      )}

      {/* ── Slot List ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredSlots && filteredSlots.length > 0 ? (
        <div className="space-y-2">
                  {/* ── Select All bar ── */}
          {filteredSlots.filter((s) => s.availabilityStatus !== "booked").length > 1 && (
            <div className="flex items-center gap-2 mb-1 px-1">
              <input
                type="checkbox"
                id="select-all-slots"
                className="w-4 h-4 rounded accent-primary cursor-pointer"
                checked={
                  filteredSlots
                    .filter((s) => s.availabilityStatus !== "booked")
                    .every((s) => selectedIds.has(s.id))
                }
                onChange={(e) => {
                  const openIds = filteredSlots
                    .filter((s) => s.availabilityStatus !== "booked")
                    .map((s) => s.id);
                  setSelectedIds(e.target.checked ? new Set(openIds) : new Set());
                }}
              />
              <label htmlFor="select-all-slots" className="text-xs text-muted-foreground cursor-pointer select-none">
                Select all open slots
              </label>
            </div>
          )}

          {filteredSlots.map((slot) => {
            const svc = services?.find((s) => s.id === slot.serviceId);
            const isBooked = slot.availabilityStatus === "booked";
            const isBlocked = slot.availabilityStatus === "blocked";
            const isSelected = selectedIds.has(slot.id);
            return (
              <Card
                key={slot.id}
                className={`border ${AVAIL_CARD_CSS[slot.availabilityStatus] ?? "border-border"} ${isSelected ? "ring-2 ring-primary/40" : ""}`}
              >
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  {/* Checkbox for selectable (non-booked) slots */}
                  {!isBooked && (
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded accent-primary cursor-pointer shrink-0"
                      checked={isSelected}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(slot.id);
                          else next.delete(slot.id);
                          return next;
                        });
                      }}
                    />
                  )}
                  <div className="flex-1 min-w-0">

                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${AVAIL_BADGE_CSS[slot.availabilityStatus] ?? ""}`}>
                        {AVAIL_LABEL[slot.availabilityStatus]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {svc?.name ?? "Unknown service"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isBooked && (
                      <button
                        onClick={() =>
                          setBlockedMutation.mutate({ id: slot.id, blocked: !isBlocked })
                        }
                        disabled={setBlockedMutation.isPending}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${
                          isBlocked
                            ? "border-green-200 hover:bg-green-50"
                            : "border-border hover:bg-muted"
                        }`}
                        title={isBlocked ? "Unblock slot" : "Block slot"}
                      >
                        {isBlocked ? (
                          <Unlock className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                    )}
                    {!isBooked && (
                      <button
                        onClick={() => {
                          if (confirm("Delete this slot permanently?")) {
                            deleteSlotMutation.mutate({ id: slot.id });
                          }
                        }}
                        disabled={deleteSlotMutation.isPending}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-red-100 hover:bg-red-50 transition-colors"
                        title="Delete slot"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                    {isBooked && (
                      <span className="text-[10px] text-blue-600 font-medium px-2">Booked</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
               </div>
                {/* ── Bulk action bar ── */}
          {selectedIds.size > 0 && (
            <div className="fixed bottom-20 left-0 right-0 mx-4 z-50">
              <div className="bg-foreground text-background rounded-2xl p-3 flex items-center justify-between shadow-xl">
                <span className="text-sm font-medium">
                  {selectedIds.size} slot{selectedIds.size !== 1 ? "s" : ""} selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs px-3 py-1.5 rounded-lg bg-background/20 hover:bg-background/30 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const ids = Array.from(selectedIds);
                      setConfirmModal({
                        open: true,
                        title: `Delete ${ids.length} slot${ids.length !== 1 ? "s" : ""}?`,
                        description: `This will permanently delete ${ids.length} selected slot${ids.length !== 1 ? "s" : ""}. Booked slots will be skipped automatically. This cannot be undone.`,
                        onConfirm: () => bulkDeleteMutation.mutate({ ids }),
                      });
                    }}
                    disabled={bulkDeleteMutation.isPending}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors flex items-center gap-1.5"
                  >
                    {bulkDeleteMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Delete Selected
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (

        <div className="rounded-2xl border border-dashed border-border p-10 text-center">

          <CalendarDays className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No slots for this date</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use "Add" or "Bulk" to create slots.
          </p>
        </div>
      )}

      {/* ── Create Single Slot Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Time Slot</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs mb-1.5 block">Service</Label>
              <Select value={newServiceId} onValueChange={setNewServiceId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  {services?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} ({s.durationMinutes} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Date</Label>
              <Input
                type="date"
                value={newDate}
                min={today}
                onChange={(e) => setNewDate(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Start Time</Label>
              <Input
                type="time"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="rounded-xl bg-muted/50 px-3 py-2.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">End Time (auto)</span>
              <span className="text-sm font-semibold text-foreground">
                {formatTime(computedEndTime)}
                {selectedService && (
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    ({selectedService.durationMinutes} min)
                  </span>
                )}
              </span>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Max Capacity</Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={createSlotMutation.isPending || !newServiceId || !newDate}
              onClick={() =>
                createSlotMutation.mutate({
                  serviceId: parseInt(newServiceId, 10),
                  date: newDate,
                  startTime: newStart,
                  endTime: computedEndTime,
                  maxCapacity: parseInt(newCapacity, 10),
                })
              }
            >
              {createSlotMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Create Slot"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Create Dialog ── */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="rounded-2xl mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle>Bulk Create Slots</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs mb-1.5 block">Service</Label>
              <Select value={bulkServiceId} onValueChange={setBulkServiceId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  {services?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} ({s.durationMinutes} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">From Date</Label>
                <Input
                  type="date"
                  value={bulkFromDate}
                  min={today}
                  onChange={(e) => setBulkFromDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">To Date</Label>
                <Input
                  type="date"
                  value={bulkToDate}
                  min={bulkFromDate}
                  onChange={(e) => setBulkToDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
            {bulkServiceId && (
              <div className="rounded-xl bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                <p><span className="font-medium text-foreground">{bulkTimeSlots.length} slots/day</span> × {bulkDayCount} days = <span className="font-medium text-foreground">{bulkTimeSlots.length * bulkDayCount} total slots</span></p>
                <p>Times: {bulkTimeSlots.slice(0, 3).map(t => formatTime(t.startTime)).join(", ")}{bulkTimeSlots.length > 3 ? ` +${bulkTimeSlots.length - 3} more` : ""}</p>
                <p>Duration: {bulkService?.durationMinutes} min per slot</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={createBulkMutation.isPending || !bulkServiceId || bulkFromDate > bulkToDate}
              onClick={handleBulkCreate}
            >
              {createBulkMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                `Create ${bulkTimeSlots.length * bulkDayCount} Slots`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
            {/* ── Confirmation Modal ── */}
      <Dialog open={confirmModal.open} onOpenChange={(open) => !open && setConfirmModal((p) => ({ ...p, open: false }))}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{confirmModal.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground px-1">{confirmModal.description}</p>
          <DialogFooter className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setConfirmModal((p) => ({ ...p, open: false }))}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                confirmModal.onConfirm();
                setConfirmModal((p) => ({ ...p, open: false }));
              }}
              disabled={bulkDeleteMutation.isPending || deleteAllOpenMutation.isPending}
            >
              {bulkDeleteMutation.isPending || deleteAllOpenMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
}
