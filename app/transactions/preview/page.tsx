
"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { useState } from "react";
import {
    ArrowLeft,
    CheckCircle2,
    Clock3,
    Copy,
    Info,
    XCircle,
} from "lucide-react";

type TransactionStatus =
    | "WAITING_FOR_PAYMENT"
    | "WAITING_FOR_ADMIN_CONFIRMATION"
    | "DONE"
    | "REJECTED"
    | "EXPIRED"
    | "CANCELED";

const statusOptions: {
    value: TransactionStatus;
    label: string;
}[] = [
    { value: "WAITING_FOR_PAYMENT", label: "Waiting for payment" },
    {
        value: "WAITING_FOR_ADMIN_CONFIRMATION",
        label: "Waiting for admin confirmation",
    },
    { value: "DONE", label: "Payment successful" },
    { value: "REJECTED", label: "Payment rejected" },
    { value: "EXPIRED", label: "Payment expired" },
    { value: "CANCELED", label: "Transaction canceled" },
];

const statusDisplay: Record<
    TransactionStatus,
    { title: string; description: string; color: string }
> = {
    WAITING_FOR_PAYMENT: {
        title: "Menunggu pembayaran",
        description: "Silakan selesaikan pembayaran sebelum batas waktu yang ditentukan.",
        color: "amber",
    },
    WAITING_FOR_ADMIN_CONFIRMATION: {
        title: "Pembayaran sedang diverifikasi",
        description: "Bukti pembayaran kamu sudah diterima dan sedang diperiksa oleh tim kami.",
        color: "blue",
    },
    DONE: {
        title: "Pembayaran berhasil!",
        description: "Pembayaran telah dikonfirmasi. Tiket kamu siap digunakan.",
        color: "emerald",
    },
    REJECTED: {
        title: "Pembayaran ditolak",
        description: "Bukti pembayaran tidak dapat diverifikasi. Silakan periksa detail transaksi.",
        color: "rose",
    },
    EXPIRED: {
        title: "Transaksi kedaluwarsa",
        description: "Batas waktu pembayaran telah berakhir.",
        color: "gray",
    },
    CANCELED: {
        title: "Transaksi dibatalkan",
        description: "Transaksi ini telah dibatalkan dan tidak dapat dilanjutkan.",
        color: "gray",
    },
};

const mockTransaction = {
    event: "Jakarta Coffee Week 2026",
    date: "Saturday, 21 November 2026",
    time: "10:00 - 18:00 WIB",
    venue: "Indonesia Convention Exhibition",
    location: "BSD City, Tangerang",
    tickets: [
        { name: "Regular Admission", quantity: 2, price: 150000 },
        { name: "Workshop Pass", quantity: 1, price: 100000 },
    ],
    subtotal: 400000,
    discount: 25000,
    total: 375000,
    paymentMethod: "Bank Transfer",
    bank: "BCA",
    accountNumber: "1234567890",
    accountName: "PT TemuEvent Indonesia",
    orderDate: "14 November 2026, 16:30 WIB",
    deadline: "14 November 2026, 18:30 WIB",
};

const formatPrice = (price: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    })
        .format(price)
        .replace("IDR", "Rp");

export default function TransactionPreviewPage() {
    return <><SiteHeader view="checkout" /><TransactionPreview transactionId="preview" /></>;
}

