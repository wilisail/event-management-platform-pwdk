
"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    MapPin,
    Star,
    Ticket,
} from "lucide-react";
import { formatPrice } from "@/lib/events";

interface OrganizerProfile {
    id: string;
    name: string;
    profilePicture: string | null;
}

interface OrganizerEvent {
    id: string;
    name: string;
    category: string;
    location: string;
    venue: string;
    startAt: string;
    endAt: string;
    image: string | null;
    availableSeats: number;
    minimumPrice: number | null;
}

interface OrganizerReview {
    id: string;
    eventId: string;
    eventName: string;
    reviewerName: string;
    rating: number;
    comment: string | null;
    createdAt: string;
}

interface OrganizerProfileResponse {
    organizer: OrganizerProfile;
    events: OrganizerEvent[];
    reviews: OrganizerReview[];
}

export default function OrganizerProfilePage({
    params,
}: {
    params: Promise<{ organizerId: string }>;
}) {
    const { organizerId } = use(params);

            const [profile, setProfile] = useState<OrganizerProfileResponse | null>(null);
            const [loading, setLoading] = useState(true);
            const [error, setError] = useState("");

            const [sort, setSort] = useState("Terbaru");
            const [tab, setTab] = useState<"Mendatang" | "Selesai">("Mendatang");

            useEffect(() => {
            const controller = new AbortController();

            async function fetchOrganizerProfile() {
                try {
                    setLoading(true);
                    setError("");

                    const apiBaseUrl =
                        process.env.NEXT_PUBLIC_API_URL ??
                        "http://127.0.0.1:4002";

                    const response = await fetch(
                        `${apiBaseUrl}/api/organizers/${organizerId}`,
                        { signal: controller.signal },
                    );

                    const result = await response.json();

                    if (!response.ok || !result.success) {
                        throw new Error(
                            result.message || "Gagal mengambil profil penyelenggara",
                        );
                    }

                    setProfile(result.data);
                } catch (error) {
                    if (error instanceof Error && error.name !== "AbortError") {
                        setError(error.message);
                    }
                } finally {
                    if (!controller.signal.aborted) {
                        setLoading(false);
                    }
                }
            }

            fetchOrganizerProfile();

            return () => controller.abort();
        }, [organizerId]);

        // Data from the API
        const organizer = profile?.organizer;
        const organizerEvents = profile?.events ?? [];
        const reviews = profile?.reviews ?? [];

        // Review calculations
        const average = reviews.length
            ? reviews.reduce((sum, review) => sum + review.rating, 0) /
            reviews.length
            : 0;

        const sortedReviews = [...reviews].sort((a, b) =>
            sort === "Rating tertinggi"
                ? b.rating - a.rating
                : sort === "Rating terendah"
                ? a.rating - b.rating
                : new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime(),
        );

        // Separate upcoming and completed events by their end date
        const now = Date.now();

        const displayedEvents =
            tab === "Mendatang"
                ? organizerEvents.filter(
                    (event) => new Date(event.endAt).getTime() >= now,
                )
                : organizerEvents.filter(
                    (event) => new Date(event.endAt).getTime() < now,
                );

        // Review rating distribution
        const distribution = [5, 4, 3, 2, 1].map((star) => ({
            star,
            count: reviews.filter((review) => review.rating === star).length,
        }));

    if (loading) {
            return (
                <div className="grid min-h-screen place-items-center bg-[#fcf9ff] text-[#5148df]">
                    <p className="font-bold">Memuat profil penyelenggara...</p>
                </div>
            );
        }

        if (error || !organizer) {
            return (
                <div className="min-h-screen bg-[#fcf9ff] px-5 py-20 text-[#11103d]">
                    <div className="mx-auto max-w-xl rounded-3xl bg-white p-10 text-center shadow-sm">
                        <h1 className="text-2xl font-black">
                            {error || "Penyelenggara tidak ditemukan"}
                        </h1>
                        <Link
                            href="/#explore"
                            className="mt-6 inline-flex rounded-full bg-[#4e46dc] px-5 py-3 text-sm font-bold text-white"
                        >
                            Kembali ke event
                        </Link>
                    </div>
                </div>
            );
        }    

    return (
        <div className="min-h-screen bg-[#fcf9ff] text-[#11103d]">
            <header className="sticky top-0 z-20 border-b border-[#eee9fb] bg-white/90 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5">
                    <Link href="/" className="font-black tracking-tight">
                        ✦ Temu<span className="text-[#e539a7]">Event</span>
                    </Link>
                    <Link
                        href="/#explore"
                        className="flex items-center gap-2 text-xs font-bold text-[#5148df]"
                    >
                        <ArrowLeft size={15} /> Kembali ke event
                    </Link>
                </div>
            </header>
            <main className="mx-auto max-w-[1180px] px-5 pb-20">
                <nav
                    aria-label="Breadcrumb"
                    className="flex gap-2 py-6 text-xs text-[#858196]"
                >
                    <Link href="/">Home</Link>
                    <span>/</span>
                    <span className="font-semibold text-[#5148df]">
                        Profil penyelenggara
                    </span>
                </nav>
                <section className="rounded-3xl bg-gradient-to-br from-[#4f46df] via-[#6357df] to-[#bd2b9e] p-6 text-white shadow-xl shadow-indigo-100 sm:p-10">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                        <div className="grid size-24 shrink-0 place-items-center rounded-3xl bg-white text-2xl font-black text-[#5148df] shadow-lg">
                            {getInitials(organizer.name)}
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold">
                                    Penyelenggara
                                </span>
                                <span className="text-xs text-white/70">
                                    Publik · Profil komunitas
                                </span>
                            </div>

                            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
                                {organizer.name}
                            </h1>

                            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/80">
                                Lihat event yang diselenggarakan dan ulasan dari para peserta.
                            </p>
                        </div>
                    </div>
                    <div className="mt-7 grid grid-cols-2 gap-3 border-t border-white/15 pt-6 sm:grid-cols-4">
                        <Stat
                            label="Event dipublikasikan"
                            value={String(organizerEvents.length)}
                        />
                        <Stat
                            label="Rating"
                            value={
                                reviews.length
                                    ? `${average.toFixed(1)} / 5`
                                    : "Belum ada"
                            }
                        />
                        <Stat
                            label="Ulasan peserta"
                            value={String(reviews.length)}
                        />
                        <Stat label="Total event" value={String(organizerEvents.length)} />
                    </div>
                </section>
                <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                    <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                        <h2 className="text-xl font-black">
                            Rating penyelenggara
                        </h2>
                        {reviews.length ? (
                            <>
                                <div className="mt-5 flex items-end gap-3">
                                    <strong className="text-5xl font-black text-[#5148df]">
                                        {average.toFixed(1)}
                                    </strong>
                                    <div className="pb-1">
                                        <div className="flex text-amber-400">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    size={17}
                                                    fill={
                                                        star <=
                                                        Math.round(average)
                                                            ? "currentColor"
                                                            : "none"
                                                    }
                                                />
                                            ))}
                                        </div>
                                        <p className="mt-1 text-xs text-[#858196]">
                                            Berdasarkan {reviews.length} ulasan
                                            peserta
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-6 flex flex-col gap-2">
                                    {distribution.map((item) => (
                                        <div
                                            key={item.star}
                                            className="flex items-center gap-2 text-xs"
                                        >
                                            <span className="w-8 text-[#69657c]">
                                                {item.star} bintang
                                            </span>
                                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eeeaff]">
                                                <div
                                                    className="h-full rounded-full bg-[#5148df]"
                                                    style={{
                                                        width: `${reviews.length ? (item.count / reviews.length) * 100 : 0}%`,
                                                    }}
                                                />
                                            </div>
                                            <span className="w-5 text-right text-[#858196]">
                                                {item.count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="mt-6 rounded-2xl bg-[#f7f3ff] p-6 text-center">
                                <Star className="mx-auto text-[#bdb5df]" />
                                <p className="mt-3 font-bold">
                                    Belum ada ulasan
                                </p>
                                <p className="mt-1 text-xs text-[#858196]">
                                    Ulasan peserta akan muncul di sini setelah
                                    tersedia.
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black">
                                    Event dari Penyelenggara Ini
                                </h2>
                                <p className="mt-1 text-xs text-[#858196]">
                                    Temukan pengalaman pilihan komunitas ini.
                                </p>
                            </div>
                            <Ticket className="text-[#5148df]" />
                        </div>
                        <div className="mt-5 flex gap-2 rounded-xl bg-[#f7f3ff] p-1">
                            <button
                                onClick={() => setTab("Mendatang")}
                                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${tab === "Mendatang" ? "bg-white text-[#5148df] shadow-sm" : "text-[#858196]"}`}
                            >
                                Mendatang
                            </button>
                            <button
                                onClick={() => setTab("Selesai")}
                                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${tab === "Selesai" ? "bg-white text-[#5148df] shadow-sm" : "text-[#858196]"}`}
                            >
                                Selesai
                            </button>
                        </div>
                        <div className="mt-5 flex flex-col gap-3">
                            {displayedEvents.length ? (
                                displayedEvents.map((event) => (
                                    <Link
                                        key={event.id}
                                        href={`/events/${event.id}`}
                                        className="group flex gap-3 rounded-2xl border border-[#eee9fb] p-3 transition hover:border-[#cfc7f3]"
                                    >
                                        {event.image ? (
                                            <img
                                                src={event.image}
                                                alt=""
                                                className="size-20 rounded-xl object-cover"
                                            />
                                        ) : (
                                            <div className="grid size-20 shrink-0 place-items-center rounded-xl bg-[#eeeaff] text-[#5148df]">
                                                <Ticket size={24} />
                                            </div>
                                        )}

                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-[#5148df]">
                                                {event.category}
                                            </p>

                                            <h3 className="mt-1 truncate text-sm font-bold group-hover:text-[#5148df]">
                                                {event.name}
                                            </h3>

                                            <p className="mt-1 flex items-center gap-1 text-[10px] text-[#858196]">
                                                <CalendarDays size={11} />
                                                {new Date(event.startAt).toLocaleDateString("id-ID", {
                                                    dateStyle: "long",
                                                })}
                                            </p>

                                            <p className="mt-1 flex items-center gap-1 text-[10px] text-[#858196]">
                                                <MapPin size={11} />
                                                {event.location}
                                            </p>

                                            <p className="mt-1 text-xs font-bold text-[#5148df]">
                                                {event.minimumPrice === null || event.minimumPrice === 0
                                                    ? "Gratis"
                                                    : formatPrice(event.minimumPrice)}
                                            </p>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <p className="rounded-2xl bg-[#f7f3ff] p-6 text-center text-sm text-[#858196]">
                                    Belum ada event di kategori ini.
                                </p>
                            )}
                        </div>
                    </div>
                </section>
                <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-xl font-black">
                                Ulasan Peserta
                            </h2>
                            <p className="mt-1 text-xs text-[#858196]">
                                Cerita dari peserta event {organizer.name}.
                            </p>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-[#69657c]">
                            Urutkan
                            <select
                                aria-label="Urutkan ulasan"
                                value={sort}
                                onChange={(event) =>
                                    setSort(event.target.value)
                                }
                                className="rounded-xl border border-[#e8e3f2] bg-white px-3 py-2 text-xs outline-none"
                            >
                                <option>Terbaru</option>
                                <option>Rating tertinggi</option>
                                <option>Rating terendah</option>
                            </select>
                            <ChevronDown size={14} />
                        </label>
                    </div>
                    {sortedReviews.length ? (
                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {sortedReviews.map((review) => {
                                
                                return (
                                    <article
                                        key={review.id}
                                        className="rounded-2xl border border-[#eee9fb] p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="grid size-9 place-items-center rounded-full bg-[#eeeaff] text-xs font-black text-[#5148df]">
                                                    {getInitials(review.reviewerName)}
                                                </div>

                                                <div>
                                                    <p className="text-sm font-bold">
                                                        {review.reviewerName}
                                                    </p>

                                                    <p className="text-[10px] text-[#858196]">
                                                        {new Date(review.createdAt).toLocaleDateString("id-ID", {
                                                            dateStyle: "long",
                                                        })}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 text-xs font-bold text-amber-500">
                                                <Star size={13} fill="currentColor" />
                                                {review.rating}.0
                                            </div>
                                        </div>

                                        <p className="mt-4 text-sm leading-6 text-[#69657c]">
                                            “{review.comment || "Peserta tidak menambahkan komentar."}”
                                        </p>

                                        <Link
                                            href={`/events/${review.eventId}`}
                                            className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#5148df] hover:underline"
                                        >
                                            <CheckCircle2 size={13} />
                                            {review.eventName}
                                        </Link>
                                    </article>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="mt-6 rounded-2xl bg-[#f7f3ff] p-8 text-center text-sm text-[#858196]">
                            Penyelenggara ini belum memiliki ulasan. Ulasan dari
                            peserta akan muncul di sini setelah tersedia.
                        </p>
                    )}
                </section>
            </main>
        </div>
    );
}
function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[10px] text-white/65">{label}</p>
            <p className="mt-1 text-lg font-black">{value}</p>
        </div>
    );
}

function getInitials(name: string) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("");
}