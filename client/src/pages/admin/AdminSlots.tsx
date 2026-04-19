/**
 * AdminSlots — Slot management page for the coach.
 * Create individual slots, bulk-create a day's schedule, block/unblock, and delete slots.
 */
import { useState, useMemo } from "react";
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

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0]!;
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

// Default bulk schedule: 6AM–10AM + 3PM–9PM, 60-min slots
const DEFAULT_BULK_TIMES = [
  { startTime: "06:00", endTime: "07:00" },
  { startTime: "07:00", endTime: "08:00" },
  { startTime: "08:00", endTime: "09:00" },
  { startTime: "09:00", endTime: "10:00" },
  { startTime: "15:00", endTime: "16:00" },
  { startTime: "16:00", endTime: "17:00" },
  { startTime: "17:00", endTime: "18:00" },
  { startTime: "18:00", endTime: "19:00" },
  { startTime: "19:00", endTime: "20:00" },
  { startTime: "20:00", endTime: "21:00" },
];

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
  const today = useMemo(() => toDateStr(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Single slot form
  const [newServiceId, setNewServiceId] = useState("");
  const [newStart, setNewStart] = useState("06:00");
  const [newEnd, setNewEnd] = useState("07:00");
  const [newCapacity, setNewCapacity] = useState("1");

  // Bulk form
  const [bulkServiceId, setBulkServiceId] = useState("");
  const [bulkDays, setBulkDays] = useState("7");

  const utils = trpc.useUtils();

  const { data: services } = trpc.services.listAll.useQuery();
  const { data: slots, isLoading } = trpc.slots.getByDate.useQuery({ date: selectedDate });

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
    const days = parseInt(bulkDays, 10);
    const fromDate = today;
    const toDate = toDateStr(addDays(new Date(), days - 1));
    createBulkMutation.mutate({
      serviceId: parseInt(bulkServiceId, 10),
      fromDate,
      toDate,
      timeSlots: DEFAULT_BULK_TIMES,
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
        <button
          onClick={() =>
            setSelectedDate(toDateStr(addDays(new Date(selectedDate + "T00:00:00"), -1)))
          }
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-semibold text-foreground">{formatDisplayDate(selectedDate)}</p>
          {selectedDate === today && (
            <span className="text-[10px] text-primary font-medium">Today</span>
          )}
        </div>
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
          {filteredSlots.map((slot) => {
            const svc = services?.find((s) => s.id === slot.serviceId);
            const isBooked = slot.availabilityStatus === "booked";
            const isBlocked = slot.availabilityStatus === "blocked";
            return (
              <Card
                key={slot.id}
                className={`border ${AVAIL_CARD_CSS[slot.availabilityStatus] ?? "border-border"}`}
              >
                <CardContent className="p-3 flex items-center justify-between gap-2">
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
                      {svc?.name ?? `Service #${slot.serviceId}`}
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
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Date</Label>
              <p className="text-sm font-medium text-foreground">{formatDisplayDate(selectedDate)}</p>
              <p className="text-xs text-muted-foreground">Change date using the navigator above.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Start Time</Label>
                <Input
                  type="time"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">End Time</Label>
                <Input
                  type="time"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="rounded-xl"
                />
              </div>
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
              disabled={createSlotMutation.isPending || !newServiceId}
              onClick={() =>
                createSlotMutation.mutate({
                  serviceId: parseInt(newServiceId, 10),
                  date: selectedDate,
                  startTime: newStart,
                  endTime: newEnd,
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
            <p className="text-xs text-muted-foreground">
              Creates 10 slots per day (6AM–10AM + 3PM–9PM) starting from today.
            </p>
            <div>
              <Label className="text-xs mb-1.5 block">Service</Label>
              <Select value={bulkServiceId} onValueChange={setBulkServiceId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  {services?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Number of Days</Label>
              <Select value={bulkDays} onValueChange={setBulkDays}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days (70 slots)</SelectItem>
                  <SelectItem value="14">14 days (140 slots)</SelectItem>
                  <SelectItem value="30">30 days (300 slots)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={createBulkMutation.isPending || !bulkServiceId}
              onClick={handleBulkCreate}
            >
              {createBulkMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                `Create ${parseInt(bulkDays) * 10} Slots`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