function TransactionPreview({ transactionId }: { transactionId: string }) {
    const [status, setStatus] = useState<TransactionStatus>("WAITING_FOR_PAYMENT");
    const [paymentProof, setPaymentProof] = useState<File | null>(null);

    return (
        <main className="min-h-screen bg-[#fcf9ff] px-4 py-8 text-[#11103d] sm:px-6">
            <div className="mx-auto max-w-5xl">
                <p role="note" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    Pratinjau transaksi dengan data contoh. Pilihan file dan perubahan status hanya berlaku di halaman ini; belum ada pesanan, unggahan, atau pembayaran yang disimpan.
                </p>

                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-bold text-[#5148df]"
                >
                    <ArrowLeft size={16} />
                    Kembali ke Explore
                </Link>

                <header className="mt-7">
                    <p className="text-xs font-black tracking-[.14em] text-[#d42e98]">
                        TRANSACTION CENTER
                    </p>
                    <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                        Detail transaksi
                    </h1>
                    <p className="mt-2 text-sm text-[#77738b]">
                        Tinjau pembayaran dan status pesanan tiket kamu.
                    </p>
                </header>

                <section className="mt-6 rounded-2xl border border-[#ebe7f5] bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="mt-1">
                            {status === "DONE" ? (
                                <CheckCircle2 className="text-emerald-600" size={24} />
                            ) : status === "REJECTED" || status === "EXPIRED" || status === "CANCELED" ? (
                                <XCircle className="text-rose-500" size={24} />
                            ) : (
                                <Clock3 className="text-amber-500" size={24} />
                            )}
                        </div>

                        <div>
                            <h2 className="font-black text-lg">
                                {statusDisplay[status].title}
                            </h2>
                            <p className="mt-1 text-sm text-[#77738b]">
                                {statusDisplay[status].description}
                            </p>
                        </div>
                    </div>
                </section>

                <section className="mt-7 rounded-3xl border border-[#ebe7f5] bg-white p-6 shadow-[0_12px_40px_rgba(64,45,120,.07)] sm:p-8">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row">
                        <div>
                            <p className="text-xs text-[#9690a7]">
                                Transaction ID
                            </p>
                            <p className="mt-1 font-black">
                                {transactionId}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-[#9690a7]">
                                Order date
                            </p>
                            <p className="mt-1 text-sm font-bold">
                                {mockTransaction.orderDate}
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 border-t border-[#eeeaf5] pt-6">
                        <h2 className="text-xl font-black">
                            {mockTransaction.event}
                        </h2>
                        <p className="mt-2 text-sm text-[#77738b]">
                            {mockTransaction.date} · {mockTransaction.time}
                        </p>
                        <p className="mt-1 text-sm text-[#77738b]">
                            {mockTransaction.venue}, {mockTransaction.location}
                        </p>
                    </div>
                </section>

                <section className="mt-6 rounded-3xl border border-[#ebe7f5] bg-white p-6 shadow-sm sm:p-8">
                    <h2 className="text-xl font-black">
                        Rincian pesanan
                    </h2>

                    <div className="mt-5 space-y-4">
                        {mockTransaction.tickets.map((ticket) => (
                            <div
                                key={ticket.name}
                                className="flex justify-between gap-4 text-sm"
                            >
                                <span className="text-[#77738b]">
                                    {ticket.name} × {ticket.quantity}
                                </span>
                                <strong>
                                    {formatPrice(ticket.price * ticket.quantity)}
                                </strong>
                            </div>
                        ))}
                    </div>

                    <div className="mt-5 space-y-3 border-t border-dashed border-[#ded9f0] pt-5 text-sm">
                        <div className="flex justify-between">
                            <span className="text-[#77738b]">Subtotal</span>
                            <strong>{formatPrice(mockTransaction.subtotal)}</strong>
                        </div>
                        <div className="flex justify-between text-emerald-600">
                            <span>Discount</span>
                            <strong>- {formatPrice(mockTransaction.discount)}</strong>
                        </div>
                        <div className="flex justify-between border-t border-[#ebe7f5] pt-4 text-base">
                            <strong>Total pembayaran</strong>
                            <strong className="text-xl text-[#5148df]">
                                {formatPrice(mockTransaction.total)}
                            </strong>
                        </div>
                    </div>
                </section>

                {status === "WAITING_FOR_PAYMENT" && (
                    <section className="mt-6 rounded-3xl border border-[#ebe7f5] bg-white p-6 shadow-sm sm:p-8">
                    <h2 className="text-xl font-black">
                        Payment information
                    </h2>

                    <p className="mt-3 text-sm text-[#77738b]">
                        {mockTransaction.paymentMethod} · {mockTransaction.bank}
                    </p>

                    <div className="mt-4 rounded-2xl bg-[#f7f5ff] p-4">
                        <p className="text-xs text-[#77738b]">
                                Nomor rekening contoh
                        </p>

                        <div className="mt-1 flex items-center justify-between gap-3">
                            <p className="text-lg font-black">
                                {mockTransaction.accountNumber}
                            </p>

                            <button
                                type="button"
                                onClick={() =>
                                    navigator.clipboard.writeText(mockTransaction.accountNumber)
                                }
                                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#5148df] shadow-sm transition hover:bg-[#ebe7ff]"
                            >
                                <Copy size={14} />
                                Salin
                            </button>
                        </div>

                        <p className="mt-1 text-xs text-[#77738b]">
                            A/N {mockTransaction.accountName}
                        </p>
                    </div>

                    <p className="mt-4 text-sm text-[#77738b]">
                        Batas pembayaran: {mockTransaction.deadline}
                    </p>
                    <div className="mt-6 border-t border-[#ebe7f5] pt-6">
                        <h3 className="font-black">
                            Upload bukti pembayaran
                        </h3>

                        <p className="mt-2 text-sm text-[#77738b]">
                            Upload screenshot atau dokumen bukti transfer kamu.
                            Format JPG, PNG, atau PDF.
                        </p>

                        <input
                            type="file"
                            aria-label="Pilih contoh bukti pembayaran"
                            accept="image/png,image/jpeg,application/pdf"
                            onChange={(e) =>
                                setPaymentProof(e.target.files?.[0] ?? null)
                            }
                            className="mt-4 block w-full text-sm text-[#77738b] file:mr-4 file:rounded-xl file:border-0 file:bg-[#f0edff] file:px-4 file:py-3 file:font-bold file:text-[#5148df] hover:file:bg-[#e7e2ff]"
                        />

                        {paymentProof && (
                            <p className="mt-3 text-sm font-semibold text-[#5148df]">
                                File dipilih: {paymentProof.name}
                            </p>
                        )}

                        <button
                            type="button"
                            disabled={!paymentProof}
                            onClick={() => {
                                setStatus("WAITING_FOR_ADMIN_CONFIRMATION");
                            }}
                            className="mt-5 w-full rounded-xl bg-[#5148df] px-5 py-3 font-bold text-white transition hover:bg-[#4037c7] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                        >
                            Kirim bukti pembayaran
                        </button>
                    </div>
                    </section>
                )}

                {status === "WAITING_FOR_ADMIN_CONFIRMATION" && (
                    <section className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-6 shadow-sm sm:p-8">
                        <div className="flex items-start gap-3">
                            <Clock3
                                size={24}
                                className="mt-1 shrink-0 text-blue-600"
                            />
                            <div>
                                <h2 className="text-lg font-black text-blue-900">
                                    Bukti pembayaran sedang diverifikasi
                                </h2>
                                <p className="mt-2 text-sm leading-relaxed text-blue-800">
                                    Tim TemuEvent sedang memeriksa bukti
                                    pembayaran kamu. Proses verifikasi
                                    membutuhkan waktu hingga 1 × 24 jam.
                                </p>
                            </div>
                        </div>

                        {paymentProof && (
                            <div className="mt-5 rounded-xl border border-blue-100 bg-white p-4">
                                <p className="text-xs text-blue-600">
                                    Bukti pembayaran yang dikirim
                                </p>
                                <p className="mt-1 break-all text-sm font-bold text-blue-900">
                                    {paymentProof.name}
                                </p>
                            </div>
                        )}

                        <p className="mt-5 text-xs text-blue-700">
                            Status transaksi: Menunggu konfirmasi admin
                        </p>
                    </section>
                )}

                {status === "DONE" && (
                    <section className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50 p-6 shadow-sm sm:p-8">
                        <div className="flex items-start gap-3">
                            <CheckCircle2
                                size={28}
                                className="shrink-0 text-emerald-600"
                            />
                            <div>
                                <h2 className="text-xl font-black text-emerald-900">
                                    Pembayaran berhasil!
                                </h2>
                                <p className="mt-2 text-sm leading-relaxed text-emerald-800">
                                    Pembayaran kamu telah dikonfirmasi.
                                    Terima kasih telah menggunakan TemuEvent.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 rounded-2xl border border-emerald-100 bg-white p-5">
                            <p className="text-xs font-bold tracking-wider text-emerald-600">
                                TICKET INFORMATION
                            </p>

                            <h3 className="mt-3 text-lg font-black">
                                {mockTransaction.event}
                            </h3>

                            <p className="mt-2 text-sm text-[#77738b]">
                                {mockTransaction.date}
                            </p>

                            <div className="mt-5 border-t border-dashed border-emerald-100 pt-5">
                                <p className="text-xs text-[#77738b]">
                                    Ticket reference
                                </p>
                                <p className="mt-1 text-lg font-black text-[#5148df]">
                                    TME-2026-000123
                                </p>

                                <p className="mt-4 text-sm text-[#77738b]">
                                    Total tiket: 3
                                </p>
                            </div>

                            <div className="mt-5 rounded-xl bg-[#f7f5ff] p-4 text-center">
                                <p className="text-sm font-bold text-[#5148df]">
                                    QR Code akan tersedia di halaman tiket
                                </p>
                                <p className="mt-1 text-xs text-[#77738b]">
                                    Ini masih merupakan mockup. QR Code asli
                                    akan dibuat setelah integrasi backend.
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {status === "REJECTED" && (
                    <section className="mt-6 rounded-3xl border border-rose-100 bg-rose-50 p-6 shadow-sm sm:p-8">
                        <div className="flex items-start gap-3">
                            <XCircle
                                size={28}
                                className="shrink-0 text-rose-600"
                            />
                            <div>
                                <h2 className="text-xl font-black text-rose-900">
                                    Pembayaran ditolak
                                </h2>
                                <p className="mt-2 text-sm leading-relaxed text-rose-800">
                                    Bukti pembayaran kamu belum dapat
                                    diverifikasi oleh tim TemuEvent.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 rounded-2xl border border-rose-100 bg-white p-5">
                            <p className="text-xs font-bold text-rose-600">
                                ALASAN PENOLAKAN
                            </p>
                            <p className="mt-2 text-sm text-[#77738b]">
                                Nominal transfer atau informasi pada bukti
                                pembayaran tidak sesuai dengan detail transaksi.
                            </p>
                        </div>

                        <div className="mt-5">
                            <h3 className="font-black text-rose-900">
                                Apa yang bisa kamu lakukan?
                            </h3>
                            <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-rose-800">
                                <li>Periksa kembali nominal transfer.</li>
                                <li>Pastikan bukti pembayaran terbaca dengan jelas.</li>
                                <li>Hubungi customer support jika membutuhkan bantuan.</li>
                            </ul>
                        </div>
                    </section>
                )}

                {(status === "EXPIRED" || status === "CANCELED") && (
                    <section className="mt-6 rounded-3xl border border-gray-200 bg-gray-50 p-6 shadow-sm sm:p-8">
                        <div className="flex items-start gap-3">
                            <Info
                                size={28}
                                className="shrink-0 text-gray-500"
                            />
                            <div>
                                <h2 className="text-xl font-black text-gray-900">
                                    {status === "EXPIRED"
                                        ? "Waktu pembayaran telah berakhir"
                                        : "Transaksi dibatalkan"}
                                </h2>

                                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                                    {status === "EXPIRED"
                                        ? "Batas waktu pembayaran telah berakhir. Transaksi ini tidak dapat dilanjutkan."
                                        : "Transaksi ini telah dibatalkan dan tidak dapat dilanjutkan."}
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5">
                            <p className="text-sm font-bold text-gray-800">
                                Ingin mengikuti acara ini?
                            </p>
                            <p className="mt-2 text-sm text-gray-600">
                                Kamu dapat kembali ke halaman acara untuk
                                memeriksa ketersediaan tiket dan membuat
                                transaksi baru.
                            </p>

                            <Link
                                href="/"
                                className="mt-4 inline-flex rounded-xl bg-[#5148df] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#4037c7]"
                            >
                                Kembali ke Explore
                            </Link>
                        </div>
                    </section>
                )}

                <section className="mt-6 rounded-3xl border border-[#ebe7f5] bg-white p-6 shadow-sm sm:p-8">
                    <h2 className="text-xl font-black">
                        Development preview
                    </h2>
                    <p className="mt-2 text-sm text-[#77738b]">
                        Change the transaction status to preview different
                        payment outcomes.
                    </p>

                    <select
                        aria-label="Pratinjau status transaksi"
                        value={status}
                        onChange={(e) =>
                            setStatus(e.target.value as TransactionStatus)
                        }
                        className="mt-4 w-full rounded-xl border border-[#ded9f0] bg-white px-4 py-3 text-sm outline-none focus:border-[#5148df]"
                    >
                        {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    <div className="mt-5 rounded-xl bg-[#f7f5ff] p-4">
                        <p className="text-xs font-bold text-[#9690a7]">
                            CURRENT PREVIEW STATUS
                        </p>

                        <p className="mt-2 font-black text-[#5148df]">
                            {statusDisplay[status].title}
                        </p>

                        <p className="mt-1 text-sm text-[#77738b]">
                            {statusDisplay[status].description}
                        </p>
                    </div>
                </section>

            </div>
        </main>
    );
}
