"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import {
    ArrowLeft,
    CalendarDays,
    Check,
    ChevronDown,
    ImagePlus,
    MapPin,
    Plus,
    Trash2,
    Upload,
    X,
} from "lucide-react";

type PricingMode = "free" | "paid";
type DiscountType = "percentage" | "fixed";
type TicketType = {
    id: number;
    name: string;
    price: number;
    quantity: number;
    description: string;
};
type FormErrors = Record<string, string>;

const categories = [
    "Musik",
    "Food & Beverage",
    "Workshops",
    "Teknologi",
    "Olahraga",
    "Seni & Budaya",
    "Edukasi",
    "Komunitas",
];
const organizer = "TemuEvent Community";
const formatPrice = (value: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    })
        .format(Math.max(0, value))
        .replace("IDR", "Rp");
const inputClass =
    "mt-1.5 w-full rounded-xl border border-[#e7e2f2] bg-white px-3.5 py-3 text-sm text-[#282342] outline-none transition placeholder:text-[#aaa6b8] focus:border-[#6158df] focus:ring-4 focus:ring-[#6158df]/10";

export default function NewEventPage() {
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [image, setImage] = useState<string | null>(null);
    const [imageName, setImageName] = useState("");
    const [startDate, setStartDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endDate, setEndDate] = useState("");
    const [endTime, setEndTime] = useState("");
    const [pricingMode, setPricingMode] = useState<PricingMode>("paid");
    const [freeSeats, setFreeSeats] = useState(100);
    const [tickets, setTickets] = useState<TicketType[]>([
        {
            id: 1,
            name: "Regular",
            price: 150000,
            quantity: 100,
            description: "",
        },
    ]);
    const [voucherEnabled, setVoucherEnabled] = useState(false);
    const [voucherCode, setVoucherCode] = useState("");
    const [discountType, setDiscountType] =
        useState<DiscountType>("percentage");
    const [discountValue, setDiscountValue] = useState(10);
    const [voucherStart, setVoucherStart] = useState("");
    const [voucherEnd, setVoucherEnd] = useState("");
    const [voucherQuota, setVoucherQuota] = useState(20);
    const [errors, setErrors] = useState<FormErrors>({});
    const [status, setStatus] = useState<"idle" | "draft" | "published">(
        "idle",
    );
    const [showConfirm, setShowConfirm] = useState(false);

    const totalQuota =
        pricingMode === "free"
            ? freeSeats
            : tickets.reduce(
                  (total, ticket) => total + (Number(ticket.quantity) || 0),
                  0,
              );
    const lowestPrice =
        pricingMode === "paid"
            ? Math.min(...tickets.map((ticket) => Number(ticket.price) || 0))
            : 0;
    const scheduleStart =
        startDate && startTime ? new Date(`${startDate}T${startTime}`) : null;
    const scheduleEnd =
        endDate && endTime ? new Date(`${endDate}T${endTime}`) : null;
    const scheduleLabel = startDate
        ? `${new Date(`${startDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}${startTime ? `, ${startTime}` : ""}`
        : "Tanggal dan waktu belum diatur";
    const voucherDiscountLabel =
        discountType === "percentage"
            ? `${discountValue || 0}% off eligible tickets`
            : `${formatPrice(Number(discountValue) || 0)} off eligible tickets`;
    const eventOverlap =
        scheduleStart &&
        scheduleEnd &&
        voucherStart &&
        voucherEnd &&
        new Date(voucherEnd) >= scheduleStart &&
        new Date(voucherStart) <= scheduleEnd;

    const validate = () => {
        const next: FormErrors = {};
        if (!name.trim()) next.name = "Nama event wajib diisi.";
        if (!category) next.category = "Pilih kategori event.";
        if (!description.trim())
            next.description = "Tambahkan deskripsi singkat event.";
        if (!startDate || !startTime)
            next.start = "Tanggal dan waktu mulai wajib diisi.";
        else if (!scheduleStart || scheduleStart <= new Date())
            next.start = "Waktu mulai harus berada di masa depan.";
        if (!endDate || !endTime)
            next.end = "Tanggal dan waktu selesai wajib diisi.";
        else if (scheduleStart && scheduleEnd && scheduleEnd <= scheduleStart)
            next.end = "Waktu selesai harus setelah waktu mulai.";
        if (pricingMode === "free") {
            if (!Number.isInteger(Number(freeSeats)) || Number(freeSeats) <= 0)
                next.seats = "Jumlah kursi harus berupa angka bulat positif.";
        } else {
            if (!tickets.length)
                next.tickets = "Tambahkan minimal satu jenis tiket.";
            tickets.forEach((ticket, index) => {
                if (!ticket.name.trim())
                    next[`ticket-${index}`] = "Nama tiket wajib diisi.";
                if (
                    !Number.isInteger(Number(ticket.price)) ||
                    Number(ticket.price) <= 0
                )
                    next[`ticket-price-${index}`] =
                        "Harga harus lebih dari Rp0.";
                if (
                    !Number.isInteger(Number(ticket.quantity)) ||
                    Number(ticket.quantity) <= 0
                )
                    next[`ticket-quantity-${index}`] =
                        "Kuota harus berupa angka bulat positif.";
            });
        }
        if (voucherEnabled) {
            if (!voucherCode.trim())
                next.voucherCode = "Kode voucher wajib diisi.";
            if (
                Number(discountValue) <= 0 ||
                (discountType === "percentage" && Number(discountValue) > 100)
            )
                next.discount =
                    discountType === "percentage"
                        ? "Persentase harus antara 1–100%."
                        : "Potongan harga harus lebih dari Rp0.";
            if (!voucherStart || !voucherEnd)
                next.voucherDate = "Periode voucher wajib diisi.";
            else if (new Date(voucherEnd) <= new Date(voucherStart))
                next.voucherDate = "Waktu berakhir harus setelah waktu mulai.";
            else if (!eventOverlap)
                next.voucherDate =
                    "Periode voucher harus beririsan dengan jadwal event.";
            if (
                !Number.isInteger(Number(voucherQuota)) ||
                Number(voucherQuota) <= 0
            )
                next.voucherQuota =
                    "Kuota penggunaan harus berupa angka bulat positif.";
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const updateTicket = (
        id: number,
        key: keyof TicketType,
        value: string | number,
    ) =>
        setTickets((current) =>
            current.map((ticket) =>
                ticket.id === id ? { ...ticket, [key]: value } : ticket,
            ),
        );
    const addTicket = () =>
        setTickets((current) => [
            ...current,
            {
                id: Date.now(),
                name: "",
                price: 0,
                quantity: 50,
                description: "",
            },
        ]);
    const removeTicket = (id: number) =>
        setTickets((current) =>
            current.length > 1
                ? current.filter((ticket) => ticket.id !== id)
                : current,
        );
    const handleImage = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setImage(URL.createObjectURL(file));
        setImageName(file.name);
    };
    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (validate()) setShowConfirm(true);
    };
    const saveDraft = () => {
        setStatus("draft");
        window.setTimeout(() => setStatus("idle"), 3000);
    };

    return (
        <div className="min-h-screen bg-[#fcf9ff] text-[#17143c]">
            <header className="sticky top-0 z-20 border-b border-[#eee9fb] bg-white/95 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5">
                    <a
                        href="/"
                        className="flex items-center gap-2 font-black tracking-tight"
                    >
                        {" "}
                        <span className="grid size-7 place-items-center rounded-full bg-[#4f46e5] text-xs text-white">
                            ✦
                        </span>{" "}
                        Temu<span className="text-[#e539a7]">Event</span>
                    </a>
                    <div className="flex items-center gap-3 text-xs">
                        <span className="hidden text-[#858196] sm:block">
                            Mode Penyelenggara
                        </span>
                        <span className="grid size-8 place-items-center rounded-full bg-[#ffe6f4] font-bold">
                            AR
                        </span>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-[1180px] px-5 py-8 sm:py-10">
                <a
                    href="/"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-[#6357de] hover:underline"
                >
                    <ArrowLeft data-icon="inline-start" /> Kembali ke Beranda
                </a>
                <div className="mt-5 max-w-2xl">
                    <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#e03c9b]">
                        Untuk penyelenggara
                    </p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                        Buat Event Baru
                    </h1>
                    <p className="mt-2 text-sm text-[#77738b]">
                        Bagikan acara seru kamu dan temukan peserta yang tepat.
                    </p>
                </div>
                <form
                    onSubmit={handleSubmit}
                    className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px] lg:items-start"
                >
                    <div className="flex flex-col gap-6">
                        <Section
                            number="01"
                            title="Informasi Event"
                            description="Ceritakan event kamu agar mudah ditemukan peserta."
                        >
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field
                                    label="Nama Event"
                                    required
                                    error={errors.name}
                                >
                                    <input
                                        className={inputClass}
                                        value={name}
                                        onChange={(e) =>
                                            setName(e.target.value)
                                        }
                                        placeholder="Contoh: Jakarta Coffee Festival"
                                    />
                                </Field>
                                <Field
                                    label="Kategori"
                                    required
                                    error={errors.category}
                                >
                                    <select
                                        className={inputClass}
                                        value={category}
                                        onChange={(e) =>
                                            setCategory(e.target.value)
                                        }
                                    >
                                        <option value="">Pilih kategori</option>
                                        {categories.map((item) => (
                                            <option key={item}>{item}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field
                                    label="Deskripsi Event"
                                    required
                                    error={errors.description}
                                    className="sm:col-span-2"
                                >
                                    <textarea
                                        className={`${inputClass} min-h-32 resize-y`}
                                        value={description}
                                        onChange={(e) =>
                                            setDescription(e.target.value)
                                        }
                                        placeholder="Jelaskan pengalaman yang akan didapat peserta..."
                                    />
                                </Field>
                                <Field
                                    label="Lokasi Event"
                                    hint="Bisa berupa venue, alamat, atau link lokasi."
                                >
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-3.5 text-[#aaa6b8]" />
                                        <input
                                            className={`${inputClass} pl-9`}
                                            value={location}
                                            onChange={(e) =>
                                                setLocation(e.target.value)
                                            }
                                            placeholder="Contoh: Senayan Park, Jakarta"
                                        />
                                    </div>
                                </Field>
                                <Field label="Penyelenggara">
                                    <div className="mt-1.5 flex items-center gap-3 rounded-xl bg-[#f7f4ff] px-3.5 py-3 text-sm">
                                        <span className="grid size-8 place-items-center rounded-full bg-[#e9e5ff] text-xs font-bold text-[#5148d7]">
                                            TE
                                        </span>
                                        <span className="font-semibold">
                                            {organizer}
                                        </span>
                                    </div>
                                </Field>
                                <Field
                                    label="Gambar Event"
                                    hint="JPG atau PNG, maksimal 5MB."
                                    className="sm:col-span-2"
                                >
                                    <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-[#ddd7f2] bg-[#faf8ff]">
                                        {image ? (
                                            <div className="relative h-48">
                                                <img
                                                    src={image}
                                                    alt="Pratinjau gambar event"
                                                    className="h-full w-full object-cover"
                                                />
                                                <button
                                                    type="button"
                                                    aria-label="Hapus gambar"
                                                    onClick={() => {
                                                        setImage(null);
                                                        setImageName("");
                                                    }}
                                                    className="absolute right-3 top-3 rounded-full bg-white p-2 text-[#5148d7] shadow"
                                                >
                                                    <X />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 px-5 py-10 text-center">
                                                <span className="grid size-11 place-items-center rounded-xl bg-[#eeeaff] text-[#5c52dc]">
                                                    <ImagePlus />
                                                </span>
                                                <span className="text-sm font-bold">
                                                    Pilih gambar event
                                                </span>
                                                <span className="text-xs text-[#9994aa]">
                                                    atau tarik dan lepas file di
                                                    sini
                                                </span>
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg"
                                                    className="sr-only"
                                                    onChange={handleImage}
                                                />
                                            </label>
                                        )}
                                        {imageName && (
                                            <p className="bg-white px-4 py-2 text-xs text-[#77738b]">
                                                {imageName}
                                            </p>
                                        )}
                                    </div>
                                </Field>
                            </div>
                        </Section>
                        <Section
                            number="02"
                            title="Jadwal Event"
                            description="Tentukan kapan event kamu dimulai dan berakhir."
                        >
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field
                                    label="Tanggal Mulai"
                                    required
                                    error={errors.start}
                                >
                                    <input
                                        type="date"
                                        className={inputClass}
                                        value={startDate}
                                        onChange={(e) =>
                                            setStartDate(e.target.value)
                                        }
                                    />
                                </Field>
                                <Field label="Waktu Mulai" required>
                                    <input
                                        type="time"
                                        className={inputClass}
                                        value={startTime}
                                        onChange={(e) =>
                                            setStartTime(e.target.value)
                                        }
                                    />
                                </Field>
                                <Field
                                    label="Tanggal Selesai"
                                    required
                                    error={errors.end}
                                >
                                    <input
                                        type="date"
                                        className={inputClass}
                                        value={endDate}
                                        onChange={(e) =>
                                            setEndDate(e.target.value)
                                        }
                                    />
                                </Field>
                                <Field label="Waktu Selesai" required>
                                    <input
                                        type="time"
                                        className={inputClass}
                                        value={endTime}
                                        onChange={(e) =>
                                            setEndTime(e.target.value)
                                        }
                                    />
                                </Field>
                            </div>
                        </Section>
                        <Section
                            number="03"
                            title="Tiket dan Harga"
                            description="Atur cara peserta mendapatkan akses ke event kamu."
                        >
                            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f4f1fc] p-1">
                                <button
                                    type="button"
                                    onClick={() => setPricingMode("free")}
                                    className={`rounded-xl px-4 py-3 text-sm font-bold transition ${pricingMode === "free" ? "bg-white text-[#5148d7] shadow-sm" : "text-[#858196]"}`}
                                >
                                    Gratis
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPricingMode("paid")}
                                    className={`rounded-xl px-4 py-3 text-sm font-bold transition ${pricingMode === "paid" ? "bg-white text-[#5148d7] shadow-sm" : "text-[#858196]"}`}
                                >
                                    Berbayar
                                </button>
                            </div>
                            {pricingMode === "free" ? (
                                <div className="mt-5">
                                    <Field
                                        label="Total Kursi Tersedia"
                                        required
                                        error={errors.seats}
                                    >
                                        <input
                                            type="number"
                                            min="1"
                                            className={inputClass}
                                            value={freeSeats}
                                            onChange={(e) =>
                                                setFreeSeats(
                                                    Number(e.target.value),
                                                )
                                            }
                                        />
                                    </Field>
                                    <p className="mt-2 text-xs text-[#858196]">
                                        Peserta dapat mendaftar tanpa biaya.
                                        Tidak ada harga tiket yang ditampilkan.
                                    </p>
                                </div>
                            ) : (
                                <div className="mt-5 flex flex-col gap-4">
                                    {tickets.map((ticket, index) => (
                                        <div
                                            key={ticket.id}
                                            className="rounded-2xl border border-[#ebe7f5] bg-[#fcfbff] p-4"
                                        >
                                            <div className="mb-4 flex items-center justify-between">
                                                <p className="text-sm font-bold">
                                                    Jenis Tiket {index + 1}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        removeTicket(ticket.id)
                                                    }
                                                    disabled={
                                                        tickets.length === 1
                                                    }
                                                    className="text-[#b1aabd] transition hover:text-[#df4a9d] disabled:cursor-not-allowed disabled:opacity-30"
                                                    aria-label="Hapus jenis tiket"
                                                >
                                                    <Trash2 />
                                                </button>
                                            </div>
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <Field
                                                    label="Nama Tiket"
                                                    required
                                                    error={
                                                        errors[
                                                            `ticket-${index}`
                                                        ]
                                                    }
                                                >
                                                    <input
                                                        className={inputClass}
                                                        value={ticket.name}
                                                        onChange={(e) =>
                                                            updateTicket(
                                                                ticket.id,
                                                                "name",
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Regular"
                                                    />
                                                </Field>
                                                <Field
                                                    label="Harga Tiket (Rp)"
                                                    required
                                                    error={
                                                        errors[
                                                            `ticket-price-${index}`
                                                        ]
                                                    }
                                                >
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        className={inputClass}
                                                        value={
                                                            ticket.price || ""
                                                        }
                                                        onChange={(e) =>
                                                            updateTicket(
                                                                ticket.id,
                                                                "price",
                                                                Number(
                                                                    e.target
                                                                        .value,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                </Field>
                                                <Field
                                                    label="Jumlah Tiket"
                                                    required
                                                    error={
                                                        errors[
                                                            `ticket-quantity-${index}`
                                                        ]
                                                    }
                                                >
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        className={inputClass}
                                                        value={
                                                            ticket.quantity ||
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            updateTicket(
                                                                ticket.id,
                                                                "quantity",
                                                                Number(
                                                                    e.target
                                                                        .value,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                </Field>
                                                <Field label="Deskripsi Singkat">
                                                    <input
                                                        className={inputClass}
                                                        value={
                                                            ticket.description
                                                        }
                                                        onChange={(e) =>
                                                            updateTicket(
                                                                ticket.id,
                                                                "description",
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Termasuk akses utama"
                                                    />
                                                </Field>
                                            </div>
                                        </div>
                                    ))}
                                    {errors.tickets && (
                                        <p className="text-xs text-red-600">
                                            {errors.tickets}
                                        </p>
                                    )}
                                    <button
                                        type="button"
                                        onClick={addTicket}
                                        className="inline-flex items-center gap-2 self-start text-sm font-bold text-[#5a50d9] hover:underline"
                                    >
                                        <Plus data-icon="inline-start" /> Tambah
                                        Jenis Tiket
                                    </button>
                                    <div className="flex items-center justify-between rounded-xl bg-[#f6f3ff] px-4 py-3 text-sm">
                                        <span className="text-[#77738b]">
                                            Total kuota tiket
                                        </span>
                                        <strong>{totalQuota} tiket</strong>
                                    </div>
                                </div>
                            )}
                        </Section>
                        <Section
                            number="04"
                            title="Voucher Promosi Event"
                            description="Buat promo khusus untuk event ini dan dorong lebih banyak pendaftaran."
                        >
                            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e9e4f5] p-4">
                                <input
                                    type="checkbox"
                                    checked={voucherEnabled}
                                    onChange={(e) =>
                                        setVoucherEnabled(e.target.checked)
                                    }
                                    className="size-4 accent-[#5148d7]"
                                />
                                <span>
                                    <span className="block text-sm font-bold">
                                        Aktifkan Voucher Promosi
                                    </span>
                                    <span className="mt-1 block text-xs text-[#858196]">
                                        Voucher ini hanya bisa digunakan untuk
                                        event ini selama periode berlaku.
                                    </span>
                                </span>
                            </label>
                            {voucherEnabled && (
                                <div className="mt-5 flex flex-col gap-5">
                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <Field
                                            label="Kode Voucher"
                                            required
                                            error={errors.voucherCode}
                                        >
                                            <input
                                                className={`${inputClass} uppercase`}
                                                value={voucherCode}
                                                onChange={(e) =>
                                                    setVoucherCode(
                                                        e.target.value.toUpperCase(),
                                                    )
                                                }
                                                placeholder="COFFEE10"
                                            />
                                        </Field>
                                        <Field
                                            label="Kuota Penggunaan"
                                            required
                                            error={errors.voucherQuota}
                                        >
                                            <input
                                                type="number"
                                                min="1"
                                                className={inputClass}
                                                value={voucherQuota}
                                                onChange={(e) =>
                                                    setVoucherQuota(
                                                        Number(e.target.value),
                                                    )
                                                }
                                            />
                                        </Field>
                                        <Field label="Jenis Diskon">
                                            <select
                                                className={inputClass}
                                                value={discountType}
                                                onChange={(e) =>
                                                    setDiscountType(
                                                        e.target
                                                            .value as DiscountType,
                                                    )
                                                }
                                            >
                                                <option value="percentage">
                                                    Persentase (%)
                                                </option>
                                                <option value="fixed">
                                                    Potongan Harga Tetap (Rp)
                                                </option>
                                            </select>
                                        </Field>
                                        <Field
                                            label="Nilai Diskon"
                                            required
                                            error={errors.discount}
                                        >
                                            <input
                                                type="number"
                                                min="1"
                                                max={
                                                    discountType ===
                                                    "percentage"
                                                        ? 100
                                                        : undefined
                                                }
                                                className={inputClass}
                                                value={discountValue}
                                                onChange={(e) =>
                                                    setDiscountValue(
                                                        Number(e.target.value),
                                                    )
                                                }
                                            />
                                        </Field>
                                        <Field
                                            label="Tanggal dan Waktu Mulai"
                                            required
                                            className="sm:col-span-2"
                                        >
                                            <input
                                                type="datetime-local"
                                                className={inputClass}
                                                value={voucherStart}
                                                onChange={(e) =>
                                                    setVoucherStart(
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </Field>
                                        <Field
                                            label="Tanggal dan Waktu Berakhir"
                                            required
                                            error={errors.voucherDate}
                                            className="sm:col-span-2"
                                        >
                                            <input
                                                type="datetime-local"
                                                className={inputClass}
                                                value={voucherEnd}
                                                onChange={(e) =>
                                                    setVoucherEnd(
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </Field>
                                    </div>
                                    <div className="rounded-2xl border border-dashed border-[#d8d0fa] bg-[#f7f4ff] p-4">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8177d6]">
                                            Preview voucher
                                        </p>
                                        <div className="mt-3 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-lg font-black tracking-widest text-[#5148d7]">
                                                    {voucherCode || "COFFEE10"}
                                                </p>
                                                <p className="mt-1 text-sm font-semibold">
                                                    {voucherDiscountLabel}
                                                </p>
                                                <p className="mt-1 text-xs text-[#858196]">
                                                    {voucherStart
                                                        ? `Berlaku mulai ${new Date(voucherStart).toLocaleString("id-ID")}`
                                                        : "Pilih periode berlaku voucher"}
                                                </p>
                                            </div>
                                            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-[#5148d7]">
                                                {voucherQuota} penggunaan
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Section>
                        <div className="flex flex-col-reverse gap-3 border-t border-[#e9e4f4] pt-6 sm:flex-row sm:items-center sm:justify-between">
                            <a
                                href="/"
                                className="text-center text-sm font-bold text-[#77738b] hover:text-[#5148d7]"
                            >
                                Batal
                            </a>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={saveDraft}
                                    className="rounded-xl border border-[#dcd6ee] bg-white px-5 py-3 text-sm font-bold text-[#5148d7] hover:bg-[#f7f4ff]"
                                >
                                    Simpan sebagai Draft
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-[#5148d7] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-[#433bc8]"
                                >
                                    Publikasikan Event
                                </button>
                            </div>
                        </div>
                        {status === "draft" && (
                            <div
                                role="status"
                                className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
                            >
                                <Check className="mr-2 inline" /> Draft disimpan
                                sebagai simulasi lokal untuk prototype ini.
                            </div>
                        )}
                    </div>
                    <aside className="lg:sticky lg:top-24">
                        <div className="rounded-3xl border border-[#e9e4f5] bg-white p-5 shadow-[0_10px_35px_rgba(64,45,120,.07)]">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#e03c9b]">
                                        Live preview
                                    </p>
                                    <h2 className="mt-1 text-lg font-black">
                                        Ringkasan Event
                                    </h2>
                                </div>
                                <span className="rounded-full bg-[#eeeaff] px-2.5 py-1 text-[10px] font-bold text-[#5148d7]">
                                    Draft
                                </span>
                            </div>
                            <div className="mt-5 overflow-hidden rounded-2xl bg-[#f2effc]">
                                {image ? (
                                    <img
                                        src={image}
                                        alt="Preview event"
                                        className="h-36 w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex h-36 items-center justify-center text-[#b5afd2]">
                                        <ImagePlus />
                                    </div>
                                )}
                                <div className="p-4">
                                    <p className="text-[10px] font-semibold text-[#6357de]">
                                        {category || "Kategori belum dipilih"}
                                    </p>
                                    <h3 className="mt-1 text-lg font-black leading-6">
                                        {name || "Nama event kamu"}
                                    </h3>
                                    <p className="mt-3 flex items-center gap-2 text-xs text-[#77738b]">
                                        <CalendarDays /> {scheduleLabel}
                                    </p>
                                    {location && (
                                        <p className="mt-2 flex items-center gap-2 text-xs text-[#77738b]">
                                            <MapPin /> {location}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <SummaryItem
                                    label="Tipe"
                                    value={
                                        pricingMode === "free"
                                            ? "Gratis"
                                            : lowestPrice > 0
                                              ? `Mulai dari ${formatPrice(lowestPrice)}`
                                              : "Harga belum diatur"
                                    }
                                />
                                <SummaryItem
                                    label="Kuota"
                                    value={`${totalQuota || 0} tiket`}
                                />
                            </div>
                            <div className="mt-3 rounded-xl bg-[#faf8ff] px-3 py-3 text-xs text-[#77738b]">
                                Voucher promosi{" "}
                                <strong
                                    className={
                                        voucherEnabled
                                            ? "text-emerald-600"
                                            : "text-[#aaa6b8]"
                                    }
                                >
                                    {voucherEnabled ? "Aktif" : "Belum aktif"}
                                </strong>
                            </div>
                            <div className="mt-5 flex items-start gap-2 rounded-xl bg-[#fff9e8] p-3 text-xs leading-5 text-[#826b28]">
                                {" "}
                                <span>ⓘ</span>
                                <span>
                                    Ini adalah preview lokal. Event baru akan
                                    dipublikasikan setelah kamu mengonfirmasi.
                                </span>
                            </div>
                        </div>
                    </aside>
                </form>
            </main>
            {showConfirm && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-[#181438]/45 p-5">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="publish-title"
                        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[#e03c9b]">
                                    Satu langkah lagi
                                </p>
                                <h2
                                    id="publish-title"
                                    className="mt-1 text-xl font-black"
                                >
                                    Sudah sesuai?
                                </h2>
                            </div>
                            <button
                                type="button"
                                aria-label="Tutup dialog"
                                onClick={() => setShowConfirm(false)}
                                className="rounded-full p-2 text-[#77738b] hover:bg-[#f5f1ff]"
                            >
                                <X />
                            </button>
                        </div>
                        <div className="mt-5 rounded-2xl bg-[#f7f4ff] p-4 text-sm">
                            <p className="font-bold">{name}</p>
                            <p className="mt-2 text-[#77738b]">
                                {scheduleLabel} ·{" "}
                                {pricingMode === "free"
                                    ? "Gratis"
                                    : `${totalQuota} tiket · mulai ${formatPrice(lowestPrice)}`}
                            </p>
                            <p className="mt-1 text-[#77738b]">
                                Voucher:{" "}
                                {voucherEnabled
                                    ? voucherCode || "Belum diberi kode"
                                    : "Tidak ada"}
                            </p>
                        </div>
                        <p className="mt-4 text-xs leading-5 text-[#858196]">
                            Ini hanya simulasi publikasi untuk prototype. Tidak
                            ada data yang dikirim ke server atau database.
                        </p>
                        <div className="mt-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 rounded-xl border border-[#ddd7ee] py-3 text-sm font-bold text-[#77738b]"
                            >
                                Kembali Edit
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowConfirm(false);
                                    setStatus("published");
                                }}
                                className="flex-1 rounded-xl bg-[#5148d7] py-3 text-sm font-bold text-white"
                            >
                                Konfirmasi Publikasi
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {status === "published" && (
                <div
                    role="status"
                    className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-xl"
                >
                    Event berhasil dipublikasikan sebagai simulasi prototype.
                </div>
            )}
        </div>
    );
}

function Section({
    number,
    title,
    description,
    children,
}: {
    number: string;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-3xl border border-[#e9e4f5] bg-white p-5 shadow-[0_6px_24px_rgba(64,45,120,.045)] sm:p-7">
            <div className="mb-6 flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eeeaff] text-xs font-black text-[#5148d7]">
                    {number}
                </span>
                <div>
                    <h2 className="text-lg font-black">{title}</h2>
                    <p className="mt-1 text-xs leading-5 text-[#858196]">
                        {description}
                    </p>
                </div>
            </div>
            {children}
        </section>
    );
}
function Field({
    label,
    required,
    hint,
    error,
    className = "",
    children,
}: {
    label: string;
    required?: boolean;
    hint?: string;
    error?: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={className}>
            <label className="text-xs font-bold text-[#39334e]">
                {label}
                {required && <span className="ml-1 text-[#e03c9b]">*</span>}
            </label>
            {children}
            {hint && !error && (
                <p className="mt-1.5 text-[11px] text-[#9994aa]">{hint}</p>
            )}
            {error && (
                <p className="mt-1.5 text-[11px] font-semibold text-red-600">
                    {error}
                </p>
            )}
        </div>
    );
}
function SummaryItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-[#eeeaf6] p-3">
            <p className="text-[10px] text-[#9994aa]">{label}</p>
            <p className="mt-1 text-xs font-bold text-[#39334e]">{value}</p>
        </div>
    );
}
