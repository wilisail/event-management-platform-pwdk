"use client";

import { SiteHeader } from "@/components/site-header";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    Star,
} from "lucide-react";

import { useAuth } from "@/feature-2/components/auth-provider";
import { accountError } from "@/feature-2/lib/auth-client";
import type { EventReviewEligibility } from "@/feature-2/contracts/types";

type Review = {
    id: string;
    eventId: string;
    userId: string;
    reviewerName: string;
    rating: number;
    comment: string | null;
    createdAt: string;
};

type Event = {
    id: string;
    title: string;
    category: string;
    date: string;
    endDate: string;
    location: string;
    venue: string;
    address: string;
    description: string;
    image: string | null;
    price: number | null;
    availableSeats: number;
    organizerId: string;
    organizer: string;
};

type EventApiResponse = {
    success: boolean;
    data?: Event;
    message?: string;
};

type ReviewsApiResponse = {
    success: boolean;
    data?: Review[];
    message?: string;
};

const labels = [
    "",
    "Sangat buruk",
    "Kurang memuaskan",
    "Cukup baik",
    "Memuaskan",
    "Sangat memuaskan",
];

export default function EventReviewPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId } = use(params);
    const auth = useAuth();
    const customerId = auth.user?.role === "CUSTOMER" ? auth.user.id : null;
    const [eligibility, setEligibility] = useState<(EventReviewEligibility & { customerId: string }) | null>(null);
    const [eligibilityError, setEligibilityError] = useState("");
    const inFlight = useRef(false);
    const expectedReviewer = useRef<string | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        setEligibility(null);
        setEligibilityError("");
        if (auth.status !== "authenticated" || !customerId) return () => controller.abort();
        void auth.client.reviewEligibility(eventId, controller.signal).then(state => {
            if (!controller.signal.aborted) setEligibility({ ...state, customerId });
        }).catch(error => {
            if (!controller.signal.aborted) setEligibilityError(accountError(error));
        });
        return () => controller.abort();
    }, [auth.client, auth.status, customerId, eventId]);

    const [event, setEvent] = useState<Event | null>(null);
    const [loadingEvent, setLoadingEvent] = useState(true);
    const [eventError, setEventError] = useState<string | null>(null);

    const [reviews, setReviews] = useState<Review[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [reviewsError, setReviewsError] = useState<string | null>(null);
    useEffect(() => {
        const controller = new AbortController();

        async function loadEvent() {
            try {
                setLoadingEvent(true);
                setEventError(null);

                const response = await fetch(
                    `/api/events/${eventId}`,
                    { signal: controller.signal },
                );

                if (!response.ok) {
                    throw new Error(`API request failed (${response.status})`);
                }

                const result = (await response.json()) as EventApiResponse;

                if (!result.success || !result.data) {
                    throw new Error(result.message || "Invalid API response");
                }

                setEvent(result.data);
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError") return;

                setEventError("Gagal memuat detail event. Silakan coba lagi.");
            } finally {
                if (!controller.signal.aborted) {
                    setLoadingEvent(false);
                }
            }
        }

        void loadEvent();

        return () => controller.abort();
    }, [eventId]);
    useEffect(() => {
        const controller = new AbortController();

        async function loadReviews() {
            try {
                setLoadingReviews(true);
                setReviewsError(null);

                const response = await fetch(
                    `/api/events/${eventId}/reviews`,
                    { signal: controller.signal },
                );

                if (!response.ok) {
                    throw new Error(`API request failed (${response.status})`);
                }

                const result = (await response.json()) as ReviewsApiResponse;

                if (!result.success || !result.data) {
                    throw new Error(result.message || "Invalid API response");
                }

                setReviews(result.data);
            } catch (error) {
                if (error instanceof Error && error.name === "AbortError") return;

                setReviewsError("Gagal memuat ulasan. Silakan coba lagi.");
            } finally {
                if (!controller.signal.aborted) {
                    setLoadingReviews(false);
                }
            }
        }

        void loadReviews();

        return () => controller.abort();
    }, [eventId]);
    const [rating, setRating] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [reviewText, setReviewText] = useState("");
    const [errors, setErrors] = useState<{ rating?: string; text?: string }>(
        {},
    );
    const [submitted, setSubmitted] = useState<Review | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const confirmDialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        if (confirming && !confirmDialog.current?.open) confirmDialog.current?.showModal();
    }, [confirming]);

    if (loadingEvent) {
        return (
            <main className="grid min-h-screen place-items-center bg-[#fcf9ff] text-sm text-[#77738b]">
                Memuat detail event...
            </main>
        );
    }

    if (eventError || !event) {
        return (
            <main className="min-h-screen bg-[#fcf9ff] px-5 py-20 text-[#11103d]">
                <div className="mx-auto max-w-xl rounded-3xl bg-white p-10 text-center shadow-sm">
                    <h1 className="text-2xl font-black">
                        {eventError ? "Gagal memuat event" : "Event tidak ditemukan"}
                    </h1>
                    <p className="mt-3 text-sm text-[#77738b]">
                        {eventError || "Event yang kamu cari tidak tersedia."}
                    </p>
                    <Link
                        href="/#explore"
                        className="mt-6 inline-flex rounded-full bg-[#5148df] px-5 py-3 text-sm font-bold text-white"
                    >
                        Kembali ke Explore
                    </Link>
                </div>
            </main>
        );
    }


    const currentEligibility = eligibility?.customerId === customerId ? eligibility : null;
    const alreadyReviewed = currentEligibility?.reason === "ALREADY_REVIEWED";
    const canReview = auth.status === "authenticated" && Boolean(currentEligibility?.eligible) && !submitted;
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
        if (validate() && canReview && customerId) {
            expectedReviewer.current = customerId;
            setConfirming(true);
        }
    };
    const confirmSubmit = async () => {
        if (inFlight.current || !canReview || !expectedReviewer.current) return;
        inFlight.current = true;
        setSubmitting(true);
        setSubmitError(null);
        try {
            const newReview = await auth.client.submitEventReview(eventId, {
                rating, comment: reviewText.trim(),
            }, expectedReviewer.current);
            setSubmitted(newReview);
            setReviews(previous => [newReview, ...previous.filter(review => review.id !== newReview.id)]);
            setConfirming(false);
        } catch (error) {
            setSubmitError(accountError(error));
        } finally {
            inFlight.current = false;
            setSubmitting(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#fcf9ff] text-[#11103d]">
            <SiteHeader view="event" />
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
                                    {auth.status === "loading" ? "Memeriksa sesi akun…"
                                        : auth.status === "anonymous" ? "Masuk sebagai customer untuk memeriksa kelayakan ulasanmu."
                                        : auth.status === "error" ? auth.error
                                        : !customerId ? "Gunakan akun customer yang menghadiri event ini."
                                        : eligibilityError ? eligibilityError
                                        : !currentEligibility ? "Memeriksa pembelian dan kehadiranmu…"
                                        : alreadyReviewed ? "Kamu sudah memberikan ulasan untuk event ini."
                                        : currentEligibility.reason === "PURCHASE_REQUIRED" ? "Selesaikan pembelian tiket untuk event ini terlebih dahulu."
                                        : "Minta penyelenggara mencatat kehadiranmu sebelum memberikan ulasan."}
                                </p>
                                {auth.status === "anonymous" && <Link
                                    href={"/login?next=" + encodeURIComponent(`/events/${eventId}/review`)}
                                    className="mt-5 inline-flex rounded-full bg-[#5148df] px-5 py-3 text-sm font-bold text-white"
                                >Masuk sebagai customer</Link>}
                                {(eligibilityError || auth.status === "error") && <button type="button"
                                    onClick={() => window.location.reload()}
                                    className="mt-5 rounded-full border px-5 py-3 text-sm font-bold"
                                >Muat ulang</button>}
                                {submitError && (
                                    <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
                                        {submitError}
                                    </p>
                                )}
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
                            {loadingReviews ? (
                                <p className="mt-4 text-sm text-[#77738b]">
                                    Memuat ulasan...
                                </p>
                            ) : reviewsError ? (
                                <p role="alert" className="mt-4 text-sm text-red-600">
                                    {reviewsError}
                                </p>
                            ) : reviews.length > 0 ? (
                                <div className="mt-4 grid gap-3">
                                    {reviews.map((review) => (
                                        <article
                                            key={review.id}
                                            className="rounded-2xl border border-[#ece8f5] bg-white p-5"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-bold">
                                                    {review.reviewerName}
                                                </span>
                                                <span className="text-xs text-[#9893a8]">
                                                    {new Date(review.createdAt).toLocaleDateString(
                                                        "id-ID",
                                                        {
                                                            day: "numeric",
                                                            month: "long",
                                                            year: "numeric",
                                                        },
                                                    )}
                                                </span>
                                            </div>

                                            <div className="mt-3 flex gap-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <Star
                                                        key={star}
                                                        size={14}
                                                        fill={
                                                            star <= review.rating
                                                                ? "currentColor"
                                                                : "none"
                                                        }
                                                        className={
                                                            star <= review.rating
                                                                ? "text-[#f6b51d]"
                                                                : "text-[#c9c4d4]"
                                                        }
                                                    />
                                                ))}
                                            </div>

                                            {review.comment && (
                                                <p className="mt-3 text-sm leading-6 text-[#69657c]">
                                                    {review.comment}
                                                </p>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-4 rounded-2xl bg-white p-5 text-sm text-[#77738b]">
                                    Belum ada ulasan. Jadilah yang pertama berbagi pengalaman.
                                </p>
                            )}
                        </section>
                    </section>
                    <aside className="h-fit rounded-3xl bg-white p-5 shadow-sm">
                        {event.image ? (
                            <img
                                src={event.image}
                                alt=""
                                className="h-36 w-full rounded-2xl object-cover"
                            />
                        ) : (
                            <div className="grid h-36 w-full place-items-center rounded-2xl bg-[#f0edff] text-sm font-semibold text-[#8c83c5]">
                                No event image
                            </div>
                        )}
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
                            {new Date(event.date).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                                timeZone: "Asia/Jakarta",
                            })}
                        </div>
                    </aside>
                </div>
            </div>
            {confirming && (
                <dialog ref={confirmDialog} onCancel={() => setConfirming(false)}
                    aria-labelledby="confirm-title"
                    className="fixed inset-0 z-30 m-auto max-w-[calc(100%-2.5rem)] rounded-3xl border-0 bg-transparent p-0 backdrop:bg-[#16122c]/50">
                    <div
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
                        {submitError && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{submitError}</p>}
                        {!canReview && <p role="alert" className="mt-3 text-sm">Akun atau kelayakan berubah. Tutup dialog dan muat ulang sebelum mengirim.</p>}
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
                                disabled={submitting || !canReview}
                                onClick={confirmSubmit}
                                className="rounded-full bg-[#5148df] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                            >
                                {submitting
                                    ? "Mengirim..."
                                    : "Ya, Kirim Ulasan"}
                            </button>
                        </div>
                    </div>
                </dialog>
            )}
        </main>
    );
}
