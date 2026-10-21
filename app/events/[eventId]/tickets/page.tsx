"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import {
    ArrowLeft,
    CalendarDays,
    Check,
    ChevronRight,
    Clock3,
    Copy,
    Info,
    MapPin,
    Minus,
    Plus,
    Ticket,
    Wallet,
    X,
} from "lucide-react";
import { events, formatPrice } from "@/lib/events";

type TicketChoice = {
    id: "regular" | "workshop";
    name: string;
    description: string;
    price: number;
    available: number;
};

const choices: TicketChoice[] = [
    {
        id: "regular",
        name: "Regular Pass",
        description: "Akses ke area utama festival.",
        price: 150000,
        available: 40,
    },
    {
        id: "workshop",
        name: "Workshop Pass",
        description: "Akses festival plus satu workshop brewing pilihan.",
        price: 250000,
        available: 12,
    },
];

const rewardCoupons = [
    {
        code: "WELCOME25",
        label: "WELCOME25 — Potongan Rp25.000",
        discount: 25000,
        expires: "Berlaku sampai 30 Juni 2025",
    },
    {
        code: "EXPIRED10",
        label: "EXPIRED10 — Kupon kedaluwarsa",
        discount: 10000,
        expires: "Sudah tidak berlaku",
    },
];

export default function TicketPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId: rawEventId } = use(params);
    const event = events.find((item) => item.id === Number(rawEventId));
    const [quantities, setQuantities] = useState<Record<string, number>>({
        regular: 0,
        workshop: 0,
    });
    const [voucher, setVoucher] = useState("");
    const [voucherApplied, setVoucherApplied] = useState(false);
    const [voucherMessage, setVoucherMessage] = useState("");
    const [coupon, setCoupon] = useState("");
    const [couponApplied, setCouponApplied] = useState(false);
    const [couponMessage, setCouponMessage] = useState("");
    const [usePoints, setUsePoints] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [paymentStage, setPaymentStage] = useState(false);

    const subtotal = useMemo(
        () =>
            choices.reduce(
                (sum, choice) =>
                    sum + choice.price * (quantities[choice.id] || 0),
                0,
            ),
        [quantities],
    );
    const voucherDiscount = voucherApplied ? Math.round(subtotal * 0.1) : 0;
    const couponDiscount = couponApplied ? 25000 : 0;
    const pointsDiscount = usePoints
        ? Math.min(
              20000,
              Math.max(0, subtotal - voucherDiscount - couponDiscount),
          )
        : 0;
    const total = Math.max(
        0,
        subtotal - voucherDiscount - couponDiscount - pointsDiscount,
    );
    const selected = choices.filter((choice) => quantities[choice.id] > 0);
    const itemCount = selected.reduce(
        (sum, choice) => sum + quantities[choice.id],
        0,
    );

    if (!event)
        return (
            <main className="grid min-h-screen place-items-center bg-[#fcf9ff] p-5 text-[#11103d]">
                <div className="text-center">
                    <h1 className="text-2xl font-black">
                        Event tidak ditemukan
                    </h1>
                    <Link
                        href="/"
                        className="mt-5 inline-block font-bold text-[#5148df]"
                    >
                        Kembali ke Explore
                    </Link>
                </div>
            </main>
        );

    const updateQuantity = (id: string, delta: number) =>
        setQuantities((current) => ({
            ...current,
            [id]: Math.min(
                choices.find((choice) => choice.id === id)?.available || 0,
                Math.max(0, (current[id] || 0) + delta),
            ),
        }));
    const applyVoucher = () => {
        if (voucher.trim().toUpperCase() === "COFFEE10") {
            setVoucher("COFFEE10");
            setVoucherApplied(true);
            setVoucherMessage("Voucher berhasil diterapkan: diskon 10%.");
        } else setVoucherMessage("Kode voucher tidak valid untuk event ini.");
    };
    const applyCoupon = () => {
        if (coupon === "WELCOME25") {
            setCouponApplied(true);
            setCouponMessage("Kupon reward berhasil diterapkan.");
        } else
            setCouponMessage(
                coupon === "EXPIRED10"
                    ? "Kupon ini sudah kedaluwarsa."
                    : "Pilih kupon reward yang tersedia.",
            );
    };

    if (paymentStage)
        return (
            <main className="min-h-screen bg-[#fcf9ff] px-5 py-8 text-[#11103d]">
                <div className="mx-auto max-w-3xl">
                    <Link
                        href={`/events/${event.id}`}
                        className="flex items-center gap-2 text-sm font-bold text-[#5148df]"
                    >
                        <ArrowLeft size={16} /> Kembali ke detail event
                    </Link>
                    <div className="mt-8 rounded-3xl bg-white p-6 shadow-[0_12px_40px_rgba(64,45,120,.1)] sm:p-10">
                        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e9e7ff] text-[#5148df]">
                            <Wallet />
                        </div>
                        <p className="mt-6 text-xs font-black tracking-[.14em] text-[#d42e98]">
                            TAHAP SELANJUTNYA
                        </p>
                        <h1 className="mt-2 text-3xl font-black">
                            Instruksi pembayaran
                        </h1>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-[#77738b]">
                            Order kamu sudah siap untuk dilanjutkan. Dalam versi
                            aplikasi nanti, instruksi pembayaran akan dibuat
                            setelah transaksi berhasil dibuat.
                        </p>
                        <div className="mt-7 rounded-2xl border border-[#ebe7f5] bg-[#faf9ff] p-5">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-[#77738b]">
                                    Total yang perlu dibayar
                                </span>
                                <strong className="text-xl text-[#5148df]">
                                    {formatPrice(total)}
                                </strong>
                            </div>
                            <div className="mt-4 flex items-center gap-3 text-sm">
                                <span className="rounded-full bg-[#fff1c9] px-3 py-1 font-bold text-[#946600]">
                                    Mock preview
                                </span>
                                <span className="text-[#77738b]">
                                    Belum ada transaksi atau pembayaran nyata
                                </span>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3 rounded-2xl bg-[#f4f1ff] p-4 text-sm leading-6 text-[#5a5574]">
                            <Info
                                className="mt-1 shrink-0 text-[#5148df]"
                                size={17}
                            />
                            <p>
                                Setelah transaksi dibuat, kamu akan memiliki
                                waktu 2 jam untuk mengunggah bukti pembayaran.
                                Fitur ini akan terhubung ke backend pada tahap
                                berikutnya.
                            </p>
                        </div>
                        <button
                            onClick={() => setPaymentStage(false)}
                            className="mt-7 rounded-xl border border-[#ded9f0] px-5 py-3 text-sm font-bold text-[#5148df]"
                        >
                            Kembali edit pesanan
                        </button>
                    </div>
                </div>
            </main>
        );

    return (
        <main className="min-h-screen bg-[#fcf9ff] px-4 py-6 text-[#11103d] sm:px-6 sm:py-8">
            <div className="mx-auto max-w-6xl">
                <Link
                    href={`/events/${event.id}`}
                    className="inline-flex items-center gap-2 text-sm font-bold text-[#5148df]"
                >
                    <ArrowLeft size={16} /> Kembali ke detail event
                </Link>
                <header className="mt-7 flex flex-col justify-between gap-5 border-b border-[#ebe7f5] pb-6 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-xs font-black tracking-[.14em] text-[#d42e98]">
                            CHECKOUT PREVIEW
                        </p>
                        <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                            Pilih tiket & review pesanan
                        </h1>
                        <p className="mt-2 text-sm text-[#77738b]">
                            Demo frontend — belum membuat transaksi atau
                            pembayaran nyata.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                        <span className="rounded-full bg-[#5148df] px-3 py-2 text-white">
                            1 Pilih tiket
                        </span>
                        <ChevronRight size={14} className="text-[#aaa4bd]" />
                        <span className="rounded-full bg-[#eae7ff] px-3 py-2 text-[#5148df]">
                            2 Review
                        </span>
                        <ChevronRight size={14} className="text-[#aaa4bd]" />
                        <span className="hidden rounded-full bg-white px-3 py-2 text-[#9a94ad] sm:inline">
                            3 Pembayaran
                        </span>
                    </div>
                </header>
                <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_360px] lg:items-start">
                    <section className="space-y-5">
                        <div className="flex gap-4 rounded-2xl bg-white p-4 shadow-[0_8px_25px_rgba(64,45,120,.07)]">
                            <img
                                src={event.image}
                                alt=""
                                className="h-24 w-28 rounded-xl object-cover"
                            />
                            <div className="min-w-0">
                                <span className="rounded-full bg-[#f0edff] px-2.5 py-1 text-[10px] font-bold text-[#5148df]">
                                    {event.category}
                                </span>
                                <h2 className="mt-2 truncate text-lg font-black">
                                    {event.title}
                                </h2>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#77738b]">
                                    <span className="flex items-center gap-1">
                                        <CalendarDays size={13} />
                                        {event.dateLabel}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock3 size={13} />
                                        {event.time}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MapPin size={13} />
                                        {event.location}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_25px_rgba(64,45,120,.07)] sm:p-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-black">
                                    Pilih tiket
                                </h2>
                                <span className="text-xs text-[#77738b]">
                                    {itemCount} tiket dipilih
                                </span>
                            </div>
                            <div className="mt-5 space-y-3">
                                {choices.map((choice) => (
                                    <div
                                        key={choice.id}
                                        className="flex flex-col gap-4 rounded-2xl border border-[#ebe7f5] p-4 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold">
                                                    {choice.name}
                                                </h3>
                                                <span className="text-xs font-bold text-[#5148df]">
                                                    {formatPrice(choice.price)}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs text-[#77738b]">
                                                {choice.description}
                                            </p>
                                            <p className="mt-2 text-[11px] text-[#9a94ad]">
                                                Tersedia {choice.available}{" "}
                                                tiket
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 self-end rounded-xl bg-[#f5f2ff] p-1 sm:self-auto">
                                            <button
                                                aria-label={`Kurangi ${choice.name}`}
                                                onClick={() =>
                                                    updateQuantity(
                                                        choice.id,
                                                        -1,
                                                    )
                                                }
                                                className="grid h-9 w-9 place-items-center rounded-lg text-[#5148df] hover:bg-white"
                                            >
                                                <Minus size={15} />
                                            </button>
                                            <span className="w-5 text-center text-sm font-black">
                                                {quantities[choice.id]}
                                            </span>
                                            <button
                                                aria-label={`Tambah ${choice.name}`}
                                                onClick={() =>
                                                    updateQuantity(choice.id, 1)
                                                }
                                                className="grid h-9 w-9 place-items-center rounded-lg bg-white text-[#5148df] shadow-sm hover:bg-[#eae7ff]"
                                            >
                                                <Plus size={15} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="grid gap-5 md:grid-cols-2">
                            <div className="rounded-2xl bg-white p-5 shadow-[0_8px_25px_rgba(64,45,120,.07)]">
                                <div className="flex items-center gap-2">
                                    <Ticket
                                        size={17}
                                        className="text-[#d42e98]"
                                    />
                                    <h2 className="font-black">
                                        Voucher event
                                    </h2>
                                </div>
                                <p className="mt-2 text-xs leading-5 text-[#77738b]">
                                    Voucher dari penyelenggara, hanya berlaku
                                    untuk event yang memenuhi syarat.
                                </p>
                                <div className="mt-4 flex gap-2">
                                    <input
                                        aria-label="Kode voucher event"
                                        value={voucher}
                                        onChange={(e) =>
                                            setVoucher(e.target.value)
                                        }
                                        placeholder="COFFEE10"
                                        className="min-w-0 flex-1 rounded-xl border border-[#ded9f0] px-3 text-sm outline-none focus:border-[#5148df] focus:ring-2 focus:ring-[#e5e2ff]"
                                    />
                                    <button
                                        onClick={
                                            voucherApplied
                                                ? () => {
                                                      setVoucherApplied(false);
                                                      setVoucherMessage(
                                                          "Voucher dihapus.",
                                                      );
                                                  }
                                                : applyVoucher
                                        }
                                        className="rounded-xl bg-[#5148df] px-3 text-xs font-bold text-white"
                                    >
                                        {voucherApplied ? "Hapus" : "Apply"}
                                    </button>
                                </div>
                                {voucherMessage && (
                                    <p
                                        className={`mt-2 text-xs font-bold ${voucherApplied ? "text-emerald-600" : "text-rose-500"}`}
                                    >
                                        {voucherMessage}
                                    </p>
                                )}
                            </div>
                            <div className="rounded-2xl bg-white p-5 shadow-[0_8px_25px_rgba(64,45,120,.07)]">
                                <div className="flex items-center gap-2">
                                    <Wallet
                                        size={17}
                                        className="text-[#5148df]"
                                    />
                                    <h2 className="font-black">
                                        Reward coupon
                                    </h2>
                                </div>
                                <p className="mt-2 text-xs leading-5 text-[#77738b]">
                                    Kupon reward dari aplikasi untuk event yang
                                    eligible.
                                </p>
                                <select
                                    aria-label="Pilih reward coupon"
                                    value={coupon}
                                    onChange={(e) => {
                                        setCoupon(e.target.value);
                                        setCouponApplied(false);
                                        setCouponMessage("");
                                    }}
                                    className="mt-4 w-full rounded-xl border border-[#ded9f0] bg-white px-3 py-3 text-sm outline-none focus:border-[#5148df]"
                                >
                                    <option value="">
                                        Pilih kupon tersedia
                                    </option>
                                    {rewardCoupons.map((item) => (
                                        <option
                                            key={item.code}
                                            value={item.code}
                                        >
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                                {coupon && (
                                    <p className="mt-2 text-[11px] text-[#77738b]">
                                        {
                                            rewardCoupons.find(
                                                (item) => item.code === coupon,
                                            )?.expires
                                        }
                                    </p>
                                )}
                                <button
                                    onClick={
                                        couponApplied
                                            ? () => {
                                                  setCouponApplied(false);
                                                  setCouponMessage(
                                                      "Kupon dihapus.",
                                                  );
                                              }
                                            : applyCoupon
                                    }
                                    className="mt-3 w-full rounded-xl border border-[#5148df] py-2.5 text-xs font-bold text-[#5148df]"
                                >
                                    {couponApplied
                                        ? "Hapus coupon"
                                        : "Apply coupon"}
                                </button>
                                {couponMessage && (
                                    <p
                                        className={`mt-2 text-xs font-bold ${couponApplied ? "text-emerald-600" : "text-rose-500"}`}
                                    >
                                        {couponMessage}
                                    </p>
                                )}
                            </div>
                        </div>
                    </section>
                    <aside className="sticky top-5 rounded-2xl bg-white p-5 shadow-[0_12px_35px_rgba(64,45,120,.1)] sm:p-6">
                        <h2 className="text-xl font-black">
                            Ringkasan pesanan
                        </h2>
                        <div className="mt-5 space-y-3 border-b border-dashed border-[#ded9f0] pb-5">
                            {selected.length ? (
                                selected.map((choice) => (
                                    <div
                                        key={choice.id}
                                        className="flex justify-between gap-3 text-sm"
                                    >
                                        <span>
                                            {choice.name} ×{" "}
                                            {quantities[choice.id]}
                                        </span>
                                        <strong>
                                            {formatPrice(
                                                choice.price *
                                                    quantities[choice.id],
                                            )}
                                        </strong>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-[#9a94ad]">
                                    Belum ada tiket dipilih.
                                </p>
                            )}
                        </div>
                        <div className="space-y-3 py-5 text-sm">
                            <div className="flex justify-between">
                                <span className="text-[#77738b]">
                                    Subtotal tiket
                                </span>
                                <strong>{formatPrice(subtotal)}</strong>
                            </div>
                            {voucherApplied && (
                                <div className="flex justify-between text-emerald-600">
                                    <span>Voucher event (10%)</span>
                                    <strong>
                                        - {formatPrice(voucherDiscount)}
                                    </strong>
                                </div>
                            )}
                            {couponApplied && (
                                <div className="flex justify-between text-emerald-600">
                                    <span>Reward coupon</span>
                                    <strong>
                                        - {formatPrice(couponDiscount)}
                                    </strong>
                                </div>
                            )}
                            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl bg-[#f7f5ff] p-3">
                                <span>
                                    <span className="block font-bold">
                                        Gunakan 20.000 poin
                                    </span>
                                    <span className="mt-1 block text-[11px] text-[#77738b]">
                                        Saldo tersedia: 20.000 poin
                                    </span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={usePoints}
                                    onChange={(e) =>
                                        setUsePoints(e.target.checked)
                                    }
                                    className="mt-1 h-4 w-4 accent-[#5148df]"
                                />
                            </label>
                            {usePoints && (
                                <div className="flex justify-between text-emerald-600">
                                    <span>Potongan poin</span>
                                    <strong>
                                        - {formatPrice(pointsDiscount)}
                                    </strong>
                                </div>
                            )}
                        </div>
                        <div className="flex items-end justify-between border-t border-[#ebe7f5] pt-5">
                            <span className="text-sm font-bold">
                                Total pembayaran
                            </span>
                            <strong className="text-2xl font-black text-[#5148df]">
                                {formatPrice(total)}
                            </strong>
                        </div>
                        <button
                            onClick={() =>
                                itemCount
                                    ? setConfirming(true)
                                    : setVoucherMessage(
                                          "Pilih minimal satu tiket untuk melanjutkan.",
                                      )
                            }
                            className="mt-5 w-full rounded-xl bg-[#5148df] py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-[#4039c9]"
                        >
                            Continue to Payment
                        </button>
                        <p className="mt-3 text-center text-[11px] leading-4 text-[#9a94ad]">
                            Harga transparan. Belum ada transaksi nyata.
                        </p>
                    </aside>
                </div>
            </div>
            {confirming && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-title"
                    className="fixed inset-0 z-50 grid place-items-center bg-[#171333]/45 p-4"
                >
                    <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-black tracking-[.14em] text-[#d42e98]">
                                    KONFIRMASI ORDER
                                </p>
                                <h2
                                    id="confirm-title"
                                    className="mt-2 text-2xl font-black"
                                >
                                    Sudah sesuai?
                                </h2>
                            </div>
                            <button
                                aria-label="Tutup dialog"
                                onClick={() => setConfirming(false)}
                                className="rounded-full p-2 text-[#77738b] hover:bg-[#f3f1fa]"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <p className="mt-4 text-sm text-[#77738b]">
                            {event.title}
                        </p>
                        <div className="mt-5 space-y-3 rounded-2xl bg-[#f7f5ff] p-4 text-sm">
                            {selected.map((choice) => (
                                <div
                                    key={choice.id}
                                    className="flex justify-between"
                                >
                                    <span>
                                        {choice.name} × {quantities[choice.id]}
                                    </span>
                                    <strong>
                                        {formatPrice(
                                            choice.price *
                                                quantities[choice.id],
                                        )}
                                    </strong>
                                </div>
                            ))}
                            <div className="border-t border-[#e4dff4] pt-3">
                                <div className="flex justify-between font-black">
                                    <span>Total</span>
                                    <span className="text-[#5148df]">
                                        {formatPrice(total)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-5 flex gap-3">
                            <button
                                onClick={() => setConfirming(false)}
                                className="flex-1 rounded-xl border border-[#ded9f0] py-3 text-sm font-bold text-[#5148df]"
                            >
                                Edit pesanan
                            </button>
                            <button
                                onClick={() => {
                                    setConfirming(false);
                                    setPaymentStage(true);
                                }}
                                className="flex-1 rounded-xl bg-[#5148df] py-3 text-sm font-bold text-white"
                            >
                                Konfirmasi
                            </button>
                        </div>
                        <p className="mt-4 flex gap-2 text-xs leading-5 text-[#8a849f]">
                            <Check
                                size={14}
                                className="mt-0.5 shrink-0 text-emerald-500"
                            />
                            Ini hanya prototype frontend. Tidak membuat
                            transaksi, memesan kursi, atau memotong poin
                            sungguhan.
                        </p>
                    </div>
                </div>
            )}
        </main>
    );
}
