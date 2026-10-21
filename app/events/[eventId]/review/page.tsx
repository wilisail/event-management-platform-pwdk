"use client";

import Link from "next/link";
import { use, useState } from "react";
import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    Star,
} from "lucide-react";
import { events } from "@/lib/events";

type Review = {
    id: string;
    eventId: number;
    attendeeId: string;
    rating: number;
    text: string;
    createdAt: string;
};

const labels = [
    "",
    "Sangat buruk",
    "Kurang memuaskan",
    "Cukup baik",
    "Memuaskan",
    "Sangat memuaskan",
];
const sampleReviews: Review[] = [
    {
        id: "review-1",
        eventId: 1,
        attendeeId: "attendee-ayu",
        rating: 5,
        text: "Pilihan kopinya beragam dan semua booth sangat ramah. Sesi cupping-nya juga informatif.",
        createdAt: "28 Mei 2025",
    },
    {
        id: "review-2",
        eventId: 1,
        attendeeId: "attendee-raka",
        rating: 4,
        text: "Venue nyaman dan acaranya tertata dengan baik. Akan datang lagi tahun depan.",
        createdAt: "27 Mei 2025",
    },
];

export default function EventReviewPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId: rawEventId } = use(params);
    const event = events.find((item) => item.id === Number(rawEventId));
    const [rating, setRating] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [reviewText, setReviewText] = useState("");
    const [errors, setErrors] = useState<{ rating?: string; text?: string }>(
        {},
    );
    const [submitted, setSubmitted] = useState<Review | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    if (!event)
        return (
            <main className="min-h-screen bg-[#fcf9ff] px-5 py-20 text-[#11103d]">
                <div className="mx-auto max-w-xl rounded-3xl bg-white p-10 text-center shadow-sm">
                    <h1 className="text-2xl font-black">
                        Event tidak ditemukan
                    </h1>
                    <Link
                        href="/#explore"
                        className="mt-6 inline-flex rounded-full bg-[#5148df] px-5 py-3 text-sm font-bold text-white"
                    >
                        Kembali ke Explore
                    </Link>
                </div>
            </main>
        );

    const eligible = event.id === 1;
    const alreadyReviewed = sampleReviews.some(
        (review) =>
            review.eventId === event.id &&
            review.attendeeId === "current-attendee",
    );
    const hasOccurred = new Date(event.date) < new Date("2026-10-21");
    const canReview = eligible && hasOccurred && !alreadyReviewed && !submitted;
    const displayRating = hovered || rating;

    const validate = () => {
        const next: typeof errors = {};
        if (!rating) next.rating = "Pilih rating dari 1 sampai 5 bintang.";
        const trimmed = reviewText.trim();
        if (trimmed.length < 10)
            next.text = "Tulis ulasan minimal 10 karakter.";
        if (trimmed.length > 1000)
            next.text = "Ulasan maksimal 1.000 karakter.";
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const requestSubmit = () => {
        if (validate() && canReview) setConfirming(true);
    };
    const confirmSubmit = () => {
        setSubmitting(true);
        setTimeout(() => {
            setSubmitted({
                id: `review-${Date.now()}`,
                eventId: event.id,
                attendeeId: "current-attendee",
                rating,
                text: reviewText.trim(),
                createdAt: "Hari ini",
            });
            setSubmitting(false);
            setConfirming(false);
        }, 650);
    };

    return (
        <main className="min-h-screen bg-[#fcf9ff] text-[#11103d]">
            <header className="border-b border-[#eee9fb] bg-white">
                <div className="mx-auto flex h-16 max-w-[1050px] items-center justify-between px-5">
                    <Link href="/" className="font-black tracking-tight">
                        ✦ Temu<span className="text-[#e539a7]">Event</span>
                    </Link>
                    <Link
                        href={`/events/${event.id}`}
                        className="flex items-center gap-2 text-xs font-bold text-[#5148df]"
                    >
                        <ArrowLeft size={15} /> Kembali ke event
                    </Link>
                </div>
            </header>
            <div className="mx-auto max-w-[1050px] px-5 py-8 sm:py-12">
                <div className="mb-8 flex items-center gap-2 text-xs text-[#8c879e]">
                    <Link href={`/events/${event.id}`}>Detail event</Link>
                    <ChevronRight size={14} />
                    <span className="font-bold text-[#5148df]">
                        Bagikan pengalaman
                    </span>
                </div>
                <div className="grid gap-8 lg:grid-cols-[1fr_310px]">
                    <section>
                        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#e03c9b]">
                            Ulasan peserta
                        </p>
                        <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                            Bagikan Pengalamanmu
                        </h1>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-[#77738b]">
                            Ceritakan pengalamanmu agar peserta lain tahu apa
                            yang bisa mereka harapkan.
                        </p>
                        {submitted ? (
                            <div className="mt-8 rounded-3xl border border-emerald-100 bg-emerald-50 p-7">
                                <CheckCircle2 className="text-emerald-600" />
                                <h2 className="mt-4 text-xl font-black text-emerald-900">
                                    Ulasan berhasil dikirim
                                </h2>
                                <p className="mt-2 text-sm text-emerald-800">
                                    Terima kasih sudah membantu peserta lain
                                    mengenal event ini.
                                </p>
                                <div
                                    className="mt-5 flex gap-1"
                                    aria-label={`${submitted.rating} dari 5 bintang`}
                                >
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            size={18}
                                            fill={
                                                star <= submitted.rating
                                                    ? "currentColor"
                                                    : "none"
                                            }
                                            className={
                                                star <= submitted.rating
                                                    ? "text-[#f6b51d]"
                                                    : "text-[#c9c4d4]"
                                            }
                                        />
                                    ))}
                                </div>
                                <Link
                                    href={`/events/${event.id}`}
                                    className="mt-6 inline-flex rounded-full bg-[#5148df] px-5 py-3 text-sm font-bold text-white"
                                >
                                    Kembali ke event
                                </Link>
                            </div>
                        ) : canReview ? (
                            <div className="mt-8 rounded-3xl bg-white p-6 shadow-[0_12px_40px_rgba(64,45,120,.08)] sm:p-8">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        requestSubmit();
                                    }}
                                    noValidate
                                >
                                    <fieldset>
                                        <legend className="text-base font-black">
                                            Bagaimana pengalamanmu?
                                        </legend>
                                        <div
                                            className="mt-4 flex gap-2"
                                            onMouseLeave={() => setHovered(0)}
                                        >
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    aria-label={`${star} bintang`}
                                                    aria-pressed={
                                                        rating === star
                                                    }
                                                    onMouseEnter={() =>
                                                        setHovered(star)
                                                    }
                                                    onFocus={() =>
                                                        setHovered(star)
                                                    }
                                                    onBlur={() => setHovered(0)}
                                                    onKeyDown={(e) => {
                                                        if (
                                                            e.key ===
                                                            "ArrowRight"
                                                        )
                                                            setRating(
                                                                Math.min(
                                                                    5,
                                                                    star + 1,
                                                                ),
                                                            );
                                                        if (
                                                            e.key ===
                                                            "ArrowLeft"
                                                        )
                                                            setRating(
                                                                Math.max(
                                                                    1,
                                                                    star - 1,
                                                                ),
                                                            );
                                                    }}
                                                    onClick={() =>
                                                        setRating(star)
                                                    }
                                                    className="rounded-lg p-1 text-[#f6b51d] outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-[#5148df]"
                                                >
                                                    <Star
                                                        size={31}
                                                        fill={
                                                            star <=
                                                            displayRating
                                                                ? "currentColor"
                                                                : "none"
                                                        }
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                        {rating > 0 && (
                                            <p className="mt-2 text-sm font-bold text-[#5148df]">
                                                {labels[rating]}
                                            </p>
                                        )}
                                        {errors.rating && (
                                            <p
                                                role="alert"
                                                className="mt-2 text-xs font-semibold text-red-600"
                                            >
                                                {errors.rating}
                                            </p>
                                        )}
                                    </fieldset>
                                    <div className="mt-8">
                                        <label
                                            htmlFor="review"
                                            className="text-base font-black"
                                        >
                                            Ceritakan pengalamanmu
                                        </label>
                                        <textarea
                                            id="review"
                                            value={reviewText}
                                            onChange={(e) =>
                                                setReviewText(e.target.value)
                                            }
                                            maxLength={1000}
                                            aria-invalid={Boolean(errors.text)}
                                            placeholder="Bagaimana penyelenggaraan, konten, venue, atau pengalaman keseluruhanmu?"
                                            className="mt-3 min-h-36 w-full resize-y rounded-2xl border border-[#e5e0f0] bg-[#fcfaff] p-4 text-sm outline-none transition placeholder:text-[#aaa5b7] focus:border-[#5148df] focus:ring-4 focus:ring-[#5148df]/10"
                                        />
                                        {errors.text ? (
                                            <p
                                                role="alert"
                                                className="mt-2 text-xs font-semibold text-red-600"
                                            >
                                                {errors.text}
                                            </p>
                                        ) : (
                                            <p className="mt-2 text-right text-xs text-[#9893a8]">
                                                {reviewText.length}/1.000
                                            </p>
                                        )}
                                    </div>
                                    <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                        <Link
                                            href={`/events/${event.id}`}
                                            className="rounded-full border border-[#e3dff0] px-5 py-3 text-center text-sm font-bold text-[#68637a]"
                                        >
                                            Batal
                                        </Link>
                                        <button
                                            type="submit"
                                            className="rounded-full bg-[#5148df] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-[#4038c6]"
                                        >
                                            Kirim Ulasan
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div
                                role="status"
                                className="mt-8 rounded-3xl border border-[#e6e1f2] bg-white p-7 shadow-sm"
                            >
                                <h2 className="text-lg font-black">
                                    Belum bisa memberikan ulasan
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-[#77738b]">
                                    {alreadyReviewed
                                        ? "Kamu sudah memberikan ulasan untuk event ini."
                                        : !hasOccurred
                                          ? "Ulasan baru bisa diberikan setelah event selesai."
                                          : "Kamu hanya bisa memberikan ulasan setelah menghadiri event ini."}
                                </p>
                                <Link
                                    href={`/events/${event.id}`}
                                    className="mt-5 inline-flex rounded-full bg-[#eeeaff] px-5 py-3 text-sm font-bold text-[#5148df]"
                                >
                                    Lihat detail event
                                </Link>
                            </div>
                        )}
                        <section className="mt-10">
                            <h2 className="text-xl font-black">
                                Ulasan peserta lainnya
                            </h2>
                            {sampleReviews.filter(
                                (review) => review.eventId === event.id,
                            ).length ? (
                                <div className="mt-4 grid gap-3">
                                    {sampleReviews
                                        .filter(
                                            (review) =>
                                                review.eventId === event.id,
                                        )
                                        .map((review) => (
                                            <article
                                                key={review.id}
                                                className="rounded-2xl border border-[#ece8f5] bg-white p-5"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="grid size-9 place-items-center rounded-full bg-[#eeeaff] text-xs font-black text-[#5148df]">
                                                            {review.attendeeId ===
                                                            "attendee-ayu"
                                                                ? "AS"
                                                                : "RN"}
                                                        </div>
                                                        <span className="text-sm font-bold">
                                                            {review.attendeeId ===
                                                            "attendee-ayu"
                                                                ? "Ayu Sari"
                                                                : "Raka Nugraha"}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-[#9893a8]">
                                                        {review.createdAt}
                                                    </span>
                                                </div>
                                                <div className="mt-3 flex gap-1">
                                                    {[1, 2, 3, 4, 5].map(
                                                        (star) => (
                                                            <Star
                                                                key={star}
                                                                size={14}
                                                                fill={
                                                                    star <=
                                                                    review.rating
                                                                        ? "currentColor"
                                                                        : "none"
                                                                }
                                                                className={
                                                                    star <=
                                                                    review.rating
                                                                        ? "text-[#f6b51d]"
                                                                        : "text-[#c9c4d4]"
                                                                }
                                                            />
                                                        ),
                                                    )}
                                                </div>
                                                <p className="mt-3 text-sm leading-6 text-[#69657c]">
                                                    {review.text}
                                                </p>
                                            </article>
                                        ))}
                                </div>
                            ) : (
                                <p className="mt-4 rounded-2xl bg-white p-5 text-sm text-[#77738b]">
                                    Belum ada ulasan. Jadilah yang pertama
                                    berbagi pengalaman.
                                </p>
                            )}
                        </section>
                    </section>
                    <aside className="h-fit rounded-3xl bg-white p-5 shadow-sm">
                        <img
                            src={event.image}
                            alt=""
                            className="h-36 w-full rounded-2xl object-cover"
                        />
                        <h2 className="mt-4 font-black leading-5">
                            {event.title}
                        </h2>
                        <p className="mt-2 text-xs font-semibold text-[#5148df]">
                            {event.organizer}
                        </p>
                        <div className="mt-4 flex gap-2 text-xs text-[#77738b]">
                            <CalendarDays
                                size={15}
                                className="shrink-0 text-[#5148df]"
                            />
                            {event.dateLabel}
                        </div>
                    </aside>
                </div>
            </div>
            {confirming && (
                <div className="fixed inset-0 z-30 grid place-items-center bg-[#16122c]/50 p-5">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="confirm-title"
                        className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl"
                    >
                        <h2 id="confirm-title" className="text-xl font-black">
                            Kirim ulasan ini?
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-[#77738b]">
                            Kamu memberikan rating <strong>{rating}/5</strong> —{" "}
                            {labels[rating].toLowerCase()}. Pastikan ceritamu
                            sudah sesuai.
                        </p>
                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={() => setConfirming(false)}
                                className="rounded-full border border-[#e3dff0] px-5 py-3 text-sm font-bold text-[#68637a]"
                            >
                                Periksa lagi
                            </button>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={confirmSubmit}
                                className="rounded-full bg-[#5148df] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                            >
                                {submitting
                                    ? "Mengirim..."
                                    : "Ya, Kirim Ulasan"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
